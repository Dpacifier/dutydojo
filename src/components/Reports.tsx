import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../store';
import type { BehaviourTrend, ReportSummary, SiblingSnapshot } from '../types';

const TIME_WINDOWS = [
  { label: '7d',   days: 7   },
  { label: '14d',  days: 14  },
  { label: '30d',  days: 30  },
  { label: '90d',  days: 90  },
  { label: 'All',  days: 0   },
];

export function Reports() {
  const children       = useApp((s) => s.children);
  const activeChildId  = useApp((s) => s.activeChildId);
  const setActiveChild = useApp((s) => s.setActiveChild);
  const [days, setDays] = useState(14);
  const [data, setData] = useState<ReportSummary | null>(null);

  // Drill-down state
  const [drillReason, setDrillReason]   = useState<string | null>(null);
  const [trend, setTrend]               = useState<BehaviourTrend | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  // Balance over time state
  const [balanceHistory, setBalanceHistory] = useState<Array<{ day: string; balance: number }>>([]);

  // Sibling comparison state
  const [sibling, setSibling] = useState<SiblingSnapshot[] | null>(null);

  useEffect(() => {
    if (!activeChildId) return;
    (async () => {
      const [res, hist] = await Promise.all([
        window.dojo.getReport({ childId: activeChildId, days }),
        window.dojo.getBalanceOverTime({ childId: activeChildId, days: days === 0 ? 365 : days }),
      ]);
      setData(res);
      setBalanceHistory(hist);
      // Close drill-down when child / window changes
      setDrillReason(null);
      setTrend(null);
    })();
  }, [activeChildId, days]);

  // Load sibling comparison once on mount (or when children change)
  useEffect(() => {
    if (children.length < 2) { setSibling(null); return; }
    window.dojo.getSiblingComparison().then(setSibling).catch(() => setSibling(null));
  }, [children]);

  // Load drill-down trend whenever drillReason changes
  useEffect(() => {
    if (!drillReason || !activeChildId) return;
    setTrendLoading(true);
    window.dojo
      .getBehaviourTrend({ childId: activeChildId, reason: drillReason, days })
      .then((t) => { setTrend(t); setTrendLoading(false); })
      .catch(() => setTrendLoading(false));
  }, [drillReason, activeChildId, days]);

  function openDrill(reason: string) {
    if (drillReason === reason) {
      setDrillReason(null);
      setTrend(null);
    } else {
      setDrillReason(reason);
      setTrend(null);
    }
  }

  function closeDrill() {
    setDrillReason(null);
    setTrend(null);
  }

  if (children.length === 0) {
    return <div className="dojo-card">Add a child first to see reports.</div>;
  }

  const netChange = data ? data.totalEarned - data.totalDeducted : 0;

  return (
    <div className="space-y-6">

      {/* ── Child + time-window selectors ── */}
      <div className="dojo-card flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button
              key={c.id}
              className={`px-3 py-2 rounded-xl border text-sm ${
                c.id === activeChildId
                  ? 'bg-dojo-primary text-white border-dojo-primary'
                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
              }`}
              onClick={() => setActiveChild(c.id)}
            >
              {c.avatar_emoji} {c.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-dojo-muted">Window:</span>
          {TIME_WINDOWS.map(({ label, days: d }) => (
            <button
              key={label}
              className={`px-3 py-1 text-sm rounded-lg border ${
                days === d
                  ? 'bg-dojo-primary text-white border-dojo-primary'
                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
              }`}
              onClick={() => setDays(d)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <>
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total earned"
              value={`+${data.totalEarned}`}
              color="text-dojo-success"
              bg="bg-emerald-50"
            />
            <StatCard
              label="Total deducted"
              value={`-${data.totalDeducted}`}
              color="text-dojo-danger"
              bg="bg-red-50"
            />
            <StatCard
              label="Net change"
              value={netChange >= 0 ? `+${netChange}` : `${netChange}`}
              color={netChange >= 0 ? 'text-dojo-primary' : 'text-dojo-danger'}
              bg="bg-violet-50"
            />
            <StatCard
              label="Rewards claimed"
              value={String(data.totalRewardsClaimed)}
              color="text-amber-600"
              bg="bg-amber-50"
            />
          </div>

          {/* ── Daily earned vs deducted chart ── */}
          <div className="dojo-card">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display font-semibold text-lg">Earned vs deducted</div>
              <div className="text-2xl font-bold tabular-nums text-dojo-primary">
                {data.balance} pts total
              </div>
            </div>
            {data.daily.length === 0 ? (
              <div className="text-dojo-muted text-sm py-8 text-center">No activity in this window.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={data.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="earned"   fill="#10B981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="deducted" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Balance over time ── */}
          {balanceHistory.length > 1 && (
            <div className="dojo-card">
              <div className="font-display font-semibold text-lg mb-3">Balance over time</div>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={balanceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) =>
                        new Date(v + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      }
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(label: string) =>
                        new Date(label + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                      }
                      formatter={(value: number) => [value, 'Balance']}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="#6D28D9"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Most frequent behaviours + most claimed rewards ── */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Frequent behaviours — bars are clickable */}
            <div className="dojo-card">
              <div className="flex items-center justify-between mb-1">
                <div className="font-display font-semibold text-lg">Most frequent behaviours</div>
                {data.frequent.length > 0 && (
                  <span className="text-xs text-dojo-muted italic">click a bar to drill in</span>
                )}
              </div>
              {data.frequent.length === 0 ? (
                <div className="text-dojo-muted text-sm mt-2">No behaviours logged in this window yet.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart
                      data={data.frequent}
                      layout="vertical"
                      onClick={(e) => {
                        if (e?.activePayload?.[0]?.payload?.reason) {
                          openDrill(e.activePayload[0].payload.reason);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="reason" type="category" width={150} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {data.frequent.map((entry) => (
                          <Cell
                            key={entry.reason}
                            fill={drillReason === entry.reason ? '#4C1D95' : '#6D28D9'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Most claimed rewards */}
            <div className="dojo-card">
              <div className="font-display font-semibold text-lg mb-3">Most claimed rewards</div>
              {data.topClaimedRewards.length === 0 ? (
                <div className="text-dojo-muted text-sm">No rewards claimed in this window yet.</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.topClaimedRewards.map((r, i) => (
                    <div key={r.reason} className="flex items-center gap-3 py-2.5">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">
                        {r.reason.replace('Redeemed: ', '')}
                      </span>
                      <span className="text-sm font-bold text-amber-600 tabular-nums">
                        ×{r.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Sibling comparison ── */}
          {sibling && sibling.length >= 2 && (
            <div className="dojo-card">
              <div className="font-display font-semibold text-lg mb-3">Sibling comparison (last 7 days)</div>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart
                    data={sibling.map((s) => ({
                      name: `${s.child_avatar} ${s.child_name}`,
                      earned: s.earned_this_week,
                      balance: s.balance,
                      themeColor: s.theme_color,
                    }))}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number, key: string) => [value, key === 'earned' ? 'Earned (7d)' : 'Balance']} />
                    <Legend formatter={(v: string) => v === 'earned' ? 'Earned (7d)' : 'Current balance'} />
                    <Bar dataKey="earned"  fill="#10B981" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="balance" fill="#6D28D9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Drill-down panel ── */}
          <AnimatePresence>
            {drillReason && (
              <motion.div
                key={drillReason}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="dojo-card border-2 border-dojo-primary/30"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4 gap-2">
                  <div>
                    <div className="text-xs font-bold text-dojo-primary uppercase tracking-wide mb-0.5">
                      Behaviour drill-down
                    </div>
                    <div className="font-display font-bold text-xl leading-tight">{drillReason}</div>
                  </div>
                  <button
                    onClick={closeDrill}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 text-dojo-muted hover:bg-slate-100 dark:hover:bg-slate-700 transition text-lg leading-none"
                    title="Close drill-down"
                  >
                    ×
                  </button>
                </div>

                {trendLoading ? (
                  <div className="text-dojo-muted text-sm py-6 text-center">Loading…</div>
                ) : trend ? (
                  <>
                    {/* Mini stat row */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <MiniStat
                        label="Times logged"
                        value={String(trend.totalCount)}
                        color="text-dojo-primary"
                      />
                      <MiniStat
                        label="Total points"
                        value={trend.totalDelta >= 0 ? `+${trend.totalDelta}` : String(trend.totalDelta)}
                        color={trend.totalDelta >= 0 ? 'text-dojo-success' : 'text-dojo-danger'}
                      />
                      <MiniStat
                        label="Peak day"
                        value={
                          trend.peakDay
                            ? new Date(trend.peakDay + 'T00:00:00').toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric',
                              })
                            : '—'
                        }
                        color="text-amber-600"
                      />
                    </div>

                    {/* Day-by-day chart */}
                    {trend.daily.length === 0 ? (
                      <div className="text-dojo-muted text-sm py-4 text-center">
                        No entries in this time window.
                      </div>
                    ) : (
                      <div className="h-52">
                        <ResponsiveContainer>
                          <BarChart data={trend.daily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis
                              dataKey="day"
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v: string) =>
                                new Date(v + 'T00:00:00').toLocaleDateString(undefined, {
                                  month: 'short', day: 'numeric',
                                })
                              }
                            />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                value,
                                name === 'count' ? 'Times' : 'Points',
                              ]}
                              labelFormatter={(label: string) =>
                                new Date(label + 'T00:00:00').toLocaleDateString(undefined, {
                                  weekday: 'short', month: 'short', day: 'numeric',
                                })
                              }
                            />
                            <Legend
                              formatter={(value: string) =>
                                value === 'count' ? 'Times logged' : 'Points'
                              }
                            />
                            <Bar dataKey="count" fill="#6D28D9" radius={[4, 4, 0, 0]} />
                            <Bar
                              dataKey="delta"
                              fill={trend.totalDelta >= 0 ? '#10B981' : '#EF4444'}
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-4 border border-slate-100 dark:border-slate-700 dark:opacity-80`}>
      <div className="text-xs text-dojo-muted font-semibold uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-display text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function MiniStat({
  label, value, color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
      <div className="text-xs text-dojo-muted font-semibold uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`font-display text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
