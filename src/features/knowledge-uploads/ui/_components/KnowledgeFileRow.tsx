import type { KnowledgeFileDisplayStatus } from '../../types';
import type { KnowledgeFileListItem } from './KnowledgeFileList';

interface KnowledgeFileRowProps {
  file: KnowledgeFileListItem;
}

const STATUS_STYLES: Record<KnowledgeFileDisplayStatus, string> = {
  indexed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  parsing: 'border-amber-200 bg-amber-50 text-amber-700',
  indexing: 'border-blue-200 bg-blue-50 text-blue-700',
  uploaded: 'border-slate-200 bg-slate-100 text-slate-600',
};

const STATUS_LABELS: Record<KnowledgeFileDisplayStatus, string> = {
  indexed: 'Indexed',
  failed: 'Failed',
  parsing: 'Parsing…',
  indexing: 'Indexing…',
  uploaded: 'Uploaded',
};

function formatUploadedAt(uploadedAt: string): string {
  return new Date(uploadedAt).toLocaleString();
}

export function KnowledgeFileRow({ file }: KnowledgeFileRowProps) {
  return (
    <tr>
      <td className="px-4 py-4 text-sm font-medium text-slate-900">{file.filename ?? `File #${file.id}`}</td>
      <td className="px-4 py-4 text-sm text-slate-600">{formatUploadedAt(file.uploaded_at)}</td>
      <td className="px-4 py-4">
        <span
          id={`status-badge-${file.id}`}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[file.displayStatus]}`}
        >
          {STATUS_LABELS[file.displayStatus]}
        </span>
      </td>
      <td className="px-4 py-4 text-sm text-slate-400">Actions coming soon</td>
    </tr>
  );
}
