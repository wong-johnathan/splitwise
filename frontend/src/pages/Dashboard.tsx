import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';

interface GroupSummary {
  id: number;
  name: string;
  description?: string;
  member_count: string;
  balance: number;
  created_by_name: string;
}

export default function Dashboard() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getGroups()
      .then((res) => setGroups(res.groups))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <LoadingSpinner className="min-h-[60vh]" />
      </div>
    );
  }

  const totalBalance = groups.reduce((sum, g) => sum + g.balance, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Total balance card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <p className="text-sm text-gray-500 mb-1">Total Balance</p>
            <p
              className={`text-3xl font-bold ${
                totalBalance > 0
                  ? 'text-green-600'
                  : totalBalance < 0
                    ? 'text-red-600'
                    : 'text-gray-700'
              }`}
            >
              {totalBalance >= 0 ? '+' : ''}
              {formatCurrency(totalBalance)}
            </p>
          </CardContent>
        </Card>

        {/* Groups header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Your Groups</h2>
          <Button onClick={() => navigate('/groups/new')}>New Group</Button>
        </div>

        {/* Group list */}
        {groups.length === 0 ? (
          <EmptyState
            title="No groups yet"
            description="Create your first group to start splitting expenses with friends!"
            action={
              <Button onClick={() => navigate('/groups/new')}>Create Your First Group</Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/groups/${group.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{group.name}</h3>
                    <p className="text-sm text-gray-500">
                      {group.member_count} member{parseInt(group.member_count) !== 1 ? 's' : ''}
                      {group.description && ` · ${group.description}`}
                    </p>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      group.balance > 0
                        ? 'text-green-600'
                        : group.balance < 0
                          ? 'text-red-600'
                          : 'text-gray-500'
                    }`}
                  >
                    {group.balance > 0 ? '+' : ''}
                    {formatCurrency(group.balance)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
