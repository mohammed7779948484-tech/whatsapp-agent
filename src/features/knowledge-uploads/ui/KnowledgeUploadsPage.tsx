import { getOwnerDashboardSession } from '@/core/auth';
import { KnowledgeService } from '@/modules/knowledge';
import type { KnowledgeFile } from '@/payload-types';

import { mapFileToDisplayStatus } from '../types';
import { KnowledgeFileList } from './_components/KnowledgeFileList';
import { KnowledgeUploadForm } from './_components/KnowledgeUploadForm';

interface KnowledgeFileListItem extends KnowledgeFile {
  displayStatus: ReturnType<typeof mapFileToDisplayStatus>;
}

function formatLastUpdated(lastUpdatedAt: string | null): string {
  return lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : 'No knowledge uploaded yet';
}

export async function KnowledgeUploadsPage() {
  const { user, workspaceId } = await getOwnerDashboardSession();
  const numericWorkspaceId = Number.parseInt(workspaceId, 10);
  const knowledgeService = new KnowledgeService();
  const files = await knowledgeService.getFilesForWorkspace(numericWorkspaceId, user);
  const workspaceSummary = await knowledgeService.getWorkspaceKnowledgeSummary(
    numericWorkspaceId,
    user
  );

  const displayFiles: KnowledgeFileListItem[] = files.map((file) => ({
    ...file,
    displayStatus: mapFileToDisplayStatus(file.parse_status, file.ingestion_status),
  }));

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Knowledge Base</h1>
          <p className="mt-2 text-sm text-slate-600">
            Last updated: {formatLastUpdated(workspaceSummary.lastUpdatedAt)}
          </p>

          <div className="mt-6">
            <KnowledgeUploadForm />
          </div>
        </div>

        {displayFiles.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center shadow-sm">
            <p className="text-base font-medium text-slate-900">No files uploaded yet</p>
            <p className="mt-2 text-sm text-slate-600">Upload a PDF or CSV to get started.</p>
          </section>
        ) : (
          <KnowledgeFileList files={displayFiles} />
        )}
      </div>
    </main>
  );
}
