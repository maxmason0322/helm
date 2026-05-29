import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { Wallet, TrendingUp, CreditCard, ArrowRight } from 'lucide-react';
import NetWorthChart from '../components/NetWorthChart';
import SpendingByCategory from '../components/SpendingByCategory';
import AccountCard from '../components/AccountCard';
import { currencyFmt } from '../lib/format';

interface Account {
  id: number;
  institution: string | null;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: string | null;
  currency: string;
}

interface DashboardData {
  netWorth: number;
  balanceByType: Record<string, number>;
  accounts: Account[];
  spendingByCategory: { category: string; amount: number }[];
  recentTransactions: {
    id: number;
    date: string;
    amount: string;
    merchant: string | null;
    name: string | null;
    category: string | null;
    pending: boolean;
  }[];
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div role="status" aria-label="Loading" className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {error || 'Failed to load dashboard'}
      </div>
    );
  }

  const { netWorth, balanceByType, accounts, spendingByCategory, recentTransactions } = data;

  return (
    <div className="space-y-6">
      {/* Net Worth Hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 md:p-8"
      >
        <p className="text-sm font-medium uppercase tracking-wider text-neutral-500">Net Worth</p>
        <p className={`mt-2 text-4xl font-bold md:text-5xl ${netWorth >= 0 ? 'text-white' : 'text-red-400'}`}>
          {netWorth < 0 && '\u2212'}
          $<CountUp end={Math.abs(netWorth)} duration={1.5} separator="," decimals={0} />
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          {Object.entries(balanceByType).map(([type, value]) => {
            const icons: Record<string, React.ElementType> = { depository: Wallet, investment: TrendingUp, credit: CreditCard, crypto: TrendingUp };
            const Icon = icons[type] || Wallet;
            return (
              <div key={type} className="flex items-center gap-2 text-sm text-neutral-400">
                <Icon size={14} />
                <span className="capitalize">{type === 'depository' ? 'Cash' : type}</span>
                <span className={value < 0 ? 'text-red-400' : 'text-white'}>
                  {value < 0 ? '\u2212' : ''}{currencyFmt.format(Math.abs(value))}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <NetWorthChart balanceByType={balanceByType} />
        <SpendingByCategory data={spendingByCategory} />
      </div>

      {/* Account Cards */}
      {accounts.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">Accounts</h2>
            <Link
              to="/accounts"
              className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.slice(0, 6).map((account, i) => (
              <motion.div
                key={account.id}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
              >
                <AccountCard
                  name={account.name}
                  type={account.type}
                  subtype={account.subtype}
                  mask={account.mask}
                  currentBalance={account.currentBalance}
                  currency={account.currency}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">Recent Transactions</h2>
            <Link
              to="/transactions"
              className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
            {recentTransactions.map(txn => {
              const amount = parseFloat(txn.amount);
              const isInflow = amount < 0;
              return (
                <div key={txn.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{txn.merchant || txn.name}</p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(txn.date)}
                      {txn.pending && <span className="ml-1 text-yellow-500">· Pending</span>}
                    </p>
                  </div>
                  <p className={`text-sm font-medium ${isInflow ? 'text-green-400' : 'text-white'}`}>
                    {isInflow ? '+' : '\u2212'}
                    {currencyFmt.format(Math.abs(amount))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-700 py-16 text-center">
          <p className="text-lg text-neutral-400">Welcome to Helm</p>
          <p className="mt-1 text-sm text-neutral-500">
            <Link to="/accounts" className="text-emerald-400 hover:text-emerald-300">Link an account</Link> to get started
          </p>
        </div>
      )}
    </div>
  );
}
