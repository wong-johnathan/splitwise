import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate } from '../utils';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('should handle undefined values', () => {
    expect(cn('base', undefined, 'end')).toBe('base end');
  });

  it('should merge Tailwind classes (last wins)', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });
});

describe('formatCurrency', () => {
  it('should format positive numbers', () => {
    expect(formatCurrency(50)).toBe('$50.00');
  });

  it('should format negative numbers', () => {
    expect(formatCurrency(-25.5)).toBe('$25.50');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should round to 2 decimal places', () => {
    expect(formatCurrency(33.3333)).toBe('$33.33');
  });

  it('should handle large numbers', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
  });
});

describe('formatDate', () => {
  it('should format ISO date string', () => {
    const result = formatDate('2025-06-10');
    expect(result).toMatch(/Jun 10, 2025/);
  });

  it('should handle full datetime string', () => {
    const result = formatDate('2025-06-10T14:30:00Z');
    expect(result).toMatch(/Jun 10, 2025/);
  });
});
