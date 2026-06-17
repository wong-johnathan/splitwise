import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

export function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function toUtcIsoString(localDatetime: string): string {
  return new Date(localDatetime).toISOString();
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

/** Always shows date + time, e.g. "Jun 17, 2026, 4:14 PM" */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
