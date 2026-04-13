import crypto from 'crypto';

import { decode, encode } from 'gpt-tokenizer';

import {
  CHUNK_OVERLAP_TOKENS,
  CHUNK_SIZE_TOKENS,
} from '../constants';
import type { ChunkResult } from '../types';

interface ContentBlock {
  content: string;
  heading: string | null;
  isTable: boolean;
}

function isHeadingLine(line: string): boolean {
  return /^#+\s*\S/.test(line.trimStart());
}

function isTableBlock(block: string): boolean {
  const lines = block.split('\n').map((line) => line.trim());
  return lines.length > 0 && lines.every((line) => line.startsWith('|'));
}

function getBlockHeading(block: string): string | null {
  for (const line of block.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    return isHeadingLine(trimmedLine) ? trimmedLine : null;
  }

  return null;
}

function buildBlocks(text: string): ContentBlock[] {
  const normalizedText = text.replace(/\r\n?/g, '\n');
  const rawBlocks = normalizedText.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
  const blocks: ContentBlock[] = [];

  let currentHeading: string | null = null;

  for (const rawBlock of rawBlocks) {
    const headingInBlock = getBlockHeading(rawBlock);

    if (headingInBlock) {
      currentHeading = headingInBlock;
    }

    blocks.push({
      content: rawBlock,
      heading: headingInBlock ?? currentHeading,
      isTable: isTableBlock(rawBlock),
    });
  }

  return blocks;
}

function buildChunkContent(parts: string[], heading: string | null): string {
  const baseContent = parts.join('\n\n').trim();

  if (!baseContent) {
    return '';
  }

  if (heading && !isHeadingLine(baseContent.split('\n', 1)[0] ?? '')) {
    return `${heading}\n\n${baseContent}`.trim();
  }

  return baseContent;
}

function getTokenCount(value: string): number {
  return encode(value).length;
}

function getOverlapText(content: string): string {
  const tokens = encode(content);

  if (tokens.length <= CHUNK_OVERLAP_TOKENS) {
    return content.trim();
  }

  return decode(tokens.slice(-CHUNK_OVERLAP_TOKENS)).trim();
}

export function chunkText(text: string): ChunkResult[] {
  if (!text.trim()) {
    return [];
  }

  const blocks = buildBlocks(text);
  const chunks: ChunkResult[] = [];

  let currentParts: string[] = [];
  let currentHeading: string | null = null;
  let currentContainsTable = false;

  const emitChunk = (): void => {
    const content = buildChunkContent(currentParts, currentHeading).trim();

    if (!content) {
      currentParts = [];
      currentContainsTable = false;
      return;
    }

    chunks.push({
      content,
      contentHash: crypto.createHash('sha256').update(content).digest('hex'),
      chunkIndex: chunks.length,
      metadata: {
        heading: currentHeading ?? null,
      },
    });

    currentParts = [];
    currentContainsTable = false;
  };

  for (const block of blocks) {
    if (currentParts.length === 0) {
      currentHeading = block.heading;
    }

    const candidateParts = [...currentParts, block.content];
    const candidateContent = buildChunkContent(candidateParts, currentHeading);
    const candidateTokenCount = getTokenCount(candidateContent);

    if (candidateTokenCount <= CHUNK_SIZE_TOKENS) {
      currentParts = candidateParts;
      currentContainsTable = currentContainsTable || block.isTable;
      continue;
    }

    if (currentParts.length === 0) {
      currentParts = [block.content];
      currentHeading = block.heading;
      currentContainsTable = block.isTable;
      emitChunk();
      currentHeading = null;
      continue;
    }

    const previousContent = buildChunkContent(currentParts, currentHeading);
    const nextHeading = block.heading;
    const overlapText = currentContainsTable ? '' : getOverlapText(previousContent);

    emitChunk();

    currentHeading = nextHeading;
    currentParts = overlapText ? [overlapText, block.content] : [block.content];
    currentContainsTable = block.isTable;

    const restartedContent = buildChunkContent(currentParts, currentHeading);
    if (getTokenCount(restartedContent) > CHUNK_SIZE_TOKENS && currentParts.length > 1) {
      currentParts = [block.content];
    }

    if (getTokenCount(buildChunkContent(currentParts, currentHeading)) > CHUNK_SIZE_TOKENS) {
      emitChunk();
      currentHeading = null;
    }
  }

  emitChunk();

  return chunks.filter((chunk) => chunk.content.trim().length > 0);
}
