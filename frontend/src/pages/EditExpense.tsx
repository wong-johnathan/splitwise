import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
import { formatCurrency } from '@/lib/utils';

interface Member {
  id: number;
  name: string;
}

type SplitMethod = 'equal' | 'percentage' | 'custom';

export default function EditExpense() {
  const { groupId: groupIdParam, expenseId: expenseIdParam } = useParams<{
    groupId: string;
    expenseId: string;
  }>();
  const navigate = useNavigate();
  const groupId = parseInt(groupIdParam || '0');
  const expenseId = parseInt(expenseIdParam || '0');

  const [members, setMembers] = useState<Member[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [expenseLoading, setExpenseLoading] = useState(true);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<number | ''>('');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [checkedMembers, setCheckedMembers] = useState<Set<number>>(new Set());
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [percentSplits, setPercentSplits] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!groupId || !expenseId) return;

    Promise.all([api.getGroup(groupId), api.getExpense(expenseId)])
      .then(([groupData, expenseData]) => {
        const ms = groupData.members;
        const exp = expenseData.expense;
        const splits = expenseData.splits;

        setMembers(ms);
        setGroupName(groupData.group.name);

        // Pre-populate form
        setDescription(exp.description);
        setAmount(String(exp.amount));
        setPaidBy(exp.paid_by);
        setSplitMethod(exp.split_method || 'equal');

        // Determine which members were included in the split
        const splitUserIds = new Set(splits.map((s: any) => s.user_id));
        const checked = new Set(
          ms
            .filter((m: Member) => splitUserIds.has(m.id))
            .map((m: Member) => m.id)
        );
        setCheckedMembers(checked);

        // Pre-fill custom or percentage splits
        const customMap: Record<number, string> = {};
        const pctMap: Record<number, string> = {};
        for (const split of splits) {
          customMap[split.user_id] = String(split.amount);
          if (split.percentage != null) {
            pctMap[split.user_id] = String(split.percentage);
          }
        }
        setCustomSplits(customMap);
        setPercentSplits(pctMap);

        setExpenseLoading(false);
        setLoading(false);
      })
      .catch(console.error);
  }, [groupId, expenseId]);

  const toggleMember = (memberId: number) => {
    setCheckedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const numAmount = parseFloat(amount) || 0;
  const checkedList = members.filter((m) => checkedMembers.has(m.id));
  const checkedCount = checkedList.length;

  const getEqualPreview = () => {
    if (!numAmount || checkedCount === 0) return [];
    const share = numAmount / checkedCount;
    return checkedList.map((m) => ({ name: m.name, amount: share }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!paidBy) {
      setError('Please select who paid');
      return;
    }
    if (checkedCount === 0) {
      setError('At least one person must be included in the split');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        description: description.trim(),
        amount: numAmount,
        splitMethod,
        paidBy,
        memberIds: [...checkedMembers],
      };

      if (splitMethod === 'custom') {
        payload.splits = Object.entries(customSplits)
          .filter(([uid, val]) => checkedMembers.has(parseInt(uid)) && val && parseFloat(val) > 0)
          .map(([uid, val]) => ({
            userId: parseInt(uid),
            amount: parseFloat(val),
          }));

        const totalSplit = payload.splits.reduce((sum: number, s: any) => sum + s.amount, 0);
        if (Math.abs(totalSplit - numAmount) > 0.01) {
          setError(`Split total (${formatCurrency(totalSplit)}) doesn't match amount (${formatCurrency(numAmount)})`);
          setSubmitting(false);
          return;
        }
      }

      if (splitMethod === 'percentage') {
        const entries = checkedList.map((m) => ({
          userId: m.id,
          percentage: parseFloat(percentSplits[m.id] || '0'),
        }));
        const totalPct = entries.reduce((sum, e) => sum + e.percentage, 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          setError(`Percentages must add up to 100% (currently ${totalPct}%)`);
          setSubmitting(false);
          return;
        }
        payload.splits = entries.map((e) => ({
          userId: e.userId,
          percentage: e.percentage,
          amount: Math.round((e.percentage / 100) * numAmount * 100) / 100,
        }));
      }

      await api.updateExpense(expenseId, payload);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update expense');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Edit Expense</CardTitle>
            <CardDescription>{groupName}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label>Description *</Label>
                <Input
                  placeholder="e.g. Dinner at beach club"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Amount ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Paid by *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={paidBy}
                  onChange={(e) => {
                    const newPayer = parseInt(e.target.value);
                    setPaidBy(newPayer);
                  }}
                  required
                >
                  <option value="">Select who paid...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Member selection */}
              <div className="space-y-2">
                <Label>Split among</Label>
                <div className="border rounded-lg p-3 space-y-1">
                  {members.map((m) => {
                    const isPayer = m.id === paidBy;
                    const checked = checkedMembers.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer text-sm hover:bg-gray-50`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(m.id)}
                          className="rounded"
                        />
                        <span>{m.name}</span>
                        {isPayer && <span className="text-xs text-blue-500 ml-1">(paid)</span>}
                      </label>
                    );
                  })}
                  {checkedCount === 0 && (
                    <p className="text-xs text-red-500">Select at least one person</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Split method</Label>
                <div className="flex gap-2">
                  {(['equal', 'percentage', 'custom'] as SplitMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      className={`flex-1 px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                        splitMethod === method
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white border-input hover:bg-accent'
                      }`}
                      onClick={() => setSplitMethod(method)}
                    >
                      {method === 'equal' ? 'Equal' : method === 'percentage' ? 'By %' : 'By $'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equal split preview */}
              {splitMethod === 'equal' && checkedCount > 0 && numAmount > 0 && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <p className="text-sm font-medium mb-2">
                    Split equally among {checkedCount}:
                  </p>
                  {getEqualPreview().map((s, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span>{s.name}</span>
                      <span className="font-medium">{formatCurrency(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Percentage split inputs */}
              {splitMethod === 'percentage' && checkedCount > 0 && (
                <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                  <p className="text-sm font-medium">Split by percentage:</p>
                  {checkedList.map((m) => {
                    const pct = parseFloat(percentSplits[m.id] || '0');
                    const dollarAmount = pct > 0 && numAmount > 0 ? (pct / 100) * numAmount : 0;
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <span className="text-sm flex-1">{m.name}</span>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="0"
                          className="w-20 h-8 text-sm"
                          value={percentSplits[m.id] || ''}
                          onChange={(e) =>
                            setPercentSplits((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                        />
                        <span className="text-xs text-gray-500 w-4">%</span>
                        <span className="text-xs text-gray-400 w-16 text-right">
                          {formatCurrency(dollarAmount)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span>
                      Total:{' '}
                      {Object.values(percentSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0)}%
                    </span>
                    <span className={numAmount > 0 ? 'text-blue-600' : ''}>
                      {formatCurrency(
                        Object.values(percentSplits).reduce(
                          (s, v) => s + ((parseFloat(v) || 0) / 100) * numAmount,
                          0
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Custom $ split inputs */}
              {splitMethod === 'custom' && (
                <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                  <p className="text-sm font-medium">Custom amounts ($):</p>
                  {checkedList.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="text-sm flex-1">{m.name}</span>
                      <span className="text-gray-400">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="w-24 h-8 text-sm"
                        value={customSplits[m.id] || ''}
                        onChange={(e) =>
                          setCustomSplits((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                  {numAmount > 0 && (
                    <div className="flex justify-between text-xs pt-1 border-t">
                      <span>
                        Total: $
                        {Object.values(customSplits)
                          .reduce((s, v) => s + (parseFloat(v) || 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting || !description || !amount || !paidBy}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(`/groups/${groupId}`)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
