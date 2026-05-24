import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Unlink, Eye, EyeOff } from 'lucide-react';
import AccountCard from '../components/AccountCard';
import PlaidLinkButton from '../components/PlaidLinkButton';

interface Account {
  id: number;
  plaidItemId: number | null;
  institution: string | null;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: string | null;
  availableBalance: string | null;
  currency: string;
  hiddenAt: string | null;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      // Always fetch all accounts (including hidden) so we can show the toggle
      const res = await fetch('/api/accounts?includeHidden=true', { credentials: 'include' });
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
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  }

  async function handleUnlink(plaidItemId: number, institutionName: string) {
    if (!confirm(`Unlink ${institutionName}? Historical transaction data will be preserved but accounts will be removed from active view.`)) {
      return;
    }
    setUnlinking(true);
    setError('');
    try {
      const res = await fetch(`/api/plaid/items/${plaidItemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        let msg = 'Failed to unlink';
        try { const data = await res.json(); msg = data.error || msg; } catch {}
        throw new Error(msg);
      }
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink account');
    } finally {
      setUnlinking(false);
    }
  }

  async function handleToggleHide(accountId: number, isHidden: boolean) {
    setError('');
    try {
      const action = isHidden ? 'unhide' : 'hide';
      const res = await fetch(`/api/accounts/${accountId}/${action}`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) {
        let msg = `Failed to ${action} account`;
        try { const data = await res.json(); msg = data.error || msg; } catch {}
        throw new Error(msg);
      }
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
    }
  }

  // Group visible accounts by institution, "Unknown Institution" last
  const grouped = useMemo(() => {
    const visible = showHidden ? accounts : accounts.filter(a => !a.hiddenAt);
    const groups: Record<string, Account[]> = {};
    for (const account of visible) {
      const key = account.institution || 'Unknown Institution';
      if (!groups[key]) groups[key] = [];
      groups[key].push(account);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Unknown Institution') return 1;
      if (b === 'Unknown Institution') return -1;
      return a.localeCompare(b);
    });
  }, [accounts, showHidden]);

  const hiddenCount = accounts.filter(a => a.hiddenAt).length;

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

      {/* Show hidden toggle */}
      {(hiddenCount > 0 || showHidden) && (
        <button
          onClick={() => setShowHidden(v => !v)}
          className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          {showHidden ? 'Hide hidden accounts' : `Show ${hiddenCount} hidden account${hiddenCount !== 1 ? 's' : ''}`}
        </button>
      )}

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
          {grouped.map(([institution, institutionAccounts]) => {
            const plaidItemId = institutionAccounts.find(a => a.plaidItemId)?.plaidItemId;
            return (
            <div key={institution}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                  {institution}
                </h2>
                {plaidItemId && (
                  <button
                    onClick={() => handleUnlink(plaidItemId, institution)}
                    disabled={unlinking}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    <Unlink size={12} />
                    {unlinking ? 'Unlinking...' : 'Unlink'}
                  </button>
                )}
              </div>
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
                    hidden={!!account.hiddenAt}
                    onHide={() => handleToggleHide(account.id, false)}
                    onUnhide={() => handleToggleHide(account.id, true)}
                  />
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
