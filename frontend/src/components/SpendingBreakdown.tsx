import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';

interface Expense {
  id: number;
  type?: string;
  description: string;
  amount: number;
  paid_by: number;
  paid_by_name: string;
  category_name?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
}

interface Member {
  id: number;
  name: string;
  email: string;
}

interface Props {
  expenses: Expense[];
  members: Member[];
}

const PIE_COLORS = [
  '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F59E0B', '#10B981', '#14B8A6', '#6B7280',
  '#F97316', '#06B6D4', '#84CC16', '#A855F7',
];

const BAR_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

type ViewMode = 'category' | 'person';

export default function SpendingBreakdown({ expenses, members }: Props) {
  const [view, setView] = useState<ViewMode>('category');

  // Filter to only real expenses (not settlements)
  const realExpenses = useMemo(
    () => expenses.filter((e) => e.type !== 'payment'),
    [expenses]
  );

  // Spending by category
  const categoryData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    for (const e of realExpenses) {
      const key = e.category_name || 'Uncategorized';
      const existing = map.get(key);
      const color = e.category_color || '#6B7280';
      if (existing) {
        existing.value += e.amount;
      } else {
        map.set(key, { name: key, value: e.amount, color });
      }
    }
    const arr = Array.from(map.values()).sort((a, b) => b.value - a.value);
    // Assign distinct colors from palette for any that lack them
    arr.forEach((item, i) => {
      if (item.color === '#6B7280' || !item.color) {
        item.color = PIE_COLORS[i % PIE_COLORS.length];
      }
    });
    return arr;
  }, [realExpenses]);

  // Spending by person (who paid)
  const personData = useMemo(() => {
    const map = new Map<number, { name: string; value: number }>();
    for (const e of realExpenses) {
      const existing = map.get(e.paid_by);
      if (existing) {
        existing.value += e.amount;
      } else {
        map.set(e.paid_by, { name: e.paid_by_name, value: e.amount });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .map((item, i) => ({ ...item, fill: BAR_COLORS[i % BAR_COLORS.length] }));
  }, [realExpenses]);

  if (realExpenses.length === 0) {
    return null;
  }

  const totalAmount = realExpenses.reduce((sum, e) => sum + e.amount, 0);

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium">{data.name}</p>
          <p className="text-gray-600">{formatCurrency(data.value)}</p>
          <p className="text-gray-400">
            {((data.value / totalAmount) * 100).toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  const renderPieLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;
    return (
      <div className="space-y-1.5 text-sm">
        {payload.map((entry: any, index: number) => {
          const data = categoryData[index];
          if (!data) return null;
          return (
            <div key={`legend-${index}`} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700 truncate max-w-[140px]">{data.name}</span>
              <span className="font-medium ml-auto whitespace-nowrap">
                {formatCurrency(data.value)}
              </span>
              <span className="text-gray-400 text-xs w-10 text-right">
                {((data.value / totalAmount) * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium">{payload[0].payload.name}</p>
          <p className="text-gray-600">Paid total: {formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => setView('category')}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === 'category'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            By Category
          </button>
          <button
            onClick={() => setView('person')}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === 'person'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            By Person
          </button>
        </div>
      </div>

      {view === 'category' ? (
        categoryData.length > 0 ? (
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend content={renderPieLegend} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No category data" />
        )
      ) : personData.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(200, personData.length * 50)}>
          <BarChart
            data={personData}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `$${v}`} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 13 }}
              tickFormatter={(v) => v.length > 15 ? `${v.slice(0, 15)}...` : v}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {personData.map((entry, index) => (
                <Cell key={`bar-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="No person data" />
      )}
    </div>
  );
}
