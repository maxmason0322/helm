import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { currencyFmt } from '../lib/format';

interface SpendingByCategoryProps {
  data: { category: string; amount: number }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#84cc16'];

export default function SpendingByCategory({ data }: SpendingByCategoryProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">Spending (30 days)</h2>
        <p className="text-sm text-neutral-500">No spending data yet</p>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const summary = data.map(d => `${d.category}: ${currencyFmt.format(d.amount)}`).join(', ');

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">Spending (30 days)</h2>
      <div role="img" aria-label={`Spending breakdown: ${summary}. Total: ${currencyFmt.format(total)}`}>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <ResponsiveContainer width={160} height={160} className="shrink-0">
            <PieChart accessibilityLayer={false}>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8 }}
                labelStyle={{ color: '#e5e5e5' }}
                formatter={(value) => currencyFmt.format(Number(value))}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {data.slice(0, 5).map((item, i) => (
              <div key={item.category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="capitalize text-neutral-300">{item.category}</span>
                </div>
                <span className="text-neutral-400">{currencyFmt.format(item.amount)}</span>
              </div>
            ))}
            {data.length > 5 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">+ {data.length - 5} more</span>
                <span className="text-neutral-500">{currencyFmt.format(total - data.slice(0, 5).reduce((s, d) => s + d.amount, 0))}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
