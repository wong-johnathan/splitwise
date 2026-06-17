import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading';
import { formatCurrency, toLocalDatetimeString, toUtcIsoString } from '@/lib/utils';
import CategoryPicker from '@/components/CategoryPicker';
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from '@/lib/currencies';

interface Member {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
}

type SplitMethod = 'equal' | 'percentage' | 'custom';

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
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [checkedMembers, setCheckedMembers] = useState<Set<number>>(new Set());
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [percentSplits, setPercentSplits] = useState<Record<number, string>>({});
  const [date, setDate] = useState(toLocalDatetimeString(new Date()));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Category state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [recentCategoryIds, setRecentCategoryIds] = useState<number[]>([]);

  // Multi-currency state
  const [baseCurrency, setBaseCurrency] = useState('SGD');
  const [isMultiCurrency, setIsMultiCurrency] = useState(false);
  const [currency, setCurrency] = useState('SGD');
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [currenciesWithRates, setCurrenciesWithRates] = useState<{ code: string; rate: number }[]>([]);

  useEffect(() => {
    if (!groupId) return;

    Promise.all([api.getGroup(groupId), api.getCategories(groupId)])
      .then(([groupData, catData]) => {
        const ms = groupData.members;
        setMembers(ms);
        setGroupName(groupData.group.name);
        setCategories(catData.categories);
        const baseCcy = groupData.group.base_currency || 'SGD';
        setBaseCurrency(baseCcy);
        setCurrency(baseCcy);
        setIsMultiCurrency(groupData.group.multi_currency || false);
        if (ms.length > 0) {
          const firstId = ms[0].id;
          setPaidBy(firstId);
          setCheckedMembers(new Set(ms.map((m: Member) => m.id)));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [groupId]);

  // Fetch rates when currency changes (multi-currency only)
  useEffect(() => {
    if (!isMultiCurrency) return;
    api.getCurrencies(baseCurrency)
      .then(data => {
        setCurrenciesWithRates(data.currencies);
        const found = data.currencies.find((c: any) => c.code === currency);
        if (found) setFxRate(found.rate);
      })
      .catch(() => {});
  }, [currency, baseCurrency, isMultiCurrency]);

  // When paidBy changes, ensure all members stay checked
  useEffect(() => {
    if (!paidBy || members.length === 0) return;
    const newChecked = new Set(checkedMembers);
    // Ensure every member has a state
    members.forEach((m) => {
      if (!newChecked.has(m.id) && newChecked.size > 0) {
        // Member hasn't been explicitly unchecked yet, add them
        newChecked.add(m.id);
      }
    });
    setCheckedMembers(newChecked);
  }, [paidBy]);

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

  const getPercentPreview = () => {
    if (!numAmount || checkedCount === 0) return [];
    return checkedList.map((m) => {
      const pct = parseFloat(percentSplits[m.id] || '0');
      return { name: m.name, amount: pct > 0 ? (pct / 100) * numAmount : 0 };
    });
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
      const utcDate = toUtcIsoString(date);
      const payload: any = {
        groupId,
        description: description.trim(),
        amount: numAmount,
        splitMethod,
        paidBy,
        memberIds: [...checkedMembers],
        date: utcDate,
        categoryId: categoryId || undefined,
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

      await api.createExpense({
        ...payload,
        currency: isMultiCurrency ? currency : undefined,
        fxRate: isMultiCurrency && fxRate ? fxRate : undefined,
      });
      // Track the selected category as recently used
      if (categoryId) {
        setRecentCategoryIds((prev) => [categoryId, ...prev.filter((id) => id !== categoryId)]);
      }
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create expense');
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

              {/* Currency selector (multi-currency only) */}
              {isMultiCurrency && (
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name} ({c.symbol})
                      </option>
                    ))}
                  </select>
                  {fxRate && currency !== baseCurrency && (
                    <p className="text-xs text-gray-500">
                      1 {currency} = {fxRate.toFixed(6)} {baseCurrency}
                      {numAmount > 0 && (
                        <span className="ml-2 font-medium text-gray-700">
                          ≈ {getCurrencySymbol(baseCurrency)}{(numAmount * fxRate).toFixed(2)} {baseCurrency}
                        </span>
                      )}
                    </p>
                  )}
                  {currency === baseCurrency && (
                    <p className="text-xs text-gray-400">Same as group base currency ({baseCurrency})</p>
                  )}
                </div>
              )}

              {/* Category picker */}
              <CategoryPicker
                categories={categories}
                selectedId={categoryId}
                onSelect={(id) => {
                  setCategoryId(id);
                }}
                recentIds={recentCategoryIds}
              />

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

              <div className="space-y-2">
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <p className="text-xs text-gray-400">Defaults to now if left as-is</p>
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
