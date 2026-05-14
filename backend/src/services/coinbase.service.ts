import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const BASE_URL = 'https://api.coinbase.com';

function getCredentials() {
  const apiKey = process.env.COINBASE_API_KEY;
  let apiSecret = process.env.COINBASE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('COINBASE_API_KEY and COINBASE_API_SECRET must be set');
  }

  // Handle PEM stored with literal \n in .env
  if (apiSecret.includes('\\n')) {
    apiSecret = apiSecret.replace(/\\n/g, '\n');
  }

  return { apiKey, apiSecret };
}

function buildJwt(method: string, path: string): string {
  const { apiKey, apiSecret } = getCredentials();
  const uri = `${method} api.coinbase.com${path}`;

  return jwt.sign(
    {
      iss: 'cdp',
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      sub: apiKey,
      uri,
    },
    apiSecret,
    {
      algorithm: 'ES256',
      header: {
        alg: 'ES256' as const,
        kid: apiKey,
        nonce: crypto.randomBytes(16).toString('hex'),
        typ: 'JWT',
      } as unknown as jwt.JwtHeader,
    },
  );
}

async function coinbaseGet<T>(path: string): Promise<T> {
  const token = buildJwt('GET', path);
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Coinbase API error ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

interface CoinbaseBalance {
  value: string;
  currency: string;
}

interface CoinbaseAccount {
  uuid: string;
  name: string;
  currency: string;
  available_balance: CoinbaseBalance;
  hold: CoinbaseBalance;
  type: string;
  active: boolean;
}

interface AccountsResponse {
  accounts: CoinbaseAccount[];
  has_next: boolean;
  cursor: string;
}

interface ProductResponse {
  price: string;
  product_id: string;
}

export async function getCoinbaseAccounts(): Promise<CoinbaseAccount[]> {
  const allAccounts: CoinbaseAccount[] = [];
  let cursor = '';
  let hasNext = true;
  let pages = 0;

  while (hasNext && pages < 10) {
    const params = new URLSearchParams({ limit: '250' });
    if (cursor) params.set('cursor', cursor);

    const data = await coinbaseGet<AccountsResponse>(
      `/api/v3/brokerage/accounts?${params}`,
    );

    allAccounts.push(...data.accounts);
    hasNext = data.has_next;
    cursor = data.cursor;
    pages++;
  }

  // Filter to active crypto accounts with non-zero balance
  return allAccounts.filter(
    a => a.active && a.type === 'ACCOUNT_TYPE_CRYPTO' && parseFloat(a.available_balance.value) > 0,
  );
}

export async function getCryptoPrice(currency: string): Promise<number | null> {
  try {
    const data = await coinbaseGet<ProductResponse>(
      `/api/v3/brokerage/market/products/${currency}-USD`,
    );
    const price = parseFloat(data.price);
    return isNaN(price) ? null : price;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Failed to fetch price for ${currency}:`, message);
    return null;
  }
}
