import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { currencyFmt } from '../lib/format';

interface NetWorthChartProps {
  balanceByType: Record<string, number>;
}

const typeLabels: Record<string, string> = {
  depository: 'Cash',
  investment: 'Investments',
  crypto: 'Crypto',
  credit: 'Credit',
  loan: 'Loans',
};

const typeColors: Record<string, string> = {
  depository: '#10b981',
  investment: '#8b5cf6',
  crypto: '#f59e0b',
  credit: '#ef4444',
  loan: '#ef4444',
};

export default function NetWorthChart({ balanceByType }: NetWorthChartProps) {
  const data = Object.entries(balanceByType)
    .filter(([, value]) => value !== 0)
    .map(([type, value]) => ({
      name: typeLabels[type] || type,
      value: Math.abs(value),
      isNegative: value < 0,
      type,
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">Balance Breakdown</h2>
        <p className="text-sm text-neutral-500">No account data yet</p>
      </div>
    );
  }

  const chartHeight = Math.max(120, data.length * 48);
  const summary = data.map(d => `${d.name}: ${d.isNegative ? '-' : ''}${currencyFmt.format(d.value)}`).join(', ');

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">Balance Breakdown</h2>
      <div role="img" aria-label={`Balance breakdown: ${summary}`}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }} accessibilityLayer={false}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fill: '#a3a3a3', fontSize: 13 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8 }}
              labelStyle={{ color: '#e5e5e5' }}
              formatter={(value) => currencyFmt.format(Number(value))}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
              {data.map((entry) => (
                <Cell
                  key={entry.type}
                  fill={entry.isNegative ? '#ef4444' : (typeColors[entry.type] || '#737373')}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
