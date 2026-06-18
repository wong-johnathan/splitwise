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
import { formatCurrencyByCode, SUPPORTED_CURRENCIES, getCurrencySymbol } from '@/lib/currencies';
import { Pencil, Trash2 } from 'lucide-react';
import AddMemberDialog from '@/components/AddMemberDialog';
import ActivityFeed from '@/components/ActivityFeed';
import SpendingBreakdown from '@/components/SpendingBreakdown';
import CollapsibleCard from '@/components/CollapsibleCard';

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
  currency?: string;
  amount_in_base?: number;
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
  const [perCurrencyBalances, setPerCurrencyBalances] = useState<any[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [baseCurrency, setBaseCurrency] = useState('SGD');
  const [isMultiCurrency, setIsMultiCurrency] = useState(false);

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
    api.getActivityLogs(groupId).then(data => setActivityLogs(data.activityLogs)).catch(console.error);
  }, [groupId]));

  const loadData = useCallback(() => {
    if (!groupId) return;

    Promise.all([api.getGroup(groupId), api.getExpenses(groupId)])
      .then(([groupData, expenseData]) => {
        setGroup(groupData.group);
        setMembers(groupData.members);
        setBalances(groupData.balances);
        setPerCurrencyBalances(groupData.perCurrencyBalances || []);
        setDebts(groupData.debts);
        setExpenses(expenseData.expenses);
        setBaseCurrency(groupData.group.base_currency || 'SGD');
        setIsMultiCurrency(groupData.group.multi_currency || false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    api.getActivityLogs(groupId).then(data => setActivityLogs(data.activityLogs)).catch(console.error);
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
      alert('Failed to delete expense.');
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
              {' · '}{getCurrencySymbol(baseCurrency)} {baseCurrency}
              {isMultiCurrency && ' · Multi-currency'}
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
        <CollapsibleCard title="Balances" storageKey="balances" defaultOpen={true}>
          {isMultiCurrency && perCurrencyBalances.length > 0 ? (
            (() => {
              // Group per-currency balances by user
              const userCurrencyMap = new Map<number, { name: string; balances: { currency: string; balance: number }[] }>();
              for (const pcb of perCurrencyBalances) {
                if (!userCurrencyMap.has(pcb.userId)) {
                  userCurrencyMap.set(pcb.userId, { name: pcb.name, balances: [] });
                }
                userCurrencyMap.get(pcb.userId)!.balances.push({ currency: pcb.currency, balance: pcb.balance });
              }
              return (
                <div className="space-y-3">
                  {Array.from(userCurrencyMap.values()).map(({ name, balances }) => (
                    <div key={name} className="text-sm">
                      <span className="font-medium">{name}</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {balances.filter(b => b.balance !== 0).map(b => (
                          <span
                            key={b.currency}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              b.balance > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {b.balance > 0 ? 'is owed ' : 'owes '}
                            {formatCurrencyByCode(Math.abs(b.balance), b.currency)}
                            {' '}{b.currency}
                          </span>
                        ))}
                        {balances.filter(b => b.balance !== 0).length === 0 && (
                          <span className="text-xs text-gray-400">settled up</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : (
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
          )}
        </CollapsibleCard>

        {/* Spending Breakdown */}
        {expenses.filter(e => e.type !== 'payment').length > 0 && (
          <CollapsibleCard title="Spending Breakdown" storageKey="spending_breakdown" defaultOpen={true}>
            <SpendingBreakdown expenses={expenses} members={members} />
          </CollapsibleCard>
        )}

        {/* Simplified debts */}
        {debts.length > 0 && (
          <CollapsibleCard title="Who Owes Whom" storageKey="debts" defaultOpen={true}>
            <p className="text-sm font-medium text-blue-800 mb-2">Simplified debts:</p>
            <div className="space-y-1">
              {debts.map((d, i) => (
                <p key={i} className="text-sm text-blue-700">
                  {d.fromUserName} owes <strong>{formatCurrency(d.amount)}</strong> to{' '}
                  {d.toUserName}
                </p>
              ))}
            </div>
          </CollapsibleCard>
        )}

        {/* Members */}
        <CollapsibleCard title="Members" storageKey="members" defaultOpen={true}>
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
        </CollapsibleCard>

        {/* Group Settings */}
        <CollapsibleCard title="Group Settings" storageKey="group_settings" defaultOpen={false}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Base Currency</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={baseCurrency}
                onChange={async (e) => {
                  const newCurrency = e.target.value;
                  try {
                    await api.updateGroup(groupId, { baseCurrency: newCurrency });
                    setBaseCurrency(newCurrency);
                    setGroup((prev: any) => ({ ...prev, base_currency: newCurrency }));
                  } catch (err) {
                    console.error('Failed to update base currency:', err);
                  }
                }}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">New expenses will use this as the default currency</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isMultiCurrency}
                onClick={async () => {
                  const newValue = !isMultiCurrency;
                  try {
                    await api.updateGroup(groupId, { multiCurrency: newValue });
                    setIsMultiCurrency(newValue);
                    setGroup((prev: any) => ({ ...prev, multi_currency: newValue }));
                  } catch (err) {
                    console.error('Failed to update multi-currency:', err);
                  }
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  isMultiCurrency ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition-transform ${
                    isMultiCurrency ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <label className="text-sm font-medium">
                Multi-currency expenses
              </label>
            </div>
            <p className="text-xs text-gray-400">Allow expenses in currencies other than the base</p>
          </div>
        </CollapsibleCard>

        {/* Expenses & Settlements */}
        <Card className="mb-6">
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                              Settlement
                            </span>
                            <p className="font-medium break-words">{expense.description}</p>
                          </div>
                          {expense.note && (
                            <p className="text-sm text-gray-500 break-words">{expense.note}</p>
                          )}
                          <p className="text-sm text-gray-400">{formatDateTime(expense.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-bold text-lg text-green-700 whitespace-nowrap">
                            {isMultiCurrency && expense.currency
                              ? formatCurrencyByCode(expense.amount, expense.currency)
                              : formatCurrency(expense.amount)}
                          </span>
                          <button
                            onClick={() => navigate(`/groups/${groupId}/payments/${expense.id}/edit`)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                            title="Edit settlement"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(expense.id)}
                            disabled={deletingId === expense.id}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Delete settlement"
                          >
                            {deletingId === expense.id ? <span className="text-xs">...</span> : <Trash2 size={14} />}
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
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-bold text-lg whitespace-nowrap">
                            {isMultiCurrency && expense.currency
                              ? formatCurrencyByCode(expense.amount, expense.currency)
                              : formatCurrency(expense.amount)}
                          </span>
                          <button
                            onClick={() => navigate(`/groups/${groupId}/expenses/${expense.id}/edit`)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                            title="Edit expense"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            disabled={deletingId === expense.id}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Delete expense"
                          >
                            {deletingId === expense.id ? <span className="text-xs">...</span> : <Trash2 size={14} />}
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

        <ActivityFeed logs={activityLogs} groupId={groupId} />

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
