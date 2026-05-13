import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import AccountCard from '../components/AccountCard';
import PlaidLinkButton from '../components/PlaidLinkButton';

interface Account {
  id: number;
  institution: string | null;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: string | null;
  availableBalance: string | null;
  currency: string;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      const res = await fetch('/api/accounts/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  }

  // Group accounts by institution, "Unknown Institution" last
  const grouped = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    for (const account of accounts) {
      const key = account.institution || 'Unknown Institution';
      if (!groups[key]) groups[key] = [];
      groups[key].push(account);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Unknown Institution') return 1;
      if (b === 'Unknown Institution') return -1;
      return a.localeCompare(b);
    });
  }, [accounts]);

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
        <h1 className="text-3xl font-bold">Accounts</h1>
        <div className="flex items-center gap-3">
          {accounts.length > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Refresh'}
            </button>
          )}
          <PlaidLinkButton onSuccess={fetchAccounts} onError={setError} />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
          <p className="text-lg text-slate-400">No accounts linked yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Click "Link Account" to connect your first bank or card
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([institution, institutionAccounts]) => (
            <div key={institution}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">
                {institution}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {institutionAccounts.map(account => (
                  <AccountCard
                    key={account.id}
                    name={account.name}
                    type={account.type}
                    subtype={account.subtype}
                    mask={account.mask}
                    currentBalance={account.currentBalance}
                    currency={account.currency}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
