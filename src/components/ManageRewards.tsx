import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../store';
import { ConfirmModal, RedeemModal, EditRewardModal } from './Modal';
import type { HistoryEntry, Reward } from '../types';

export function ManageRewards() {
  const rewards  = useApp((s) => s.rewards);
  const children = useApp((s) => s.children);
  const refresh  = useApp((s) => s.refreshRewards);

  const [name, setName] = useState('');
  const [cost, setCost] = useState(50);
  const [icon, setIcon] = useState('🎁');

  // Balances for the redeem picker
  const [balances, setBalances] = useState<Record<number, number>>({});

  // Child IDs that have at least one active consequence (blocks reward redemption)
  const [blockedChildIds, setBlockedChildIds] = useState<Set<number>>(new Set());

  // Claimed rewards state
  const [claimedChildId, setClaimedChildId] = useState<number | null>(null);
  const [claimed, setClaimed] = useState<HistoryEntry[]>([]);

  // Modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [redeemTarget, setRedeemTarget] = useState<{
    id: number; name: string; icon: string; cost: number;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<Reward | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ id: number; text: string; ok: boolean } | null>(null);

  function showToast(text: string, ok: boolean) {
    const id = Date.now();
    setToast({ id, text, ok });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2800);
  }

  // Load child balances + active consequences whenever children list changes
  useEffect(() => {
    if (children.length === 0) return;
    (async () => {
      const [pairs, activeConsequences] = await Promise.all([
        Promise.all(
          children.map(async (c) => [c.id, await window.dojo.getChildPoints(c.id)] as const)
        ),
        window.dojo.getAllActiveConsequences(),
      ]);
      setBalances(Object.fromEntries(pairs));
      setBlockedChildIds(new Set(activeConsequences.map((ac) => ac.child_id)));
      // Default to first child for claimed rewards view
      if (claimedChildId === null && children.length > 0) {
        setClaimedChildId(children[0].id);
      }
    })();
  }, [children]);

  // Load claimed rewards when child selection changes
  useEffect(() => {
    if (claimedChildId === null) return;
    (async () => {
      const entries = await window.dojo.getClaimedRewards(claimedChildId);
      setClaimed(entries);
    })();
  }, [claimedChildId]);

  async function add() {
    if (!name.trim()) return;
    await window.dojo.addReward({ name: name.trim(), cost, icon });
    setName('');
    setCost(50);
    await refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await window.dojo.deleteReward(deleteTarget.id);
    setDeleteTarget(null);
    await refresh();
  }

  async function confirmEdit(patch: { name: string; cost: number; icon: string }) {
    if (!editTarget) return;
    await window.dojo.updateReward({ id: editTarget.id, ...patch });
    setEditTarget(null);
    await refresh();
    showToast('✅ Reward updated!', true);
  }

  async function confirmRedeem(childId: number) {
    if (!redeemTarget) return;
    const child = children.find((c) => c.id === childId);
    const res = await window.dojo.redeemReward({ childId, rewardId: redeemTarget.id });
    setRedeemTarget(null);
    if (!res.ok) {
      showToast(res.message ?? 'Could not redeem reward.', false);
    } else {
      setBalances((prev) => ({ ...prev, [childId]: res.balance! }));
      showToast(
        `🎉 ${child?.name ?? 'Child'} redeemed ${redeemTarget.name}! ${res.balance} pts remaining.`,
        true
      );
      // Refresh claimed rewards if this child is currently selected
      if (claimedChildId === childId) {
        const entries = await window.dojo.getClaimedRewards(childId);
        setClaimed(entries);
      }
    }
    // Refresh active consequences in case a parent resolved one mid-session
    window.dojo.getAllActiveConsequences()
      .then((ac) => setBlockedChildIds(new Set(ac.map((a) => a.child_id))))
      .catch(() => {});
  }

  async function markFulfilled(historyId: number) {
    await window.dojo.markFulfilled(historyId);
    if (claimedChildId !== null) {
      const entries = await window.dojo.getClaimedRewards(claimedChildId);
      setClaimed(entries);
    }
    showToast('✅ Reward marked as fulfilled!', true);
  }

  const pendingCount = claimed.filter((e) => e.fulfilled === 0).length;

  return (
    <div className="space-y-6">

      {/* ── Add reward form ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-3">Add a reward</div>
        <div className="grid md:grid-cols-4 gap-3">
          <input
            className="dojo-input md:col-span-2"
            placeholder='e.g. "Ice cream trip"'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            className="dojo-input"
            placeholder="Cost in points"
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
          />
          <input
            className="dojo-input"
            placeholder="Icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <button className="dojo-btn-primary" onClick={add}>Add reward</button>
        </div>
      </div>

      {/* ── Available rewards list ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-3">Rewards ({rewards.length})</div>
        {rewards.length === 0 ? (
          <div className="text-dojo-muted text-sm">No rewards yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {rewards.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="text-3xl">{r.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-sm text-dojo-muted">{r.cost} points</div>
                </div>
                <button
                  className="dojo-btn-ghost"
                  onClick={() =>
                    setRedeemTarget({ id: r.id, name: r.name, icon: r.icon, cost: r.cost })
                  }
                >
                  Redeem
                </button>
                <button
                  className="dojo-btn-ghost"
                  onClick={() => setEditTarget(r)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="px-3 py-2 text-sm text-dojo-danger hover:bg-red-50 rounded-xl transition"
                  onClick={() => setDeleteTarget({ id: r.id, name: r.name })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Claimed rewards section ── */}
      {children.length > 0 && (
        <div className="dojo-card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="font-display font-semibold text-lg">Claimed rewards</div>
              {pendingCount > 0 && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                  {pendingCount} pending
                </span>
              )}
            </div>
            {/* Child picker */}
            <div className="flex gap-2 flex-wrap">
              {children.map((c) => (
                <button
                  key={c.id}
                  className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition ${
                    c.id === claimedChildId
                      ? 'bg-dojo-primary text-white border-dojo-primary'
                      : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-dojo-primary/50'
                  }`}
                  onClick={() => setClaimedChildId(c.id)}
                >
                  {c.avatar_emoji} {c.name}
                </button>
              ))}
            </div>
          </div>

          {claimed.length === 0 ? (
            <div className="text-dojo-muted text-sm">No rewards claimed yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {claimed.map((entry) => {
                const isFulfilled = entry.fulfilled === 1;
                const rewardName = entry.reason.replace('Redeemed: ', '');
                const date = new Date(entry.created_at).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                });
                return (
                  <div key={entry.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{rewardName}</div>
                      <div className="text-xs text-dojo-muted">
                        {date} · {Math.abs(entry.delta)} pts
                      </div>
                    </div>
                    {isFulfilled ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        ✅ Fulfilled
                      </span>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-1 rounded-full transition"
                        onClick={() => markFulfilled(entry.id)}
                      >
                        🕐 Pending — mark fulfilled
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── How rewards work ── */}
      <div className="dojo-card bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50">
        <div className="font-semibold text-amber-700 mb-1">How rewards work</div>
        <div className="text-sm text-dojo-muted space-y-1.5">
          <p>
            Rewards are things children can <strong>spend their points on</strong>. Each reward has a
            point cost — when a child reaches that amount, a parent clicks <em>Redeem</em> to spend
            their points and claim the reward.
          </p>
          <p>
            Claimed rewards start as <strong>Pending</strong> until the parent delivers them and marks
            them <strong>Fulfilled</strong> in the claimed rewards list below. This creates a clear
            record of what was promised and what has been given.
          </p>
          <p>
            Points are deducted at the time of redemption. The child keeps any remaining points and
            continues earning towards the next reward or trophy milestone.
          </p>
        </div>
      </div>

      {/* ── Modals ── */}
      <ConfirmModal
        open={deleteTarget !== null}
        icon="🗑️"
        title={`Remove "${deleteTarget?.name ?? ''}"?`}
        message="This reward will be removed. Past redemptions in the history log will remain."
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <RedeemModal
        open={redeemTarget !== null}
        rewardName={redeemTarget?.name ?? ''}
        rewardIcon={redeemTarget?.icon ?? '🎁'}
        rewardCost={redeemTarget?.cost ?? 0}
        children={children}
        balances={balances}
        blockedChildIds={blockedChildIds}
        onConfirm={confirmRedeem}
        onCancel={() => setRedeemTarget(null)}
      />
      <EditRewardModal
        open={editTarget !== null}
        reward={editTarget}
        onConfirm={confirmEdit}
        onCancel={() => setEditTarget(null)}
      />

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-white font-bold shadow-dojo z-50 whitespace-nowrap ${
              toast.ok ? 'bg-dojo-success' : 'bg-dojo-danger'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
