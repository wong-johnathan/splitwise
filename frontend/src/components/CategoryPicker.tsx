import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
}

interface CategoryPickerProps {
  categories: Category[];
  selectedId: number | '';
  groupId: number;
  onSelect: (id: number | '') => void;
  onCategoriesChange: (categories: Category[]) => void;
  /** IDs used for "recent" ordering — most recent first */
  recentIds?: number[];
  /** Fires when a brand-new category is created (not just selected) */
  onNewCategory?: (categoryId: number) => void;
}

const RECENT_LIMIT = 8;

export default function CategoryPicker({
  categories,
  selectedId,
  groupId,
  onSelect,
  onCategoriesChange,
  recentIds,
  onNewCategory,
}: CategoryPickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  // Order categories: recent first, then rest, limited to RECENT_LIMIT for the pills
  const orderedForDisplay = [...categories].sort((a, b) => {
    if (!recentIds) return a.name.localeCompare(b.name);
    const aIdx = recentIds.indexOf(a.id);
    const bIdx = recentIds.indexOf(b.id);
    // Recent ones first (lower index = more recent)
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  const recentPills = orderedForDisplay.slice(0, RECENT_LIMIT);
  const hasMore = categories.length > RECENT_LIMIT;

  // No category option — first pill
  const isNoneSelected = selectedId === '';

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await api.createCategory({ groupId, name: newName.trim() });
      const updated = [...categories, res.category];
      onCategoriesChange(updated);
      onSelect(res.category.id);
      onNewCategory?.(res.category.id);
      setNewName('');
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create category');
    } finally {
      setAdding(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === selectedId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Category
      </label>

      {/* Pills row */}
      <div className="flex flex-wrap gap-1.5">
        {/* "None" pill */}
        <button
          type="button"
          onClick={() => onSelect('')}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            isNoneSelected
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          None
        </button>

        {/* Recent category pills */}
        {recentPills.map((cat) => {
          const isSelected = selectedId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(isSelected ? '' : cat.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? 'text-white border-transparent'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
              style={
                isSelected
                  ? { backgroundColor: cat.color, borderColor: cat.color }
                  : undefined
              }
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
            </button>
          );
        })}

        {/* "All categories" pill */}
        {(hasMore || categories.length > 0) && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            {hasMore ? `+${categories.length - RECENT_LIMIT} more` : 'All categories'}
          </button>
        )}

        {/* Quick-add pill */}
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
        >
          + New
        </button>
      </div>

      {/* Selected category label (for clarity when scrolling past the pills) */}
      {selectedCategory && !isNoneSelected && (
        <p className="text-xs text-gray-400">
          Selected: {selectedCategory.icon && `${selectedCategory.icon} `}{selectedCategory.name}
        </p>
      )}

      {/* Modal: full category list */}
      <Dialog open={showModal} onClose={() => { setShowModal(false); setShowNewForm(false); setNewName(''); setError(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a category</DialogTitle>
          </DialogHeader>

          <div className="max-h-64 overflow-y-auto space-y-1 mb-3 pr-1">
            <button
              type="button"
              onClick={() => { onSelect(''); setShowModal(false); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                isNoneSelected ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-gray-200 inline-flex items-center justify-center text-xs text-gray-500">—</span>
              No category
            </button>
            {categories.map((cat) => {
              const isSelected = selectedId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { onSelect(cat.id); setShowModal(false); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                    isSelected ? 'font-medium' : 'hover:bg-gray-50'
                  }`}
                  style={isSelected ? { backgroundColor: `${cat.color}15`, color: cat.color } : undefined}
                >
                  <span
                    className="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs text-white"
                    style={{ backgroundColor: cat.color }}
                  >
                    {cat.icon || '•'}
                  </span>
                  {cat.name}
                  {isSelected && <span className="ml-auto text-xs">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Add new category section */}
          {showNewForm ? (
            <div className="border-t pt-3 space-y-2">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Input
                  placeholder="Category name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 h-9 text-sm"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={handleAdd} disabled={adding || !newName.trim()}>
                  {adding ? 'Adding...' : 'Add'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewForm(false); setNewName(''); setError(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t pt-3">
              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-1.5 rounded-md hover:bg-blue-50 transition-colors"
              >
                + Add new category
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
