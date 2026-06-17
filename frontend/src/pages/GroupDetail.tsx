import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/hooks/use-auth';
import { useGroupRealtime } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import AddMemberDialog from '@/components/AddMemberDialog';

interface Expense {
  id: number;
  type?: string;
  description: string;
  amount: number;
  paid_by: number;
  paid_by_name: string;
  split_method: string;
  expense_date: string;
  created_at: string;
  note?: string;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
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
  const { user } = useAuth();

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Edit settlement state
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const groupId = parseInt(id || '0');
  const userId = user?.id;

  // Real-time updates via WebSocket
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : undefined;
  useGroupRealtime(groupId, token || undefined, useCallback((event) => {
    // Any real-time event → refetch data
    if (!groupId) return;
    Promise.all([api.getGroup(groupId), api.getExpenses(groupId)])
      .then(([groupData, expenseData]) => {
        setGroup(groupData.group);
        setMembers(groupData.members);
        setBalances(groupData.balances);
        setDebts(groupData.debts);
        setExpenses(expenseData.expenses);
      })
      .catch(console.error);
  }, [groupId]));

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

  const handleDeleteExpense = async (expenseId: number) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    setDeletingId(expenseId);
    try {
      await api.deleteExpense(expenseId);
      loadData();
    } catch (err) {
      console.error('Delete expense error:', err);
      alert('Failed to delete expense. You may not be the payer.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm('Delete this settlement? This cannot be undone.')) return;
    setDeletingId(paymentId);
    try {
      await api.deletePayment(paymentId);
      loadData();
    } catch (err) {
      console.error('Delete payment error:', err);
      alert('Failed to delete settlement.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditPaymentSave = async (paymentId: number) => {
    setEditError('');
    setEditSubmitting(true);
    try {
      await api.updatePayment(paymentId, {
        amount: parseFloat(editAmount),
        note: editNote,
        date: editDate,
      });
      setEditPaymentId(null);
      loadData();
    } catch (err) {
      setEditError('Failed to update settlement.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Delete "${group?.name}" and all its data? This cannot be undone.`)) return;
    try {
      await api.deleteGroup(groupId);
      navigate('/dashboard');
    } catch (err) {
      console.error('Delete group error:', err);
      alert('Failed to delete group. Only the group creator can delete it.');
    }
  };

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
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">{group.name}</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              {members.length} member{members.length !== 1 ? 's' : ''}
              {group.description && ` · ${group.description}`}
            </p>
          </div>
          <div className="action-row">
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

        {/* Expenses & Settlements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {expenses.length === 0 ? (
              <EmptyState
                title="No transactions yet"
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
                    key={`${expense.type || 'expense'}-${expense.id}`}
                    className={`border rounded-lg p-3 transition-colors ${
                      expense.type === 'payment'
                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {expense.type === 'payment' ? (
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                              Settlement
                            </span>
                            <p className="font-medium">{expense.description}</p>
                          </div>
                          {expense.note && (
                            <p className="text-sm text-gray-500">{expense.note}</p>
                          )}
                          <p className="text-sm text-gray-400">{formatDateTime(expense.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-green-700">{formatCurrency(expense.amount)}</span>
                          <button
                            onClick={() => {
                              setEditPaymentId(expense.id);
                              setEditAmount(String(expense.amount));
                              setEditNote(expense.note || '');
                              setEditDate(expense.created_at?.slice(0, 16) || new Date().toISOString().slice(0, 16));
                              setEditError('');
                            }}
                            className="text-xs text-gray-400 hover:text-blue-600 underline"
                            title="Edit settlement"
                          >
                            edit
                          </button>
                          <button
                            onClick={() => handleDeletePayment(expense.id)}
                            disabled={deletingId === expense.id}
                            className="text-xs text-gray-400 hover:text-red-600 underline"
                            title="Delete settlement"
                          >
                            {deletingId === expense.id ? '...' : 'delete'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{expense.description}</p>
                            {expense.category_name && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border"
                                style={{
                                  color: expense.category_color || '#6B7280',
                                  borderColor: expense.category_color || '#6B7280',
                                  backgroundColor: `${expense.category_color || '#6B7280'}15`,
                                }}
                              >
                                {expense.category_icon && <span>{expense.category_icon}</span>}
                                {expense.category_name}
                              </span>
                            )}
                          </div>
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
                          {userId === expense.paid_by && (
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              disabled={deletingId === expense.id}
                              className="text-xs text-gray-400 hover:text-red-600 underline"
                              title="Delete expense"
                            >
                              {deletingId === expense.id ? '...' : 'delete'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {expense.type === 'payment' && editPaymentId === expense.id && (
                      <div className="mt-3 border border-blue-200 rounded-lg bg-blue-50 p-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-600">Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-28"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs text-gray-600">Note</label>
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-600">Date/Time</label>
                            <input
                              type="datetime-local"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                        </div>
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditPaymentSave(expense.id)}
                            disabled={editSubmitting}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {editSubmitting ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditPaymentId(null)}
                            className="text-xs text-gray-600 hover:text-gray-800 underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {expense.type !== 'payment' && (
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
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete group */}
        <div className="mt-8 text-center">
          <button
            onClick={handleDeleteGroup}
            className="text-xs text-red-400 hover:text-red-600 underline"
          >
            Delete this group and all its data
          </button>
        </div>
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
