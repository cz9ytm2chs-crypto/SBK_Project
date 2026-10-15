import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '@/lib/utils';

const INK = '#141414';
const LINE = '#ddd8cc';
const STONE = '#77736b';

const dayLabel = (iso: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(iso));
const compactRub = (minor: number) =>
  new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(minor / 100);

interface Point {
  date: string;
  revenue: number;
  orders: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="border border-line bg-paper px-3 py-2 text-xs shadow-lg">
      <p className="label text-stone">{dayLabel(p.date)}</p>
      <p className="mt-1 font-medium tabular-nums">{money(p.revenue)}</p>
      <p className="text-stone tabular-nums">Заказов: {p.orders}</p>
    </div>
  );
}

export function RevenueChart({ data }: { data: Point[] }) {
  const total = data.reduce((s, d) => s + d.revenue, 0);
  return (
    <figure className="h-72 w-full" aria-label={`График выручки по дням, всего ${money(total)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={LINE} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={dayLabel}
            tick={{ fontSize: 11, fill: STONE }}
            tickLine={false}
            axisLine={{ stroke: LINE }}
            minTickGap={24}
          />
          <YAxis tickFormatter={compactRub} tick={{ fontSize: 11, fill: STONE }} tickLine={false} axisLine={false} width={72} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: STONE, strokeWidth: 1 }} />
          <Area type="monotone" dataKey="revenue" stroke={INK} strokeWidth={1.5} fill={INK} fillOpacity={0.06} activeDot={{ r: 3.5, fill: INK }} />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}
