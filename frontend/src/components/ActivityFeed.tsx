import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatRelativeTime } from '@/lib/utils';

interface ActivityLog {
  id: number;
  actor_name: string;
  action_type: 'created' | 'updated' | 'deleted';
  entity_type: 'expense' | 'payment';
  description: string;
  created_at: string;
}

interface Props {
  logs: ActivityLog[];
  groupId: number;
}

const MAX_VISIBLE = 8;

const actionBadge = (action: string) => {
  const styles: Record<string, string> = {
    created: 'bg-green-100 text-green-700',
    updated: 'bg-blue-100 text-blue-700',
    deleted: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
  };
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${styles[action] || 'bg-gray-100 text-gray-700'}`}>
      {labels[action] || action}
    </span>
  );
};

export default function ActivityFeed({ logs, groupId }: Props) {
  const navigate = useNavigate();
  const visibleLogs = logs.slice(0, MAX_VISIBLE);
  const hasMore = logs.length > MAX_VISIBLE;

  if (logs.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <EmptyState title="No recent activity" description="Actions like creating, editing, or deleting expenses will appear here." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Activity Log</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {visibleLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 py-2 px-2 -mx-2 rounded hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {actionBadge(log.action_type)}
                <span className="text-sm">
                  <strong>{log.actor_name}</strong> {log.description}
                </span>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 pt-0.5">
                {formatRelativeTime(log.created_at)}
              </span>
            </div>
          ))}
        </div>
        {hasMore && (
          <div className="mt-3 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/groups/${groupId}/activity-logs`)}
            >
              See all {logs.length} activity logs →
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
