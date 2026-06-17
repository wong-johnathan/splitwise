import { useState } from 'react';
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
  onSelect: (id: number | '') => void;
  /** IDs used for "recent" ordering — most recent first */
  recentIds?: number[];
}

const RECENT_LIMIT = 8;

export default function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  recentIds,
}: CategoryPickerProps) {
  const [showModal, setShowModal] = useState(false);

  // Order categories: recent first, then rest, limited to RECENT_LIMIT for the pills
  const orderedForDisplay = [...categories].sort((a, b) => {
    if (!recentIds) return a.name.localeCompare(b.name);
    const aIdx = recentIds.indexOf(a.id);
    const bIdx = recentIds.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  const recentPills = orderedForDisplay.slice(0, RECENT_LIMIT);
  const hasMore = categories.length > RECENT_LIMIT;

  const isNoneSelected = selectedId === '';

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

        {/* "All categories" pill (only when there are more than fit in pills) */}
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            +{categories.length - RECENT_LIMIT} more
          </button>
        )}
      </div>

      {/* Selected category label */}
      {selectedCategory && !isNoneSelected && (
        <p className="text-xs text-gray-400">
          Selected: {selectedCategory.icon && `${selectedCategory.icon} `}{selectedCategory.name}
        </p>
      )}

      {/* Modal: full category list */}
      <Dialog open={showModal} onClose={() => setShowModal(false)}>
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

          <div className="border-t pt-3 text-center">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium py-1"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
