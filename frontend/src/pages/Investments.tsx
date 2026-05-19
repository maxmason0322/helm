import { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { currencyFmt, currencyFmtCents } from '../lib/format';

interface Holding {
  id: number;
  ticker: string | null;
  name: string | null;
  quantity: string;
  costBasis: string | null;
  marketValue: string | null;
  currency: string;
  accountName: string | null;
  institution: string | null;
}

interface InvestmentTransaction {
  id: number;
  date: string;
  type: string;
  ticker: string | null;
  amount: string;
  quantity: string | null;
  price: string | null;
  accountName: string | null;
  institution: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatQuantity(qty: string): string {
  const num = parseFloat(qty);
  if (isNaN(num)) return qty;
  return num < 1 ? num.toFixed(6) : num.toFixed(2);
}

function gainLoss(marketValue: string | null, costBasis: string | null): { value: number; pct: number } | null {
  if (!marketValue || !costBasis) return null;
  const mv = parseFloat(marketValue);
  const cb = parseFloat(costBasis);
  if (isNaN(mv) || isNaN(cb) || cb === 0) return null;
  return { value: mv - cb, pct: ((mv - cb) / cb) * 100 };
}

function txnTypeStyle(type: string): string {
  switch (type) {
    case 'buy': return 'bg-green-500/10 text-green-400';
    case 'sell': return 'bg-red-500/10 text-red-400';
    case 'dividend': return 'bg-blue-500/10 text-blue-400';
    default: return 'bg-slate-700/30 text-slate-400';
  }
}

export default function Investments() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [txns, setTxns] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'holdings' | 'transactions'>('holdings');

  async function fetchData() {
    const [hRes, tRes] = await Promise.all([
      fetch('/api/investments/holdings', { credentials: 'include' }),
      fetch('/api/investments/transactions', { credentials: 'include' }),
    ]);
    if (!hRes.ok) throw new Error('Failed to fetch holdings');
    if (!tRes.ok) throw new Error('Failed to fetch transactions');
    const [h, t] = await Promise.all([hRes.json(), tRes.json()]);
    setHoldings(h);
    setTxns(t);
  }

  useEffect(() => {
    fetchData()
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load investments'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      // Sync both Plaid investments and Coinbase
      const [plaidRes] = await Promise.all([
        fetch('/api/investments/sync', { method: 'POST', credentials: 'include' }),
        fetch('/api/coinbase/sync', { method: 'POST', credentials: 'include' }).catch(() => null),
      ]);
      if (!plaidRes.ok) throw new Error('Investment sync failed');
      // Coinbase sync is best-effort (may not be configured)
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  // Portfolio totals
  const { totalMarketValue, totalCostBasis, totalGain, totalGainPct } = useMemo(() => {
    const mv = holdings.reduce((sum, h) => sum + (parseFloat(h.marketValue ?? '0') || 0), 0);
    const cb = holdings.reduce((sum, h) => sum + (parseFloat(h.costBasis ?? '0') || 0), 0);
    const gain = cb > 0 ? mv - cb : null;
    const pct = cb > 0 ? ((mv - cb) / cb) * 100 : null;
    return { totalMarketValue: mv, totalCostBasis: cb, totalGain: gain, totalGainPct: pct };
  }, [holdings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div role="status" aria-label="Loading" className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Investments</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* Portfolio summary */}
      {holdings.length > 0 && (
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-slate-500">Market Value</p>
              <p className="text-2xl font-bold text-white">{currencyFmt.format(totalMarketValue)}</p>
            </div>
            {totalCostBasis > 0 && (
              <div>
                <p className="text-xs text-slate-500">Cost Basis</p>
                <p className="text-2xl font-bold text-slate-400">{currencyFmt.format(totalCostBasis)}</p>
              </div>
            )}
            {totalGain !== null && totalGainPct !== null && (
              <div>
                <p className="text-xs text-slate-500">Total Gain/Loss</p>
                <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalGain >= 0 ? '+' : '\u2212'}{currencyFmt.format(Math.abs(totalGain))}
                  <span className="ml-1 text-base">
                    ({totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(1)}%)
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" className="mb-4 flex gap-1">
        <button
          role="tab"
          aria-selected={tab === 'holdings'}
          onClick={() => setTab('holdings')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'holdings' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Holdings ({holdings.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === 'transactions'}
          onClick={() => setTab('transactions')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'transactions' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Transactions ({txns.length})
        </button>
      </div>

      {/* Holdings Tab */}
      {tab === 'holdings' && (
        <div role="tabpanel">
          {holdings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
              <p className="text-lg text-slate-400">No holdings yet</p>
              <p className="mt-1 text-sm text-slate-500">Link an investment or crypto account to see holdings</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-4 py-3">Symbol</th>
                      <th scope="col" className="px-4 py-3">Name</th>
                      <th scope="col" className="px-4 py-3 text-right">Quantity</th>
                      <th scope="col" className="px-4 py-3 text-right">Market Value</th>
                      <th scope="col" className="px-4 py-3 text-right">Cost Basis</th>
                      <th scope="col" className="px-4 py-3 text-right">Gain/Loss</th>
                      <th scope="col" className="px-4 py-3">Account</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {holdings.map(h => {
                      const gl = gainLoss(h.marketValue, h.costBasis);
                      return (
                        <tr key={h.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-white">{h.ticker || '\u2014'}</td>
                          <td className="px-4 py-3 text-slate-400">{h.name || '\u2014'}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatQuantity(h.quantity)}</td>
                          <td className="px-4 py-3 text-right text-white">
                            {h.marketValue ? currencyFmtCents.format(parseFloat(h.marketValue)) : '\u2014'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {h.costBasis ? currencyFmtCents.format(parseFloat(h.costBasis)) : '\u2014'}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${gl ? (gl.value >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-500'}`}>
                            {gl ? `${gl.value >= 0 ? '+' : '\u2212'}${currencyFmtCents.format(Math.abs(gl.value))} (${gl.pct >= 0 ? '+' : ''}${gl.pct.toFixed(1)}%)` : '\u2014'}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{h.accountName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {holdings.map(h => {
                  const gl = gainLoss(h.marketValue, h.costBasis);
                  const isCrypto = h.institution === 'Coinbase';
                  return (
                    <div key={h.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-white">{h.ticker || h.name || '\u2014'}</p>
                          {h.ticker && h.name && (
                            <p className="text-xs text-slate-500">
                              {h.name} · {formatQuantity(h.quantity)} {isCrypto ? h.ticker : 'shares'}
                            </p>
                          )}
                          {!h.ticker && (
                            <p className="text-xs text-slate-500">{formatQuantity(h.quantity)} units</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white">
                            {h.marketValue ? currencyFmtCents.format(parseFloat(h.marketValue)) : '\u2014'}
                          </p>
                          {gl && (
                            <p className={`text-xs ${gl.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {gl.value >= 0 ? '+' : '\u2212'}{currencyFmtCents.format(Math.abs(gl.value))} ({gl.pct >= 0 ? '+' : ''}{gl.pct.toFixed(1)}%)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div role="tabpanel">
          {txns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
              <p className="text-lg text-slate-400">No investment transactions yet</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-4 py-3">Date</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Symbol</th>
                      <th scope="col" className="px-4 py-3 text-right">Quantity</th>
                      <th scope="col" className="px-4 py-3 text-right">Price</th>
                      <th scope="col" className="px-4 py-3 text-right">Amount</th>
                      <th scope="col" className="px-4 py-3">Account</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {txns.map(txn => (
                      <tr key={txn.id} className="hover:bg-slate-800/40">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-400">{formatDate(txn.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${txnTypeStyle(txn.type)}`}>
                            {txn.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{txn.ticker || '\u2014'}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {txn.quantity ? formatQuantity(txn.quantity) : '\u2014'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {txn.price ? currencyFmtCents.format(parseFloat(txn.price)) : '\u2014'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-white">
                          {currencyFmtCents.format(Math.abs(parseFloat(txn.amount)))}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{txn.accountName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {txns.map(txn => (
                  <div key={txn.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-white">{txn.ticker || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(txn.date)} ·{' '}
                          <span className={`capitalize ${
                            txn.type === 'buy' ? 'text-green-400' :
                            txn.type === 'sell' ? 'text-red-400' :
                            txn.type === 'dividend' ? 'text-blue-400' :
                            'text-slate-400'
                          }`}>{txn.type}</span>
                          {txn.quantity && ` · ${formatQuantity(txn.quantity)} @ ${txn.price ? currencyFmtCents.format(parseFloat(txn.price)) : '?'}`}
                        </p>
                      </div>
                      <p className="font-medium text-white">
                        {currencyFmtCents.format(Math.abs(parseFloat(txn.amount)))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
