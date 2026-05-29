import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface Transaction {
  id: number;
  accountId: number;
  date: string;
  amount: string;
  merchant: string | null;
  name: string | null;
  category: string | null;
  pending: boolean;
  accountName: string | null;
  institution: string | null;
}

interface Account {
  id: number;
  name: string;
  institution: string | null;
}

const PAGE_SIZE = 50;
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatCurrency(amount: string): string {
  return currencyFmt.format(Math.abs(parseFloat(amount)));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCategory(cat: string | null): string {
  if (!cat) return '\u2014';
  return cat.toLowerCase().replace(/_/g, ' ');
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      if (search) params.set('search', search);
      if (accountFilter) params.set('accountId', accountFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.transactions);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, search, accountFilter, categoryFilter, startDate, endDate]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Fetch accounts for filter dropdown
  useEffect(() => {
    fetch('/api/accounts', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load accounts');
        return res.json();
      })
      .then(data => setAccounts(data))
      .catch(err => console.error('Accounts filter load failed:', err.message));
  }, []);

  // Fetch categories for filter dropdown
  useEffect(() => {
    fetch('/api/transactions/categories', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load categories');
        return res.json();
      })
      .then(data => setCategories(data))
      .catch(err => console.error('Categories filter load failed:', err.message));
  }, []);

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      const res = await fetch('/api/transactions/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Sync failed');
      setPage(0);
      // fetchTransactions will re-run via useEffect when page changes
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const inputClass = 'rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form onSubmit={handleSearch} className="relative flex min-w-[200px] flex-1 gap-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search merchant or name..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className={`${inputClass} w-full pl-9`}
            aria-label="Search transactions"
          />
          <button
            type="submit"
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Search
          </button>
        </form>
        <select
          value={accountFilter}
          onChange={e => { setAccountFilter(e.target.value); setPage(0); }}
          className={inputClass}
          aria-label="Filter by account"
        >
          <option value="">All accounts</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.institution ? `${a.institution} \u2014 ` : ''}{a.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}
          className={inputClass}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c} className="capitalize">
              {formatCategory(c)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(0); }}
          className={inputClass}
          aria-label="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(0); }}
          className={inputClass}
          aria-label="End date"
        />
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div role="status" aria-label="Loading" className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-700 py-16 text-center">
          <p className="text-lg text-neutral-400">No transactions found</p>
          <p className="mt-1 text-sm text-neutral-500">
            {search || accountFilter || categoryFilter || startDate || endDate
              ? 'Try adjusting your filters'
              : 'Link an account and sync to see transactions'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-neutral-800 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Merchant</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Account</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {transactions.map(txn => {
                  const amount = parseFloat(txn.amount);
                  const isInflow = amount < 0;
                  return (
                    <tr key={txn.id} className="hover:bg-neutral-900/50">
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-400">
                        {formatDate(txn.date)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{txn.merchant || txn.name}</p>
                        {txn.pending && (
                          <span className="inline-block rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-500">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 capitalize">
                        {formatCategory(txn.category)}
                      </td>
                      <td className="px-4 py-3 text-neutral-400">
                        {txn.accountName}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${isInflow ? 'text-green-400' : 'text-white'}`}>
                        {isInflow ? '+' : '\u2212'}{formatCurrency(txn.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="space-y-2 md:hidden">
            {transactions.map(txn => {
              const amount = parseFloat(txn.amount);
              const isInflow = amount < 0;
              return (
                <div key={txn.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{txn.merchant || txn.name}</p>
                      <p className="text-xs text-neutral-500">
                        {formatDate(txn.date)} · {txn.accountName}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {txn.category && (
                          <span className="text-xs text-neutral-400 capitalize">{formatCategory(txn.category)}</span>
                        )}
                        {txn.pending && (
                          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-500">Pending</span>
                        )}
                      </div>
                    </div>
                    <p className={`ml-3 font-medium ${isInflow ? 'text-green-400' : 'text-white'}`}>
                      {isInflow ? '+' : '\u2212'}{formatCurrency(txn.amount)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                {page * PAGE_SIZE + 1}\u2013{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
