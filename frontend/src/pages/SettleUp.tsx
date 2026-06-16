import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Debt {
  fromUser: number;
  fromUserName: string;
  toUser: number;
  toUserName: string;
  amount: number;
}

interface Payment {
  id: number;
  from_user: number;
  from_name: string;
  to_user: number;
  to_name: string;
  amount: number;
  note: string | null;
  date: string;
}

export default function SettleUp() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const groupId = parseInt(id || '0');

  const [groupName, setGroupName] = useState('');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([api.getGroup(groupId), api.getPayments(groupId)])
      .then(([groupData, paymentData]) => {
        setGroupName(groupData.group.name);
        setDebts(groupData.debts);
        setPayments(paymentData.payments);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!groupId) return;
    fetchData();
  }, [groupId]);

  const handleSettle = async () => {
    if (!selectedDebt) return;
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPayment({
        groupId,
        toUser: selectedDebt.toUser,
        amount: numAmount,
        note: note.trim() || undefined,
      });
      setSuccess(true);
      setAmount('');
      setNote('');
      setSelectedDebt(null);
      fetchData();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record payment');
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

  const userDebts = debts.filter((d) => d.fromUser);
  const userOwed = debts.filter((d) => d.toUser);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Settle Up</h2>
            <p className="text-sm text-gray-500">{groupName}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/groups/${groupId}`)}>
            Back to Group
          </Button>
        </div>

        {success && (
          <div className="mb-4 p-3 text-sm text-green-700 bg-green-50 rounded-md border border-green-200">
            ✅ Payment recorded successfully!
          </div>
        )}

        {/* Debts summary */}
        {debts.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
              <CardDescription>Simplified debts within this group</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {debts.map((d, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDebt === d
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedDebt(d);
                      setAmount(d.amount.toFixed(2));
                      setError('');
                    }}
                  >
                    <p className="text-sm">
                      <span className="font-medium">{d.fromUserName}</span> owes{' '}
                      <span className="font-bold">{formatCurrency(d.amount)}</span> to{' '}
                      <span className="font-medium">{d.toUserName}</span>
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {debts.length === 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <EmptyState
                title="All settled up!"
                description="No one owes anyone in this group."
              />
            </CardContent>
          </Card>
        )}

        {/* Record payment */}
        {selectedDebt && (
          <Card className="mb-6 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">
                Pay {selectedDebt.toUserName}
              </CardTitle>
              <CardDescription>
                You're recording that {selectedDebt.fromUserName} is paying{' '}
                {selectedDebt.toUserName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-3 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                  {error}
                </div>
              )}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="e.g. Paid via bank transfer"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSettle} disabled={submitting}>
                    {submitting ? 'Recording...' : 'Record Payment'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedDebt(null);
                      setAmount('');
                      setError('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">{p.from_name}</span> paid{' '}
                        <span className="font-medium">{p.to_name}</span>
                      </p>
                      {p.note && (
                        <p className="text-xs text-gray-500">{p.note}</p>
                      )}
                      <p className="text-xs text-gray-400">{formatDate(p.date)}</p>
                    </div>
                    <span className="font-bold">{formatCurrency(p.amount)}</span>
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
