import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDateTime, toLocalDatetimeString } from '@/lib/utils';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

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
  created_at: string;
}

export default function SettleUp() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const groupId = parseInt(id || '0');
  const { user } = useAuth();

  const [groupName, setGroupName] = useState('');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [settleDirection, setSettleDirection] = useState<'paying' | 'receiving'>('paying');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toLocalDatetimeString(new Date()));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const userId = user?.id;

  // Filter to debts involving the current user only
  const debtsOwedToMe = debts.filter((d) => userId && d.toUser === userId);
  const debtsIOwe = debts.filter((d) => userId && d.fromUser === userId);

  const handleSelectDebt = (d: Debt) => {
    if (!userId) return;
    if (d.toUser === userId) {
      // Someone owes me — they are paying me
      setSettleDirection('receiving');
    } else {
      // I owe someone — I am paying them
      setSettleDirection('paying');
    }
    setSelectedDebt(d);
    setAmount(d.amount.toFixed(2));
    setError('');
  };

  const handleSettle = async () => {
    if (!selectedDebt || !userId) return;
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      if (settleDirection === 'paying') {
        // I owe them → I pay them
        await api.createPayment({
          groupId,
          toUser: selectedDebt.toUser,
          amount: numAmount,
          note: note.trim() || undefined,
          date: date || undefined,
        });
      } else {
        // They owe me → they pay me
        await api.createPayment({
          groupId,
          fromUser: selectedDebt.fromUser,
          toUser: userId,
          amount: numAmount,
          note: note.trim() || undefined,
          date: date || undefined,
        });
      }
      setSuccess(true);
      setAmount('');
      setNote('');
      setDate(toLocalDatetimeString(new Date()));
      setSelectedDebt(null);
      fetchData();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm('Delete this settlement? This cannot be undone.')) return;
    setDeletingId(paymentId);
    try {
      await api.deletePayment(paymentId);
      setDeletingId(null);
      fetchData();
    } catch (err) {
      setDeletingId(null);
      alert('Failed to delete settlement.');
    }
  };

  const involvedDebts = [...debtsOwedToMe, ...debtsIOwe];

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
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Settle Up</h2>
            <p className="text-xs sm:text-sm text-gray-500">{groupName}</p>
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

        {/* People who owe me */}
        {debtsOwedToMe.length > 0 && (
          <Card className="mb-4 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-700">People who owe you</CardTitle>
              <CardDescription>Click to record them paying you back</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {debtsOwedToMe.map((d, i) => (
                  <div
                    key={`owed-${i}`}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDebt === d
                        ? 'border-green-500 bg-green-50'
                        : 'border-green-100 hover:bg-green-50'
                    }`}
                    onClick={() => handleSelectDebt(d)}
                  >
                    <p className="text-sm">
                      <span className="font-medium">{d.fromUserName}</span> owes you{' '}
                      <span className="font-bold">{formatCurrency(d.amount)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* People I owe */}
        {debtsIOwe.length > 0 && (
          <Card className="mb-4 border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-red-700">You owe</CardTitle>
              <CardDescription>Click to record your payment to them</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {debtsIOwe.map((d, i) => (
                  <div
                    key={`owe-${i}`}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDebt === d
                        ? 'border-red-500 bg-red-50'
                        : 'border-red-100 hover:bg-red-50'
                    }`}
                    onClick={() => handleSelectDebt(d)}
                  >
                    <p className="text-sm">
                      You owe{' '}
                      <span className="font-medium">{d.toUserName}</span>{' '}
                      <span className="font-bold">{formatCurrency(d.amount)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {involvedDebts.length === 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <EmptyState
                title="All settled up!"
                description="You don't owe anyone and no one owes you in this group."
              />
            </CardContent>
          </Card>
        )}

        {/* Record payment */}
        {selectedDebt && (
          <Card className="mb-6 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">
                {settleDirection === 'paying'
                  ? `Pay ${selectedDebt.toUserName}`
                  : `Record ${selectedDebt.fromUserName}'s payment to you`}
              </CardTitle>
              <CardDescription>
                {settleDirection === 'paying'
                  ? `Recording that you're paying ${selectedDebt.toUserName}$${selectedDebt.amount.toFixed(2)}`
                  : `Recording that ${selectedDebt.fromUserName} is paying you back`}
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
                <div className="space-y-2">
                  <Label>Settlement Date/Time</Label>
                  <Input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
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
                  <div key={p.id}>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">{p.from_name}</span> paid{' '}
                          <span className="font-medium">{p.to_name}</span>
                        </p>
                        {p.note && (
                          <p className="text-xs text-gray-500">{p.note}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDateTime(p.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-bold whitespace-nowrap">{formatCurrency(p.amount)}</span>
                        <button
                          onClick={() => navigate(`/groups/${groupId}/payments/${p.id}/edit`)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                          title="Edit payment"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          disabled={deletingId === p.id}
                          className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Delete payment"
                        >
                          {deletingId === p.id ? <span className="text-xs">...</span> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
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
