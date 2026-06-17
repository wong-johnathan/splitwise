import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getCurrenciesWithRates, initExchangeRates } from '../services/exchange-rate';

const router = Router();
router.use(requireAuth);

const SUPPORTED_CODES = [
  'SGD', 'IDR', 'THB', 'MYR', 'CNY', 'HKD', 'USD',
  'JPY', 'TWD', 'EUR', 'AUD', 'KRW', 'VND',
];

const CURRENCY_META: Record<string, { name: string; symbol: string }> = {
  SGD: { name: 'Singapore Dollar', symbol: 'S$' },
  IDR: { name: 'Indonesian Rupiah', symbol: 'Rp' },
  THB: { name: 'Thai Baht', symbol: '฿' },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM' },
  CNY: { name: 'Chinese Yuan', symbol: '¥' },
  HKD: { name: 'Hong Kong Dollar', symbol: 'HK$' },
  USD: { name: 'US Dollar', symbol: '$' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  TWD: { name: 'Taiwan Dollar', symbol: 'NT$' },
  EUR: { name: 'Euro', symbol: '€' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  KRW: { name: 'South Korean Won', symbol: '₩' },
  VND: { name: 'Vietnamese Dong', symbol: '₫' },
};

// GET /api/currencies?base=SGD — list all supported currencies with rates
router.get('/', async (req, res) => {
  try {
    const base = (req.query.base as string) || 'SGD';

    // Ensure rates are fresh
    await initExchangeRates();

    const rates = await getCurrenciesWithRates(base);

    const currencies = rates.map(r => ({
      code: r.code,
      ...(CURRENCY_META[r.code] || { name: r.code, symbol: r.code }),
      rate: r.rate,
    }));

    res.json({ currencies });
  } catch (err) {
    console.error('Get currencies error:', err);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

export default router;
