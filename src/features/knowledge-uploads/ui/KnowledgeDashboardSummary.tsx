import { getOwnerDashboardSession } from '@/core/auth';
import { KnowledgeService } from '@/modules/knowledge';
import { KnowledgeFreshnessWidget } from '@/widgets/knowledge-freshness';

export async function KnowledgeDashboardSummary() {
  const { user, workspaceId } = await getOwnerDashboardSession();
  const summary = await new KnowledgeService().getWorkspaceKnowledgeSummary(
    Number.parseInt(workspaceId, 10),
    user
  );

  return (
    <KnowledgeFreshnessWidget
      indexedCount={summary.indexedCount}
      lastUpdatedAt={summary.lastUpdatedAt}
    />
  );
}
