'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#e08a4e', '#38bdf8', '#22c55e', '#a78bfa', '#f472b6'];

export default function AnalyticsChart({ data, series, labelFor, height = 280 }) {
  return (
    <div style={{ height }} role="img" aria-label={series.map((s) => labelFor(s)).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11, fill: '#9ca3af' }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Tooltip contentStyle={{ background: '#16161c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => <Line key={s} type="monotone" dataKey={s} name={labelFor(s)} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
