import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface User {
  id: number;
  name: string;
  email: string;
}

interface AddMemberDialogProps {
  groupId: number;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddMemberDialog({ groupId, onClose, onAdded }: AddMemberDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [adding, setAdding] = useState<number | null>(null);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    setSearchError('');
    try {
      const data = await api.searchUsers(q);
      setResults(data.users);
    } catch {
      setSearchError('Failed to search users');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, search]);

  const handleAdd = async (userId: number) => {
    setAdding(userId);
    try {
      await api.addGroupMember(groupId, userId);
      onAdded();
      onClose();
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : 'Failed to add member');
      setAdding(null);
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />

        {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}

        <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
          {searching ? (
            <p className="text-sm text-gray-500 py-2 text-center">Searching...</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500 py-2 text-center">
              {searchQuery ? 'No users found' : 'Type to search users'}
            </p>
          ) : (
            results.map((user) => (
              <button
                key={user.id}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-100 text-left"
                onClick={() => handleAdd(user.id)}
                disabled={adding === user.id}
              >
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                {adding === user.id && (
                  <span className="text-xs text-gray-400">Adding...</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
