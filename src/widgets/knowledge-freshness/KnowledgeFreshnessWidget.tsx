import Link from 'next/link';

interface KnowledgeFreshnessWidgetProps {
  indexedCount: number;
  lastUpdatedAt: string | null;
}

function formatIndexedCount(indexedCount: number): string {
  return `${indexedCount} ${indexedCount === 1 ? 'file' : 'files'} indexed`;
}

export function KnowledgeFreshnessWidget({
  indexedCount,
  lastUpdatedAt,
}: KnowledgeFreshnessWidgetProps) {
  if (!lastUpdatedAt) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600">Knowledge Base</p>
            <p className="mt-2 text-lg font-medium text-slate-900">No knowledge uploaded</p>
            <p className="mt-1 text-sm text-slate-600">
              Upload PDF or CSV files to build your workspace knowledge base.
            </p>
          </div>

          <Link
            href="/knowledge"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Upload files
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">Knowledge Base</p>
          <p className="mt-2 text-lg font-medium text-slate-900">
            Last updated: {new Date(lastUpdatedAt).toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-slate-600">{formatIndexedCount(indexedCount)}</p>
        </div>

        <Link
          href="/knowledge"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Manage
        </Link>
      </div>
    </section>
  );
}
