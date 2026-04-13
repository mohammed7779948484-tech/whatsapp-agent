import type { KnowledgeFile } from '@/payload-types';

import type { KnowledgeFileDisplayStatus } from '../../types';
import { KnowledgeFileRow } from './KnowledgeFileRow';

export interface KnowledgeFileListItem extends KnowledgeFile {
  displayStatus: KnowledgeFileDisplayStatus;
}

interface KnowledgeFileListProps {
  files: KnowledgeFileListItem[];
}

export function KnowledgeFileList({ files }: KnowledgeFileListProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Filename
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Uploaded
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {files.map((file) => (
              <KnowledgeFileRow key={file.id} file={file} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
