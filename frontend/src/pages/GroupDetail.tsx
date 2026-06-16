import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDate } from '@/lib/utils';
import AddMemberDialog from '@/components/AddMemberDialog';

interface Expense {
  id: number;
  description: string;
  amount: number;
  paid_by: number;
  paid_by_name: string;
  split_method: string;
  expense_date: string;
  created_at: string;
  splits: {
    id: number;
    user_id: number;
    amount: number;
    name: string;
    settled: boolean;
  }[];
}

interface Member {
  id: number;
  name: string;
  email: string;
}

interface Balance {
  userId: number;
  name: string;
  balance: number;
}

interface Debt {
  fromUser: number;
  fromUserName: string;
  toUser: number;
  toUserName: string;
  amount: number;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);

  const groupId = parseInt(id || '0');

  const loadData = useCallback(() => {
    if (!groupId) return;

    Promise.all([api.getGroup(groupId), api.getExpenses(groupId)])
      .then(([groupData, expenseData]) => {
        setGroup(groupData.group);
        setMembers(groupData.members);
        setBalances(groupData.balances);
        setDebts(groupData.debts);
        setExpenses(expenseData.expenses);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <LoadingSpinner className="min-h-[60vh]" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <EmptyState title="Group not found" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{group.name}</h2>
            <p className="text-sm text-gray-500">
              {members.length} member{members.length !== 1 ? 's' : ''}
              {group.description && ` · ${group.description}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate(`/groups/${groupId}/expenses/new`)}>
              Add Expense
            </Button>
            <Button variant="outline" onClick={() => navigate(`/groups/${groupId}/settle-up`)}>
              Settle Up
            </Button>
            <Button variant="outline" onClick={() => setShowAddMember(true)}>
              Add Member
            </Button>
          </div>
        </div>

        {/* Balances */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Balances</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {balances.map((b) => (
                <div key={b.userId} className="flex justify-between items-center">
                  <span className="text-sm">{b.name}</span>
                  <span
                    className={`font-medium text-sm ${
                      b.balance > 0
                        ? 'text-green-600'
                        : b.balance < 0
                          ? 'text-red-600'
                          : 'text-gray-500'
                    }`}
                  >
                    {b.balance > 0 ? 'is owed ' : b.balance < 0 ? 'owes ' : 'settled up'}
                    {b.balance !== 0 && formatCurrency(Math.abs(b.balance))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Simplified debts */}
        {debts.length > 0 && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-blue-800 mb-2">Who owes whom:</p>
              <div className="space-y-1">
                {debts.map((d, i) => (
                  <p key={i} className="text-sm text-blue-700">
                    {d.fromUserName} owes <strong>{formatCurrency(d.amount)}</strong> to{' '}
                    {d.toUserName}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Members</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-sm"
                >
                  {m.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expenses</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {expenses.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                description="Add your first expense to start tracking!"
                action={
                  <Button onClick={() => navigate(`/groups/${groupId}/expenses/new`)}>
                    Add Expense
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="font-medium">{expense.description}</p>
                          <p className="text-sm text-gray-500">
                            Paid by {expense.paid_by_name} · {formatDate(expense.expense_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{formatCurrency(expense.amount)}</span>
                          <button
                            onClick={() => navigate(`/groups/${groupId}/expenses/${expense.id}/edit`)}
                            className="text-xs text-gray-400 hover:text-blue-600 underline"
                            title="Edit expense"
                          >
                            edit
                          </button>
                        </div>
                      </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {expense.splits.map((split) => (
                        <span
                          key={split.id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100"
                        >
                          {split.name}: {formatCurrency(split.amount)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {showAddMember && (
        <AddMemberDialog
          groupId={groupId}
          onClose={() => setShowAddMember(false)}
          onAdded={loadData}
        />
      )}
    </div>
  );
}
