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

export default function NewExpense() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const groupId = parseInt(id || '0');

  const [members, setMembers] = useState<Member[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<number | ''>('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    api
      .getGroup(groupId)
      .then((data) => {
        setMembers(data.members);
        setGroupName(data.group.name);
        if (data.members.length > 0) {
          setPaidBy(data.members[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [groupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!paidBy) {
      setError('Please select who paid');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        groupId,
        description: description.trim(),
        amount: numAmount,
        splitMethod,
        paidBy,
      };

      if (splitMethod === 'custom') {
        payload.splits = Object.entries(customSplits)
          .filter(([_, val]) => val && parseFloat(val) > 0)
          .map(([userId, val]) => ({
            userId: parseInt(userId),
            amount: parseFloat(val),
          }));

        const totalSplit = payload.splits.reduce((sum: number, s: any) => sum + s.amount, 0);
        if (Math.abs(totalSplit - numAmount) > 0.01) {
          setError(`Split total (${formatCurrency(totalSplit)}) doesn't match amount (${formatCurrency(numAmount)})`);
          setSubmitting(false);
          return;
        }
      }

      await api.createExpense(payload);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  const getSplitPreview = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || members.length === 0) return null;
    const share = numAmount / members.length;
    return members.map((m) => ({
      name: m.name,
      amount: share,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <LoadingSpinner className="min-h-[60vh]" />
      </div>
    );
  }

  const splitPreview = getSplitPreview();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Add Expense</CardTitle>
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
                  onChange={(e) => setPaidBy(parseInt(e.target.value))}
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

              <div className="space-y-2">
                <Label>Split method</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                      splitMethod === 'equal'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white border-input hover:bg-accent'
                    }`}
                    onClick={() => setSplitMethod('equal')}
                  >
                    Equal
                  </button>
                  <button
                    type="button"
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                      splitMethod === 'custom'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white border-input hover:bg-accent'
                    }`}
                    onClick={() => setSplitMethod('custom')}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {splitMethod === 'equal' && splitPreview && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <p className="text-sm font-medium mb-2">Split preview:</p>
                  {splitPreview.map((s, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span>{s.name}</span>
                      <span className="font-medium">{formatCurrency(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {splitMethod === 'custom' && (
                <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                  <p className="text-sm font-medium">Custom splits:</p>
                  {members.map((m) => (
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
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting || !description || !amount || !paidBy}>
                  {submitting ? 'Adding...' : 'Add Expense'}
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
