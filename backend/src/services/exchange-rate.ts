import { pool } from '../db/pool';

const FRANKFURTER_API = 'https://api.frankfurter.app';

const SUPPORTED_CODES = [
  'SGD', 'IDR', 'THB', 'MYR', 'CNY', 'HKD', 'USD',
  'JPY', 'TWD', 'EUR', 'AUD', 'KRW', 'VND',
];

const STALE_HOURS = 24;

/** Fetch latest rates from Frankfurter for a given base currency */
async function fetchRates(base: string): Promise<Record<string, number>> {
  const url = `${FRANKFURTER_API}/latest?base=${base}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);
  const data: { rates: Record<string, number> } = await res.json() as { rates: Record<string, number> };
  return data.rates;
}

/** Upsert a single rate into cached_rates */
async function upsertRate(base: string, target: string, rate: number): Promise<void> {
  await pool.query(
    `INSERT INTO cached_rates (base_currency, target_currency, rate, fetched_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (base_currency, target_currency)
     DO UPDATE SET rate = $3, fetched_at = NOW()`,
    [base, target, rate]
  );
}

/** Check if cached rates for a base are stale (>24h) */
async function isStale(base: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT fetched_at FROM cached_rates WHERE base_currency = $1 LIMIT 1`,
    [base]
  );
  if (result.rows.length === 0) return true;
  const fetchedAt = new Date(result.rows[0].fetched_at);
  const hoursOld = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
  return hoursOld > STALE_HOURS;
}

/** Refresh all cached rates for a base currency */
export async function refreshRates(base: string): Promise<Record<string, number>> {
  const rates = await fetchRates(base);
  for (const [target, rate] of Object.entries(rates)) {
    if (SUPPORTED_CODES.includes(target)) {
      await upsertRate(base, target, rate);
    }
  }
  // Also store the base→base rate as 1
  await upsertRate(base, base, 1);
  return rates;
}

/** Get a single exchange rate from → to (cached, auto-refreshes if stale) */
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  // Check if stale — if so, refresh
  if (await isStale(from)) {
    await refreshRates(from);
  }

  const result = await pool.query(
    `SELECT rate FROM cached_rates
     WHERE base_currency = $1 AND target_currency = $2`,
    [from, to]
  );

  if (result.rows.length > 0) {
    return parseFloat(result.rows[0].rate);
  }

  // Try reverse rate
  if (await isStale(to)) {
    await refreshRates(to);
  }

  const reverseResult = await pool.query(
    `SELECT rate FROM cached_rates
     WHERE base_currency = $1 AND target_currency = $2`,
    [to, from]
  );

  if (reverseResult.rows.length > 0) {
    const reverseRate = parseFloat(reverseResult.rows[0].rate);
    return 1 / reverseRate;
  }

  // Fallback: fetch direct
  const rates = await fetchRates(from);
  if (rates[to]) {
    await upsertRate(from, to, rates[to]);
    return rates[to];
  }

  throw new Error(`No exchange rate available for ${from} → ${to}`);
}

/** Convert an amount from one currency to another */
export async function convert(amount: number, from: string, to: string): Promise<number> {
  if (from === to) return amount;
  const rate = await getRate(from, to);
  return Math.round(amount * rate * 100) / 100;
}

/** Get all supported currencies with their current rates against a base */
export async function getCurrenciesWithRates(base: string): Promise<{ code: string; rate: number }[]> {
  // Make sure we have fresh rates
  if (await isStale(base)) {
    await refreshRates(base);
  }

  const result = await pool.query(
    `SELECT target_currency AS code, rate FROM cached_rates
     WHERE base_currency = $1 AND target_currency = ANY($2)`,
    [base, SUPPORTED_CODES]
  );

  const rateMap = new Map<string, number>();
  for (const row of result.rows) {
    rateMap.set(row.code, parseFloat(row.rate));
  }

  // Include base itself
  rateMap.set(base, 1);

  return SUPPORTED_CODES.map(code => ({
    code,
    rate: rateMap.get(code) || 0,
  }));
}

/** Initialize: pre-cache SGD rates at startup */
export async function initExchangeRates(): Promise<void> {
  try {
    if (await isStale('SGD')) {
      console.log('⏳ Initialising exchange rates (SGD base)...');
      await refreshRates('SGD');
      console.log('✅ Exchange rates cached');
    } else {
      console.log('✅ Exchange rates already fresh');
    }
  } catch (err) {
    console.error('❌ Failed to init exchange rates:', err);
  }
}
