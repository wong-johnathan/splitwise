export const SUPPORTED_CURRENCIES = [
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
];

export function getCurrencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find(c => c.code === code)?.symbol || code;
}

export function formatCurrencyByCode(amount: number, code: string): string {
  const symbol = getCurrencySymbol(code);
  if (['IDR', 'VND', 'KRW', 'JPY'].includes(code)) {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}
