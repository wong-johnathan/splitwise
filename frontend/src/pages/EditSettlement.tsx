import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
import { formatCurrency, toLocalDatetimeString } from '@/lib/utils';

export default function EditSettlement() {
  const { groupId: groupIdParam, paymentId: paymentIdParam } = useParams<{
    groupId: string;
    paymentId: string;
  }>();
  const navigate = useNavigate();
  const groupId = parseInt(groupIdParam || '0');
  const paymentId = parseInt(paymentIdParam || '0');

  const [groupName, setGroupName] = useState('');
  const [fromName, setFromName] = useState('');
  const [toName, setToName] = useState('');
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toLocalDatetimeString(new Date()));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!groupId || !paymentId) return;

    Promise.all([api.getGroup(groupId)])
      .then(([groupData]) => {
        setGroupName(groupData.group.name);
      })
      .catch(console.error);

    // Fetch payment from the group's payment list
    api.getPayments(groupId)
      .then((data) => {
        const payment = data.payments.find((p: any) => p.id === paymentId);
        if (!payment) {
          setError('Payment not found');
          setLoading(false);
          return;
        }
        setAmount(String(payment.amount));
        setNote(payment.note || '');
        setFromName(payment.from_name);
        setToName(payment.to_name);
        if (payment.date) {
          setDate(toLocalDatetimeString(new Date(payment.date)));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load payment');
        setLoading(false);
      });
  }, [groupId, paymentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      await api.updatePayment(paymentId, {
        amount: numAmount,
        note: note.trim() || undefined,
        date: date || undefined,
      });
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update settlement');
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
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Card>
          <CardHeader>
            <CardTitle>Edit Settlement</CardTitle>
            <CardDescription>
              {groupName} &middot; {fromName} paid {toName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                  {error}
                </div>
              )}

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
                <Label>Note</Label>
                <Input
                  placeholder="e.g. Paid via bank transfer"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <p className="text-xs text-gray-400">Defaults to now if left as-is</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting || !amount}>
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
