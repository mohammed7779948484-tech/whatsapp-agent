import { toFile, type LlamaCloud } from '@llamaindex/llama-cloud';
import type { ParsingGetResponse } from '@llamaindex/llama-cloud/resources/parsing';
import type OpenAI from 'openai';

import { env } from '@/core/env';
import { AppError, ErrorCode } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { createLlamaParseClient } from '@/core/providers/llama-parse-client';
import { createOpenAIClient } from '@/core/providers/openai-client';
import { createQstashClient } from '@/core/providers/qstash-client';
import { getPayloadClient } from '@/payload/lib';
import type {
  IngestionJob,
  KnowledgeChunk,
  KnowledgeFile,
  User,
  Workspace,
} from '@/payload-types';

import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_MODEL,
  MAX_FILES_PER_WORKSPACE,
} from '../constants';
import { chunkText } from '../lib/chunker';
import type { IngestionStage } from '../types';

interface PayloadDatabaseExecutor {
  drizzle: unknown;
  execute: (args: { drizzle: unknown; raw: string }) => Promise<unknown>;
}

type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>;
type KnowledgeFileRecord = KnowledgeFile & { parsed_content?: string | null };
type KnowledgeChunkResult = Awaited<ReturnType<PayloadClient['find']>>;
type RestartStage = Extract<IngestionStage, 'parsing' | 'chunking'>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unknown error occurred';
}

function resolveRelationId(value: number | Workspace | null | undefined): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && typeof value.id === 'number') {
    return value.id;
  }

  return null;
}

function getFileUrl(file: Pick<KnowledgeFile, 'url'>): string {
  if (!file.url) {
    throw new AppError('Knowledge file URL is missing', ErrorCode.INTERNAL_ERROR, 500, 'medium');
  }

  return new URL(file.url, env.APP_URL).toString();
}

function getParsedMarkdown(result: ParsingGetResponse): string {
  if (typeof result.markdown_full === 'string' && result.markdown_full.trim().length > 0) {
    return result.markdown_full.trim();
  }

  const markdownPages = result.markdown?.pages
    .filter(
      (
        page
      ): page is ParsingGetResponse.Markdown.MarkdownResultPage =>
        'success' in page && page.success === true && typeof page.markdown === 'string'
    )
    .map((page) => page.markdown.trim())
    .filter(Boolean);

  return markdownPages?.join('\n\n').trim() ?? '';
}

function getSafeEmbeddingLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => (Number.isFinite(value) ? String(value) : '0')).join(',')}]`;
}

function assertSafeIntegerIdentifier(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(
      `Invalid ${name}`,
      ErrorCode.VALIDATION_ERROR,
      400,
      'medium',
      {
        details: {
          [name]: value,
        },
      }
    );
  }
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

export class KnowledgeService {
  private readonly logger = createLogger('modules/knowledge/service');

  private async getPayload(): Promise<PayloadClient> {
    return getPayloadClient();
  }

  private async findJobForFile(
    payload: PayloadClient,
    fileId: number,
    options: { user?: User; overrideAccess: boolean }
  ): Promise<IngestionJob | null> {
    const result = await payload.find({
      collection: 'ingestion_jobs',
      where: {
        file: {
          equals: fileId,
        },
      },
      limit: 1,
      sort: '-updatedAt',
      user: options.user,
      overrideAccess: options.overrideAccess,
      depth: 0,
    });

    return result.docs[0] ?? null;
  }

  private async requireUserScopedFile(
    payload: PayloadClient,
    fileId: number,
    workspaceId: number,
    user: User
  ): Promise<KnowledgeFileRecord> {
    const file = (await payload.findByID({
      collection: 'knowledge_files',
      id: fileId,
      user,
      overrideAccess: false,
      depth: 0,
    })) as KnowledgeFileRecord;

    if (!file || resolveRelationId(file.workspace) !== workspaceId) {
      throw new AppError('Knowledge file not found', ErrorCode.NOT_FOUND_ERROR, 404, 'medium');
    }

    return file;
  }

  private async updateIngestionJob(
    payload: PayloadClient,
    jobId: number,
    data: Partial<IngestionJob>
  ): Promise<void> {
    await payload.update({
      collection: 'ingestion_jobs',
      id: jobId,
      data,
      overrideAccess: true,
      depth: 0,
    });
  }

  private async updateKnowledgeFile(
    payload: PayloadClient,
    fileId: number,
    data: Partial<KnowledgeFileRecord>
  ): Promise<void> {
    await payload.update({
      collection: 'knowledge_files',
      id: fileId,
      data,
      overrideAccess: true,
      depth: 0,
    });
  }

  private async markFileAndJobFailed(
    payload: PayloadClient,
    params: {
      fileId: number;
      jobId: number | null;
      message: string;
      parseStatus?: KnowledgeFileRecord['parse_status'];
    }
  ): Promise<void> {
    const fileUpdate: Partial<KnowledgeFileRecord> = {
      ingestion_status: 'failed',
      ingestion_error: params.message,
    };

    if (params.parseStatus) {
      fileUpdate.parse_status = params.parseStatus;
    }

    await this.updateKnowledgeFile(payload, params.fileId, fileUpdate);

    if (params.jobId !== null) {
      await this.updateIngestionJob(payload, params.jobId, {
        stage: 'failed',
        last_error: params.message,
      });
    }
  }

  private getDatabase(payload: PayloadClient): PayloadDatabaseExecutor {
    return payload.db as unknown as PayloadDatabaseExecutor;
  }

  private async deleteVectorsForFile(payload: PayloadClient, fileId: number): Promise<void> {
    assertSafeIntegerIdentifier('fileId', fileId);

    const database = this.getDatabase(payload);

    await database.execute({
      drizzle: database.drizzle,
      raw: `DELETE FROM knowledge_vectors WHERE file_id = ${fileId};`,
    });
  }

  private async insertKnowledgeVector(params: {
    payload: PayloadClient;
    workspaceId: number;
    fileId: number;
    chunkId: number;
    embedding: number[];
  }): Promise<void> {
    assertSafeIntegerIdentifier('workspaceId', params.workspaceId);
    assertSafeIntegerIdentifier('fileId', params.fileId);
    assertSafeIntegerIdentifier('chunkId', params.chunkId);

    if (params.embedding.some((value) => !Number.isFinite(value))) {
      throw new AppError(
        'Embedding contains non-finite values',
        ErrorCode.INGESTION_FAILED,
        500,
        'medium'
      );
    }

    const database = this.getDatabase(params.payload);
    const embeddingLiteral = getSafeEmbeddingLiteral(params.embedding);

    await database.execute({
      drizzle: database.drizzle,
      raw:
        'INSERT INTO knowledge_vectors (workspace_id, file_id, chunk_id, embedding, created_at) ' +
        `VALUES (${params.workspaceId}, ${params.fileId}, ${params.chunkId}, '${embeddingLiteral}', NOW());`,
    });
  }

  private async getAllChunksForFile(
    payload: PayloadClient,
    fileId: number
  ): Promise<KnowledgeChunk[]> {
    const limit = 1000;
    const firstPage = (await payload.find({
      collection: 'knowledge_chunks',
      where: {
        file: {
          equals: fileId,
        },
      },
      limit,
      page: 1,
      sort: 'chunk_index',
      overrideAccess: true,
      depth: 0,
    })) as KnowledgeChunkResult;

    const chunks = [...(firstPage.docs as KnowledgeChunk[])];

    if (firstPage.totalDocs > firstPage.docs.length) {
      this.logger.warn('Knowledge chunk query exceeded single-page limit; fetching remaining pages', {
        fileId,
        totalDocs: firstPage.totalDocs,
        firstPageDocs: firstPage.docs.length,
        limit,
      });
    }

    const totalPages = typeof firstPage.totalPages === 'number' ? firstPage.totalPages : 1;

    for (let page = 2; page <= totalPages; page += 1) {
      const nextPage = (await payload.find({
        collection: 'knowledge_chunks',
        where: {
          file: {
            equals: fileId,
          },
        },
        limit,
        page,
        sort: 'chunk_index',
        overrideAccess: true,
        depth: 0,
      })) as KnowledgeChunkResult;

      chunks.push(...(nextPage.docs as KnowledgeChunk[]));
    }

    return chunks;
  }

  private async enqueueStage(stage: RestartStage | 'embedding', payload: { fileId: number; workspaceId: number }): Promise<void> {
    const routeByStage: Record<RestartStage | 'embedding', string> = {
      parsing: '/api/jobs/ingest-parse',
      chunking: '/api/jobs/ingest-chunk',
      embedding: '/api/jobs/ingest-embed',
    };

    await createQstashClient().publishJSON({
      url: `${env.APP_URL}${routeByStage[stage]}`,
      body: payload,
    });
  }

  private async createLlamaParseUpload(
    client: LlamaCloud,
    fileBuffer: Buffer,
    file: Pick<KnowledgeFile, 'filename' | 'mimeType'>
  ): Promise<string> {
    const uploadedFile = await client.files.create({
      file: await toFile(fileBuffer, file.filename ?? 'knowledge-file', {
        type: file.mimeType ?? 'application/octet-stream',
      }),
      purpose: 'parse',
    });

    return uploadedFile.id;
  }

  private async createEmbeddings(
    client: OpenAI,
    chunks: KnowledgeChunk[]
  ): Promise<Array<{ chunkId: number; embedding: number[] }>> {
    const batches = splitIntoBatches(chunks, EMBEDDING_BATCH_SIZE);
    const embeddings: Array<{ chunkId: number; embedding: number[] }> = [];

    for (const batch of batches) {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map((chunk) => chunk.content),
      });

      for (const [index, item] of response.data.entries()) {
        const chunk = batch[index];

        if (!chunk) {
          continue;
        }

        embeddings.push({
          chunkId: chunk.id,
          embedding: item.embedding,
        });
      }
    }

    return embeddings;
  }

  public async getFilesForWorkspace(workspaceId: number, user: User): Promise<KnowledgeFile[]> {
    const payload = await this.getPayload();
    const result = await payload.find({
      collection: 'knowledge_files',
      where: {
        workspace: {
          equals: workspaceId,
        },
      },
      sort: '-uploaded_at',
      user,
      overrideAccess: false,
      depth: 0,
    });

    return result.docs;
  }

  public async getWorkspaceKnowledgeSummary(
    workspaceId: number,
    user: User
  ): Promise<{ indexedCount: number; lastUpdatedAt: string | null }> {
    const payload = await this.getPayload();
    const indexedFiles = await payload.find({
      collection: 'knowledge_files',
      where: {
        workspace: {
          equals: workspaceId,
        },
        ingestion_status: {
          equals: 'indexed',
        },
      },
      limit: 0,
      user,
      overrideAccess: false,
      depth: 0,
    });
    const workspace = await payload.findByID({
      collection: 'workspaces',
      id: workspaceId,
      user,
      overrideAccess: false,
      depth: 0,
    });

    return {
      indexedCount: indexedFiles.totalDocs,
      lastUpdatedAt: workspace.last_knowledge_update_at ?? null,
    };
  }

  public async parseFile(fileId: number, workspaceId: number): Promise<void> {
    const payload = await this.getPayload();
    const file = (await payload.findByID({
      collection: 'knowledge_files',
      id: fileId,
      overrideAccess: true,
      depth: 0,
    }).catch(() => null)) as KnowledgeFileRecord | null;

    if (!file) {
      this.logger.warn('Skipping parse for deleted knowledge file', {
        fileId,
        workspaceId,
      });
      return;
    }

    const job = await this.findJobForFile(payload, fileId, { overrideAccess: true });
    if (!job) {
      throw new AppError('Ingestion job not found', ErrorCode.NOT_FOUND_ERROR, 404, 'medium');
    }

    try {
      const startedAt = new Date().toISOString();

      await this.updateIngestionJob(payload, job.id, {
        stage: 'parsing',
        started_at: startedAt,
      });
      await this.updateKnowledgeFile(payload, fileId, {
        parse_status: 'parsing',
        ingestion_status: 'processing',
        ingestion_error: null,
      });

      const response = await fetch(getFileUrl(file));
      if (!response.ok) {
        throw new AppError(
          'Failed to download knowledge file',
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          502,
          'medium'
        );
      }

      const fileBuffer = Buffer.from(await response.arrayBuffer());
      const llamaParseClient = createLlamaParseClient();
      const uploadedFileId = await this.createLlamaParseUpload(llamaParseClient, fileBuffer, file);
      const parseResult = await llamaParseClient.parsing.parse({
        file_id: uploadedFileId,
        tier: 'cost_effective',
        version: 'latest',
        expand: ['markdown'],
      });
      const parsedContent = getParsedMarkdown(parseResult);

      if (!parsedContent) {
        const message = 'LlamaParse returned empty content';
        await this.updateKnowledgeFile(payload, fileId, {
          parsed_content: null,
          parse_status: 'failed',
          ingestion_status: 'failed',
          ingestion_error: message,
        });
        await this.updateIngestionJob(payload, job.id, {
          stage: 'failed',
          last_error: message,
        });
        return;
      }

      await this.updateKnowledgeFile(payload, fileId, {
        parsed_content: parsedContent,
        parse_status: 'parsed',
        parsed_at: new Date().toISOString(),
      });
      await this.updateIngestionJob(payload, job.id, {
        stage: 'chunking',
      });
      await this.enqueueStage('chunking', { fileId, workspaceId });
    } catch (error) {
      const message = getErrorMessage(error);
      await this.updateKnowledgeFile(payload, fileId, {
        parse_status: 'failed',
        ingestion_status: 'failed',
        ingestion_error: message,
      });
      await this.updateIngestionJob(payload, job.id, {
        stage: 'failed',
        last_error: message,
      });
      throw error;
    }
  }

  public async chunkFile(fileId: number, workspaceId: number): Promise<void> {
    const payload = await this.getPayload();
    const file = (await payload.findByID({
      collection: 'knowledge_files',
      id: fileId,
      overrideAccess: true,
      depth: 0,
    }).catch(() => null)) as KnowledgeFileRecord | null;

    if (!file) {
      this.logger.warn('Skipping chunking for deleted knowledge file', {
        fileId,
        workspaceId,
      });
      return;
    }

    const job = await this.findJobForFile(payload, fileId, { overrideAccess: true });
    if (!job) {
      throw new AppError('Ingestion job not found', ErrorCode.NOT_FOUND_ERROR, 404, 'medium');
    }

    const parsedContent = file.parsed_content?.trim();
    if (!parsedContent) {
      const message = 'No parsed content available for chunking';
      this.logger.error('Cannot chunk knowledge file without parsed content', {
        fileId,
        workspaceId,
      });
      await this.markFileAndJobFailed(payload, {
        fileId,
        jobId: job.id,
        message,
      });
      return;
    }

    try {
      await payload.delete({
        collection: 'knowledge_chunks' as never,
        where: {
          file: {
            equals: fileId,
          },
        },
        overrideAccess: true,
        depth: 0,
      });
      await this.updateIngestionJob(payload, job.id, {
        stage: 'chunking',
      });

      const chunks = chunkText(parsedContent);
      if (chunks.length === 0) {
        await this.markFileAndJobFailed(payload, {
          fileId,
          jobId: job.id,
          message: 'Chunking produced zero results',
        });
        return;
      }

      for (const chunk of chunks) {
        await payload.create({
          collection: 'knowledge_chunks' as never,
          data: {
            workspace: workspaceId,
            file: fileId,
            chunk_index: chunk.chunkIndex,
            content: chunk.content,
            content_hash: chunk.contentHash,
            metadata_json: chunk.metadata,
          } as never,
          overrideAccess: true,
          depth: 0,
        });
      }

      await this.updateIngestionJob(payload, job.id, {
        stage: 'embedding',
      });
      await this.enqueueStage('embedding', { fileId, workspaceId });
    } catch (error) {
      await this.markFileAndJobFailed(payload, {
        fileId,
        jobId: job.id,
        message: getErrorMessage(error),
      });
      throw error;
    }
  }

  public async embedFile(fileId: number, workspaceId: number): Promise<void> {
    const payload = await this.getPayload();
    const file = (await payload.findByID({
      collection: 'knowledge_files',
      id: fileId,
      overrideAccess: true,
      depth: 0,
    }).catch(() => null)) as KnowledgeFileRecord | null;

    if (!file) {
      this.logger.warn('Skipping embedding for deleted knowledge file', {
        fileId,
        workspaceId,
      });
      return;
    }

    const job = await this.findJobForFile(payload, fileId, { overrideAccess: true });
    if (!job) {
      throw new AppError('Ingestion job not found', ErrorCode.NOT_FOUND_ERROR, 404, 'medium');
    }

    const chunks = await this.getAllChunksForFile(payload, fileId);

    if (chunks.length === 0) {
      await this.markFileAndJobFailed(payload, {
        fileId,
        jobId: job.id,
        message: 'No chunks found for embedding',
      });
      return;
    }

    await this.deleteVectorsForFile(payload, fileId);

    try {
      const now = new Date().toISOString();

      await this.updateIngestionJob(payload, job.id, {
        stage: 'embedding',
      });

      const embeddings = await this.createEmbeddings(createOpenAIClient(), chunks);

      for (const embedding of embeddings) {
        await this.insertKnowledgeVector({
          payload,
          workspaceId,
          fileId,
          chunkId: embedding.chunkId,
          embedding: embedding.embedding,
        });
      }

      await this.updateKnowledgeFile(payload, fileId, {
        ingestion_status: 'indexed',
        indexed_at: now,
      });
      await this.updateIngestionJob(payload, job.id, {
        stage: 'indexed',
        finished_at: now,
      });
      await payload.update({
        collection: 'workspaces',
        id: workspaceId,
        data: {
          last_knowledge_update_at: now,
        },
        overrideAccess: true,
        depth: 0,
      });
    } catch (error) {
      await this.deleteVectorsForFile(payload, fileId);
      await this.markFileAndJobFailed(payload, {
        fileId,
        jobId: job.id,
        message: getErrorMessage(error),
      });
      throw error;
    }
  }

  public async retryIngestion(
    fileId: number,
    workspaceId: number,
    user: User
  ): Promise<{ jobId: number }> {
    const payload = await this.getPayload();
    const file = await this.requireUserScopedFile(payload, fileId, workspaceId, user);

    if (file.ingestion_status !== 'failed') {
      throw new AppError(
        'Only failed ingestions can be retried',
        ErrorCode.VALIDATION_ERROR,
        400,
        'medium'
      );
    }

    const ingestionJob = await this.findJobForFile(payload, fileId, {
      user,
      overrideAccess: false,
    });
    if (!ingestionJob) {
      throw new AppError('Ingestion job not found', ErrorCode.NOT_FOUND_ERROR, 404, 'medium');
    }

    const restartStage: RestartStage = file.parse_status === 'failed' ? 'parsing' : 'chunking';

    if (restartStage === 'chunking') {
      await payload.delete({
        collection: 'knowledge_chunks' as never,
        where: {
          file: {
            equals: fileId,
          },
        },
        overrideAccess: true,
        depth: 0,
      });
      await this.deleteVectorsForFile(payload, fileId);
    }

    await this.updateIngestionJob(payload, ingestionJob.id, {
      stage: restartStage,
      last_error: null,
      started_at: null,
      finished_at: null,
      attempt_count: ingestionJob.attempt_count + 1,
    });
    await this.updateKnowledgeFile(payload, fileId, {
      ingestion_status: 'processing',
      ingestion_error: null,
      ...(restartStage === 'parsing'
        ? {
            parse_status: 'pending',
            parsed_content: null,
            parsed_at: null,
          }
        : null),
    });
    await this.enqueueStage(restartStage, { fileId, workspaceId });

    return { jobId: ingestionJob.id };
  }

  public async uploadFile(params: {
    workspaceId: number;
    user: User;
    file: File;
  }): Promise<{ fileId: number }> {
    const payload = await this.getPayload();
    const existingFiles = await payload.find({
      collection: 'knowledge_files',
      where: {
        workspace: {
          equals: params.workspaceId,
        },
      },
      limit: 0,
      user: params.user,
      overrideAccess: false,
      depth: 0,
    });

    if (existingFiles.totalDocs >= MAX_FILES_PER_WORKSPACE) {
      throw new AppError(
        'You have reached the maximum of 20 files. Delete an existing file to upload a new one.',
        ErrorCode.FILE_LIMIT_EXCEEDED,
        400,
        'medium'
      );
    }

    const createdFile = (await payload.create({
      collection: 'knowledge_files' as never,
      data: {
        workspace: params.workspaceId,
        parse_status: 'pending',
        ingestion_status: 'pending',
        uploaded_at: new Date().toISOString(),
      } as never,
      file: {
        data: Buffer.from(await params.file.arrayBuffer()),
        mimetype: params.file.type,
        name: params.file.name,
        size: params.file.size,
      },
      user: params.user,
      overrideAccess: false,
      depth: 0,
    })) as KnowledgeFileRecord;
    await payload.create({
      collection: 'ingestion_jobs' as never,
      data: {
        workspace: params.workspaceId,
        file: createdFile.id,
        stage: 'queued',
        attempt_count: 0,
      } as never,
      overrideAccess: true,
      depth: 0,
    });

    await this.enqueueStage('parsing', {
      fileId: createdFile.id,
      workspaceId: params.workspaceId,
    });

    return { fileId: createdFile.id };
  }

  public async deleteFile(fileId: number, workspaceId: number, user: User): Promise<void> {
    const payload = await this.getPayload();

    await this.requireUserScopedFile(payload, fileId, workspaceId, user);

    await payload.delete({
      collection: 'knowledge_files',
      id: fileId,
      user,
      overrideAccess: false,
    });
  }
}
