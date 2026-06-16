import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const formatted = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  // Show time if it's not midnight (i.e. has a time component)
  if (d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0) {
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${formatted}, ${time}`;
  }
  return formatted;
}
