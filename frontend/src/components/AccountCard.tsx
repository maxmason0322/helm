import { Landmark, CreditCard, TrendingUp, Wallet } from 'lucide-react';

interface AccountCardProps {
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: string | null;
  currency: string;
}

const typeIcons: Record<string, React.ElementType> = {
  depository: Wallet,
  credit: CreditCard,
  investment: TrendingUp,
};

function formatBalance(balance: string | null, currency: string): string {
  if (!balance) return '—';
  try {
    const num = parseFloat(balance);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(num);
  } catch {
    return balance;
  }
}

export default function AccountCard({ name, type, subtype, mask, currentBalance, currency }: AccountCardProps) {
  const Icon = typeIcons[type] || Landmark;
  const balanceNum = currentBalance ? parseFloat(currentBalance) : null;
  const isOwed = type === 'credit' && balanceNum !== null && balanceNum > 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
            <Icon size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{name}</p>
            {mask && (
              <p className="text-xs text-slate-500">••{mask}</p>
            )}
          </div>
        </div>
        {subtype && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400 capitalize">
            {subtype}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-slate-500">{isOwed ? 'Balance owed' : 'Balance'}</p>
        <p className={`text-xl font-semibold ${isOwed ? 'text-red-400' : 'text-white'}`}>
          {formatBalance(currentBalance, currency)}
        </p>
      </div>
    </div>
  );
}
