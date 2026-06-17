import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
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

export default function ActivityLogsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');

  const gid = parseInt(groupId || '0');

  useEffect(() => {
    if (!gid) return;

    Promise.all([
      api.getActivityLogs(gid, 200),
      api.getGroup(gid),
    ])
      .then(([logData, groupData]) => {
        setLogs(logData.activityLogs);
        setGroupName(groupData.group.name);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [gid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <LoadingSpinner className="min-h-[60vh]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <button
              onClick={() => navigate(`/groups/${gid}`)}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 block"
            >
              ← Back to {groupName || 'group'}
            </button>
            <h2 className="text-xl sm:text-2xl font-bold">Activity Log</h2>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {logs.length} log{logs.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {logs.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Actions like creating, editing, or deleting expenses will appear here."
              />
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 py-3 px-2 -mx-2 rounded hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
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
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
