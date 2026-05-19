import { useState, useEffect, useCallback } from 'react';
import { Link2, Unlink, RefreshCw, ArrowLeftRight, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { currencyFmt } from '../lib/format';

interface Activity {
  id: number;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
}

const PAGE_SIZE = 50;

const actionLabels: Record<string, string> = {
  account_linked: 'Linked a financial account',
  accounts_synced: 'Refreshed account balances',
  transactions_synced: 'Synced transactions',
  investments_synced: 'Synced investments',
  coinbase_synced: 'Synced Coinbase',
  account_unlinked: 'Unlinked a financial account',
};

const actionIcons: Record<string, React.ElementType> = {
  account_linked: Link2,
  accounts_synced: RefreshCw,
  transactions_synced: ArrowLeftRight,
  investments_synced: TrendingUp,
  coinbase_synced: TrendingUp,
  account_unlinked: Unlink,
};

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatMetadata(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (meta.institution_name) parts.push(String(meta.institution_name));
  if (meta.transactions_added) parts.push(`${meta.transactions_added} added`);
  if (meta.transactions_modified) parts.push(`${meta.transactions_modified} modified`);
  if (meta.transactions_removed) parts.push(`${meta.transactions_removed} removed`);
  if (meta.holdings_synced) parts.push(`${meta.holdings_synced} holdings`);
  if (meta.items_synced !== undefined) parts.push(`${meta.items_synced} items synced`);
  if (meta.items_failed) parts.push(`${meta.items_failed} failed`);
  if (meta.total_value !== undefined) parts.push(currencyFmt.format(Number(meta.total_value)));
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      const res = await fetch(`/api/activity?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch activity');
      const data = await res.json();
      setActivities(data.activities);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div role="status" aria-label="Loading" className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Activity Log</h1>
        <p className="mt-1 text-sm text-slate-500">All actions performed by household members</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
          <p className="text-lg text-slate-400">No activity yet</p>
          <p className="mt-1 text-sm text-slate-500">Actions like linking accounts and syncing data will appear here</p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {activities.map(activity => {
              const Icon = actionIcons[activity.action] || RefreshCw;
              const label = actionLabels[activity.action] || activity.action.replace(/_/g, ' ');
              const meta = formatMetadata(activity.metadata);

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-slate-900/50"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                    <Icon size={16} className="text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{label}</p>
                    {meta && (
                      <p className="text-xs text-slate-400">{meta}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      {activity.userName || 'System'} · {formatTimestamp(activity.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {page * PAGE_SIZE + 1}\u2013{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
