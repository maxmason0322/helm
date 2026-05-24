import { Landmark, CreditCard, TrendingUp, Wallet, EyeOff, Eye } from 'lucide-react';

interface AccountCardProps {
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: string | null;
  currency: string;
  hidden?: boolean;
  onHide?: () => void;
  onUnhide?: () => void;
}

const typeIcons: Record<string, React.ElementType> = {
  depository: Wallet,
  credit: CreditCard,
  investment: TrendingUp,
};

function formatBalance(balance: string | null, currency: string): string {
  if (!balance) return '\u2014';
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

export default function AccountCard({ name, type, subtype, mask, currentBalance, currency, hidden, onHide, onUnhide }: AccountCardProps) {
  const Icon = typeIcons[type] || Landmark;
  const balanceNum = currentBalance ? parseFloat(currentBalance) : null;
  const isOwed = type === 'credit' && balanceNum !== null && balanceNum > 0;

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900 p-5 ${hidden ? 'opacity-50' : ''}`}>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
            <Icon size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{name}</p>
            {mask && (
              <p className="text-xs text-slate-500">\u2022\u2022{mask}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {subtype && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400 capitalize">
              {subtype}
            </span>
          )}
          {(onHide || onUnhide) && (
            <button
              onClick={hidden ? onUnhide : onHide}
              className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              aria-label={hidden ? 'Show account' : 'Hide account'}
              title={hidden ? 'Show account' : 'Hide account'}
            >
              {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
        </div>
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
