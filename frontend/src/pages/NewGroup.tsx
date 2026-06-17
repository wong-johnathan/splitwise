import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';

interface User {
  id: number;
  name: string;
  email: string;
}

export default function NewGroup() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('SGD');
  const [multiCurrency, setMultiCurrency] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const navigate = useNavigate();

  const searchMembers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setMemberResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await api.searchUsers(q);
      setMemberResults(
        data.users.filter((u) => !selectedMembers.some((s) => s.id === u.id))
      );
    } catch {
      setMemberResults([]);
    } finally {
      setSearching(false);
    }
  }, [selectedMembers]);

  useEffect(() => {
    const timer = setTimeout(() => searchMembers(memberSearch), 300);
    return () => clearTimeout(timer);
  }, [memberSearch, searchMembers]);

  const addMember = (user: User) => {
    setSelectedMembers((prev) => [...prev, user]);
    setMemberResults((prev) => prev.filter((u) => u.id !== user.id));
    setMemberSearch('');
  };

  const removeMember = (id: number) => {
    setSelectedMembers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: selectedMembers.map((m) => m.id),
        baseCurrency,
        multiCurrency,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create Group</CardTitle>
            <CardDescription>
              Start a group to split expenses with friends, roommates, or travel buddies.
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
                <label className="text-sm font-medium">Group Name *</label>
                <Input
                  placeholder="e.g. Trip to Bali"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (optional)</label>
                <Input
                  placeholder="e.g. Bali trip in June 2025"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Base Currency */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Base Currency</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-currency toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={multiCurrency}
                  onClick={() => setMultiCurrency(!multiCurrency)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    multiCurrency ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition-transform ${
                      multiCurrency ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <label className="text-sm font-medium cursor-pointer" onClick={() => setMultiCurrency(!multiCurrency)}>
                  Multi-currency expenses — allow expenses in different currencies
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Add Members (optional)</label>

                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedMembers.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-sm"
                      >
                        {m.name}
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 leading-none"
                          onClick={() => removeMember(m.id)}
                          aria-label={`Remove ${m.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <Input
                  placeholder="Search members to add..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />

                {memberSearch.trim() && (
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {searching ? (
                      <p className="text-sm text-gray-500 py-2 text-center">Searching...</p>
                    ) : memberResults.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2 text-center">No users found</p>
                    ) : (
                      memberResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full flex items-center px-3 py-2 hover:bg-gray-50 text-left"
                          onClick={() => addMember(user)}
                        >
                          <div>
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading || !name.trim()}>
                  {loading ? 'Creating...' : 'Create Group'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
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
