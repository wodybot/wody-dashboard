'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// The joins and leaves chart of the server overview. Kept in its own file so the chart library loads only when it is needed.
export default function MemberGrowthArea({ data, joinsLabel, leavesLabel }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="joinsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="leavesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: '#18181b', border: '1px solid #2b2d31', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#e5e7eb' }}
        />
        <Area type="monotone" dataKey="joins" name={joinsLabel} stroke="#34d399" fill="url(#joinsFill)" strokeWidth={2} />
        <Area type="monotone" dataKey="leaves" name={leavesLabel} stroke="#fb7185" fill="url(#leavesFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
