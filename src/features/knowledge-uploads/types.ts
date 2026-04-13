export type KnowledgeFileDisplayStatus = 'uploaded' | 'parsing' | 'indexing' | 'indexed' | 'failed';

export function mapFileToDisplayStatus(
  parseStatus: string,
  ingestionStatus: string
): KnowledgeFileDisplayStatus {
  if (ingestionStatus === 'indexed') {
    return 'indexed';
  }

  if (ingestionStatus === 'failed' || parseStatus === 'failed') {
    return 'failed';
  }

  if (parseStatus === 'parsing') {
    return 'parsing';
  }

  if (ingestionStatus === 'processing') {
    return 'indexing';
  }

  return 'uploaded';
}
