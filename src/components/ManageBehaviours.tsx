import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { ConfirmModal } from './Modal';
import type { Behaviour } from '../types';

// ─── Emoji catalogue ──────────────────────────────────────────────────────────

const EMOJI_CATEGORIES = [
  {
    id: 'achievements',
    label: 'Achievements',
    icon: '🏆',
    emojis: [
      '⭐','🌟','✨','💫','🏆','🎯','🎖️','🏅','🥇','🥈','🥉',
      '💎','💪','👍','🙌','👏','🤝','🎉','🎊','🎁','🚀','🌈',
      '❤️','💝','💖','🔥','⚡','🌠','🦋','🎗️','🏵️','👑',
    ],
  },
  {
    id: 'home',
    label: 'Home & Chores',
    icon: '🏠',
    emojis: [
      '🧹','🧺','🧽','🪣','🫧','🍽️','🧴','🛁','🚿','🛏️',
      '🪥','🧸','🏠','🪴','🔧','🔑','🗑️','📦','🧯','🪑',
      '🛋️','🚪','🪟','🌿','🌻','🍳','🥘','🫕','🧆','🫙',
    ],
  },
  {
    id: 'school',
    label: 'School & Learning',
    icon: '📚',
    emojis: [
      '📚','📖','✏️','📝','🖊️','📐','📏','🔬','🔭','📓',
      '📒','📕','📗','📘','📙','🎓','🏫','💻','📊','📈',
      '🧮','🔢','🧪','🧬','🗺️','🖍️','📌','📎','🖇️','📋',
    ],
  },
  {
    id: 'sport',
    label: 'Sport & Activity',
    icon: '⚽',
    emojis: [
      '🏃','🚴','⚽','🏀','🎾','🏊','🤸','🧗','🥋','🏋️',
      '🤾','⛹️','🏄','🛹','🎿','🏂','🥊','🎽','🧘','🤺',
      '🏇','🎣','🏹','🛼','🤼','⛷️','🤽','🚵','🏌️','🎳',
    ],
  },
  {
    id: 'health',
    label: 'Health & Food',
    icon: '🍎',
    emojis: [
      '🍎','🥗','🥦','🥕','🍌','🍇','🫐','🍓','🥤','🍵',
      '🧃','🥛','🦷','🧼','😴','🌙','💧','🥑','🥝','🍊',
      '🍋','🫚','🥚','🍞','🧀','🥩','🐟','🥬','🍠','🫛',
    ],
  },
  {
    id: 'emotions',
    label: 'Emotions',
    icon: '😊',
    emojis: [
      '😊','😄','🤩','😁','😎','🥰','😍','🤗','😌','😇',
      '🙂','😏','😒','😞','😢','😤','😠','😡','🤦','🙄',
      '😑','😴','🤐','😈','😤','😩','😫','🥺','😭','🤧',
    ],
  },
  {
    id: 'screen',
    label: 'Screen & Tech',
    icon: '📵',
    emojis: [
      '📵','🎮','📺','📱','💻','🤳','🎧','🔇','📡','🖥️',
      '⌚','📷','🎬','🎵','🎤','📻','🕹️','🔋','📲','⌨️',
      '🖱️','💾','📀','📼','📹','🎙️','📞','☎️','📟','📠',
    ],
  },
  {
    id: 'social',
    label: 'Social & Family',
    icon: '🤝',
    emojis: [
      '🤝','🗣️','🤗','💬','🤫','🫂','👨‍👩‍👧','👨‍👩‍👦','👪','💌',
      '📫','🎀','🫶','💞','🧡','💛','💚','💙','💜','🤎',
      '🖤','🤍','💟','☮️','✌️','🤞','🫰','🤙','👋','🙏',
    ],
  },
  {
    id: 'warning',
    label: 'Attention',
    icon: '⚠️',
    emojis: [
      '⚠️','❌','🚫','⛔','🛑','🔴','💢','👎','🙅','📛',
      '🚷','😤','😠','🤬','💔','🧨','💥','🔞','☠️','💀',
      '😈','👿','🤡','👹','👺','🗡️','💣','🔥','⚡','🌩️',
    ],
  },
] as const;

type CategoryId = typeof EMOJI_CATEGORIES[number]['id'];

// ─── EmojiPicker ─────────────────────────────────────────────────────────────

function EmojiPicker({
  value,
  onChange,
  kind,
}: {
  value: string;
  onChange: (emoji: string) => void;
  kind?: 'positive' | 'negative';
}) {
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState('');
  const [activeTab, setActiveTab] = useState<CategoryId>(
    kind === 'negative' ? 'warning' : 'achievements'
  );
  const ref       = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Default tab tracks kind prop changes when not open
  useEffect(() => {
    if (!open) {
      setActiveTab(kind === 'negative' ? 'warning' : 'achievements');
    }
  }, [kind, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  function pick(emoji: string) {
    onChange(emoji);
    setOpen(false);
    setSearch('');
  }

  // Search across all categories
  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
  const searchResults = search.trim()
    ? allEmojis.filter((e) => e.includes(search.trim()))
    : null;

  const displayEmojis =
    searchResults ??
    EMOJI_CATEGORIES.find((c) => c.id === activeTab)?.emojis ??
    [];

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-full dojo-input flex items-center justify-center text-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition ${
          open ? 'border-dojo-primary ring-2 ring-dojo-primary/20' : ''
        }`}
        title="Choose an emoji"
      >
        {value}
      </button>

      {/* Popover panel */}
      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-dojo flex flex-col"
          style={{ maxHeight: '420px' }}
        >
          {/* Search bar */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <input
              ref={searchRef}
              className="dojo-input w-full text-sm"
              placeholder="🔍 Search emojis…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category tabs */}
          {!search && (
            <div className="flex gap-1 px-2 py-2 overflow-x-auto shrink-0 border-b border-slate-100 dark:border-slate-700">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveTab(cat.id)}
                  title={cat.label}
                  className={`shrink-0 text-lg px-2 py-1 rounded-lg transition ${
                    activeTab === cat.id
                      ? 'bg-dojo-primary/10 ring-1 ring-dojo-primary/30'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}

          {/* Category label */}
          {!search && (
            <div className="px-3 pt-2 pb-1 shrink-0">
              <span className="text-xs font-bold text-dojo-muted uppercase tracking-wide">
                {EMOJI_CATEGORIES.find((c) => c.id === activeTab)?.label}
              </span>
            </div>
          )}

          {/* Emoji grid — scrollable */}
          <div className="overflow-y-auto p-2 flex-1">
            {displayEmojis.length === 0 ? (
              <div className="text-center text-dojo-muted text-sm py-4">No emojis found</div>
            ) : (
              <div className="grid grid-cols-8 gap-0.5">
                {displayEmojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => pick(e)}
                    className={`text-xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition leading-none ${
                      value === e ? 'bg-dojo-primary/10 ring-1 ring-dojo-primary/40' : ''
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom input fallback */}
          <div className="border-t border-slate-100 dark:border-slate-700 p-3 shrink-0">
            <div className="text-xs text-dojo-muted mb-1.5">Or paste / type any emoji:</div>
            <div className="flex items-center gap-2">
              <input
                className="dojo-input flex-1 text-xl"
                value={value}
                maxLength={8}
                onChange={(e) => onChange(e.target.value)}
                placeholder="✏️"
              />
              <span className="text-2xl">{value}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category grouping helper ─────────────────────────────────────────────────

function groupByCategory(items: Behaviour[]): Array<{ category: string; items: Behaviour[] }> {
  const map = new Map<string, Behaviour[]>();
  for (const b of items) {
    const key = b.category || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  const named: Array<{ category: string; items: Behaviour[] }> = [];
  for (const [cat, list] of map) {
    if (cat) named.push({ category: cat, items: list });
  }
  named.sort((a, b) => a.category.localeCompare(b.category));
  const uncategorised = map.get('');
  if (uncategorised?.length) named.push({ category: '', items: uncategorised });
  return named;
}

// ─── Template packs ───────────────────────────────────────────────────────────

const TEMPLATE_PACKS: Array<{
  id: string;
  name: string;
  icon: string;
  description: string;
  behaviours: Array<{ name: string; kind: 'positive' | 'negative'; points: number; icon: string; category: string; dailyLimit: number }>;
}> = [
  {
    id: 'primary-school',
    name: 'Primary School',
    icon: '📚',
    description: 'Homework, reading, and learning routines',
    behaviours: [
      { name: 'Finished all homework',   kind: 'positive', points: 15, icon: '📚', category: 'School',  dailyLimit: 1 },
      { name: 'Read for 20 minutes',     kind: 'positive', points: 8,  icon: '📖', category: 'School',  dailyLimit: 2 },
      { name: 'Practised times tables',  kind: 'positive', points: 5,  icon: '🔢', category: 'School',  dailyLimit: 1 },
      { name: 'Ready for school on time',kind: 'positive', points: 5,  icon: '⏰', category: 'School',  dailyLimit: 1 },
      { name: 'Forgot homework',         kind: 'negative', points: -5, icon: '📝', category: 'School',  dailyLimit: 0 },
    ],
  },
  {
    id: 'household-chores',
    name: 'Household Chores',
    icon: '🏠',
    description: 'Daily and weekly household responsibilities',
    behaviours: [
      { name: 'Made the bed',            kind: 'positive', points: 5,  icon: '🛏️', category: 'Chores',  dailyLimit: 1 },
      { name: 'Tidied bedroom',          kind: 'positive', points: 10, icon: '🧹', category: 'Chores',  dailyLimit: 1 },
      { name: 'Helped with dishes',      kind: 'positive', points: 8,  icon: '🍽️', category: 'Chores',  dailyLimit: 1 },
      { name: 'Put clothes away',        kind: 'positive', points: 5,  icon: '🧺', category: 'Chores',  dailyLimit: 1 },
      { name: 'Set the table',           kind: 'positive', points: 5,  icon: '🥘', category: 'Chores',  dailyLimit: 1 },
      { name: 'Left mess behind',        kind: 'negative', points: -5, icon: '🗑️', category: 'Chores',  dailyLimit: 0 },
    ],
  },
  {
    id: 'character',
    name: 'Character & Values',
    icon: '❤️',
    description: 'Kindness, respect, and social skills',
    behaviours: [
      { name: 'Was kind to sibling',     kind: 'positive', points: 10, icon: '❤️', category: 'Social',  dailyLimit: 0 },
      { name: 'Helped someone',          kind: 'positive', points: 8,  icon: '🤝', category: 'Social',  dailyLimit: 0 },
      { name: 'Stayed calm when upset',  kind: 'positive', points: 10, icon: '😌', category: 'Social',  dailyLimit: 0 },
      { name: 'Said please and thank you',kind:'positive', points: 5,  icon: '🙏', category: 'Social',  dailyLimit: 0 },
      { name: 'Rude or disrespectful',   kind: 'negative', points: -10,icon: '😤', category: 'Social',  dailyLimit: 0 },
      { name: 'Hit / physically hurt someone',kind:'negative',points:-15,icon:'✊',category:'Social',  dailyLimit: 0 },
    ],
  },
  {
    id: 'screen-time',
    name: 'Screen Time & Devices',
    icon: '📵',
    description: 'Healthy tech habits and device boundaries',
    behaviours: [
      { name: 'Put device away when asked',  kind: 'positive', points: 8,  icon: '📵', category: 'Screen Time', dailyLimit: 0 },
      { name: 'No screen before homework',   kind: 'positive', points: 10, icon: '✅', category: 'Screen Time', dailyLimit: 1 },
      { name: 'Screen-free family dinner',   kind: 'positive', points: 5,  icon: '🍽️', category: 'Screen Time', dailyLimit: 1 },
      { name: 'Used device without asking',  kind: 'negative', points: -10,icon: '📱', category: 'Screen Time', dailyLimit: 0 },
      { name: 'Stayed up late on device',    kind: 'negative', points: -10,icon: '🌙', category: 'Screen Time', dailyLimit: 0 },
      { name: 'Went over screen time limit', kind: 'negative', points: -5, icon: '⏱️', category: 'Screen Time', dailyLimit: 0 },
    ],
  },
];

// ─── ManageBehaviours ─────────────────────────────────────────────────────────

export function ManageBehaviours() {
  const refresh  = useApp((s) => s.refreshBehaviours);
  const children = useApp((s) => s.children);

  const [allBehaviours, setAllBehaviours] = useState<Behaviour[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [showTemplatePacks, setShowTemplatePacks] = useState(false);
  const [importingPack, setImportingPack] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Per-child visibility
  const [visChildId, setVisChildId]   = useState<number | null>(null);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);

  const loadAll = useCallback(async () => {
    const all = await window.dojo.listAllBehaviours();
    setAllBehaviours(all);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Set default selected child for visibility panel
  useEffect(() => {
    if (children.length > 0 && visChildId === null) {
      setVisChildId(children[0].id);
    }
  }, [children, visChildId]);

  // Load excludes when selected child changes
  useEffect(() => {
    if (visChildId === null) return;
    window.dojo.listBehaviourExcludes(visChildId)
      .then(setExcludedIds)
      .catch(() => setExcludedIds([]));
  }, [visChildId]);

  async function toggleExclude(behaviourId: number) {
    if (visChildId === null) return;
    const newIds = await window.dojo.toggleBehaviourExclude({ childId: visChildId, behaviourId });
    setExcludedIds(newIds);
  }

  // Form state
  const [name, setName]           = useState('');
  const [kind, setKind]           = useState<'positive' | 'negative'>('positive');
  const [points, setPoints]       = useState(5);
  const [icon, setIcon]           = useState('⭐');
  const [category, setCategory]   = useState('');
  const [dailyLimit, setDailyLimit] = useState(0);

  function handleKindChange(k: 'positive' | 'negative') {
    setKind(k);
    if (icon === '⭐' || icon === '⚠️') {
      setIcon(k === 'negative' ? '⚠️' : '⭐');
    }
  }

  async function add() {
    if (!name.trim()) return;
    const signedPoints = kind === 'negative' ? -Math.abs(points) : Math.abs(points);
    await window.dojo.addBehaviour({ name: name.trim(), kind, points: signedPoints, icon, category, dailyLimit: kind === 'positive' ? dailyLimit : 0 });
    setName('');
    setPoints(5);
    setIcon(kind === 'negative' ? '⚠️' : '⭐');
    setCategory('');
    setDailyLimit(0);
    await loadAll();
    await refresh();
  }

  async function importPack(packId: string) {
    const pack = TEMPLATE_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    setImportingPack(packId);
    setImportMsg(null);
    for (const b of pack.behaviours) {
      const signedPoints = b.kind === 'negative' ? -Math.abs(b.points) : b.points;
      await window.dojo.addBehaviour({ name: b.name, kind: b.kind, points: signedPoints, icon: b.icon, category: b.category, dailyLimit: b.dailyLimit });
    }
    await loadAll();
    await refresh();
    setImportingPack(null);
    setImportMsg(`✅ Imported ${pack.behaviours.length} behaviours from "${pack.name}"`);
    setTimeout(() => setImportMsg(null), 3000);
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    await window.dojo.deleteBehaviour(deleteTarget.id);
    setDeleteTarget(null);
    await loadAll();
    await refresh();
  }

  async function updateRow(id: number, patch: { name?: string; points?: number; icon?: string; category?: string; daily_limit?: number }) {
    await window.dojo.updateBehaviour({ id, ...patch });
    await loadAll();
    await refresh();
  }

  async function toggleActive(b: Behaviour) {
    const next: 0 | 1 = b.active === 1 ? 0 : 1;
    await window.dojo.setBehaviourActive({ id: b.id, active: next });
    await loadAll();
    await refresh();
  }

  const positives = allBehaviours.filter((b) => b.kind === 'positive');
  const negatives = allBehaviours.filter((b) => b.kind === 'negative');

  // Unique categories for autocomplete + filter chips
  const allCategories = [...new Set(allBehaviours.map((b) => b.category).filter(Boolean))].sort();

  return (
    <div className="space-y-6">

      {/* ── Add behaviour form ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-3">Add a behaviour</div>
        <div className="flex flex-wrap gap-3">
          <input
            className="dojo-input flex-1 min-w-48"
            placeholder='e.g. "Finished homework"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select
            className="dojo-input"
            value={kind}
            onChange={(e) => handleKindChange(e.target.value as 'positive' | 'negative')}
          >
            <option value="positive">Positive (earns)</option>
            <option value="negative">Needs attention (deducts)</option>
          </select>
          <input
            type="number"
            className="dojo-input w-28"
            placeholder="Points"
            value={points}
            min={1}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
          {/* Emoji picker */}
          <div className="w-16 shrink-0">
            <EmojiPicker value={icon} onChange={setIcon} kind={kind} />
          </div>
        </div>
        {/* Category + daily limit row */}
        <div className="flex flex-wrap gap-3 mt-3">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-dojo-muted mb-1">
              Category <span className="font-normal">(optional)</span>
            </label>
            <input
              className="dojo-input w-full"
              placeholder='e.g. "School", "Chores"'
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="category-suggestions">
              {allCategories.map((cat) => <option key={cat} value={cat} />)}
            </datalist>
          </div>
          {kind === 'positive' && (
            <div className="w-48">
              <label className="block text-xs font-semibold text-dojo-muted mb-1">
                Daily limit <span className="font-normal">(0 = unlimited)</span>
              </label>
              <input
                type="number"
                className="dojo-input w-full"
                placeholder="0"
                value={dailyLimit}
                min={0}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
              />
            </div>
          )}
        </div>
        <div className="mt-3">
          <button className="dojo-btn-primary" onClick={add}>
            Add behaviour
          </button>
        </div>
      </div>

      {/* ── Template packs ── */}
      <div className="dojo-card">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowTemplatePacks((v) => !v)}
        >
          <div>
            <div className="font-display font-semibold text-lg text-left">📦 Template packs</div>
            <div className="text-sm text-dojo-muted text-left">Import ready-made behaviour sets in one click</div>
          </div>
          <span className={`text-dojo-muted transition-transform text-xl ${showTemplatePacks ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {showTemplatePacks && (
          <div className="mt-4 grid md:grid-cols-3 gap-4">
            {TEMPLATE_PACKS.map((pack) => (
              <div key={pack.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2">
                <div className="text-2xl">{pack.icon}</div>
                <div className="font-semibold">{pack.name}</div>
                <div className="text-xs text-dojo-muted flex-1">{pack.description}</div>
                <div className="text-xs text-dojo-muted">{pack.behaviours.length} behaviours</div>
                <button
                  className="dojo-btn-primary text-sm mt-1 disabled:opacity-50"
                  disabled={importingPack === pack.id}
                  onClick={() => importPack(pack.id)}
                >
                  {importingPack === pack.id ? 'Importing…' : 'Import pack'}
                </button>
              </div>
            ))}
          </div>
        )}
        {importMsg && (
          <div className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">{importMsg}</div>
        )}
      </div>

      {/* ── Behaviour lists ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <BehaviourList
          title="Positive behaviours"
          activeItems={positives.filter((b) => b.active === 1)}
          pausedItems={positives.filter((b) => b.active === 0)}
          categories={allCategories}
          onToggle={toggleActive}
          onRemove={(id, name) => setDeleteTarget({ id, name })}
          onUpdate={updateRow}
        />
        <BehaviourList
          title="Needs Attention"
          activeItems={negatives.filter((b) => b.active === 1)}
          pausedItems={negatives.filter((b) => b.active === 0)}
          categories={allCategories}
          onToggle={toggleActive}
          onRemove={(id, name) => setDeleteTarget({ id, name })}
          onUpdate={updateRow}
        />
      </div>

      {/* ── Per-child behaviour visibility ── */}
      {children.length > 0 && (
        <div className="dojo-card">
          <div className="font-display font-semibold text-lg mb-1">Per-child visibility</div>
          <p className="text-sm text-dojo-muted mb-4">
            Hide specific behaviours from individual children's screen without deactivating them globally.
            Unchecked behaviours won't appear for that child.
          </p>

          {/* Child picker */}
          <div className="flex flex-wrap gap-2 mb-4">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setVisChildId(c.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition ${
                  c.id === visChildId
                    ? 'bg-dojo-primary text-white border-dojo-primary'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-dojo-primary/50'
                }`}
              >
                <span>{c.avatar_emoji}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          {/* Behaviour toggles */}
          {allBehaviours.filter((b) => b.active === 1).length === 0 ? (
            <div className="text-dojo-muted text-sm">No active behaviours yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {allBehaviours.filter((b) => b.active === 1).map((b) => {
                const isExcluded = excludedIds.includes(b.id);
                return (
                  <div key={b.id} className="flex items-center gap-3 py-2.5">
                    <button
                      onClick={() => toggleExclude(b.id)}
                      className={`shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition ${
                        isExcluded
                          ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                          : 'bg-dojo-primary border-dojo-primary'
                      }`}
                      title={isExcluded ? 'Click to show for this child' : 'Click to hide for this child'}
                    >
                      {!isExcluded && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                    <span className="text-xl">{b.icon}</span>
                    <span className={`flex-1 font-semibold ${isExcluded ? 'text-dojo-muted line-through' : ''}`}>
                      {b.name}
                    </span>
                    {b.category && (
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-dojo-muted">
                        {b.category}
                      </span>
                    )}
                    <span className={`text-sm tabular-nums ${b.kind === 'positive' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {b.points > 0 ? `+${b.points}` : b.points}
                    </span>
                    <span className="text-xs text-dojo-muted shrink-0">
                      {isExcluded ? 'Hidden' : 'Visible'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        icon="🗑️"
        title={`Remove "${deleteTarget?.name ?? ''}"?`}
        message="This behaviour will be permanently removed. Past history entries that used it will remain."
        confirmLabel="Remove"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── BehaviourList ────────────────────────────────────────────────────────────

function BehaviourList({
  title, activeItems, pausedItems, categories, onToggle, onRemove, onUpdate,
}: {
  title: string;
  activeItems: Behaviour[];
  pausedItems: Behaviour[];
  categories: string[];
  onToggle: (b: Behaviour) => void;
  onRemove: (id: number, name: string) => void;
  onUpdate: (id: number, patch: { name?: string; points?: number; icon?: string; category?: string; daily_limit?: number }) => void;
}) {
  const [filterCat, setFilterCat] = useState('');

  const filteredActive = filterCat ? activeItems.filter((b) => b.category === filterCat) : activeItems;
  const filteredPaused = filterCat ? pausedItems.filter((b) => b.category === filterCat) : pausedItems;

  // Group active items by category
  const groups = groupByCategory(filteredActive);

  // Categories that actually appear in this list (positive or negative)
  const relevantCats = categories.filter((cat) =>
    [...activeItems, ...pausedItems].some((b) => b.category === cat),
  );

  return (
    <div className="dojo-card">
      <div className="font-display font-semibold text-lg mb-3">
        {title}
        <span className="ml-2 text-sm font-normal text-dojo-muted">
          ({activeItems.length}
          {pausedItems.length > 0 ? ` active, ${pausedItems.length} paused` : ''})
        </span>
      </div>

      {/* Category filter chips */}
      {relevantCats.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setFilterCat('')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
              !filterCat
                ? 'bg-dojo-primary text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-dojo-muted hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            All
          </button>
          {relevantCats.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat((f) => (f === cat ? '' : cat))}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                filterCat === cat
                  ? 'bg-dojo-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-dojo-muted hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {activeItems.length === 0 && pausedItems.length === 0 ? (
        <div className="text-dojo-muted text-sm">None yet.</div>
      ) : (
        <>
          {filteredActive.length === 0 && filteredPaused.length === 0 ? (
            <div className="text-dojo-muted text-sm py-1">No behaviours in this category.</div>
          ) : filteredActive.length === 0 ? (
            <div className="text-dojo-muted text-sm py-1">All paused.</div>
          ) : (
            <div>
              {groups.map(({ category, items }) => (
                <div key={category || '__none__'}>
                  {/* Category group header — only when multiple categories exist */}
                  {relevantCats.length > 1 && !filterCat && category && (
                    <div className="flex items-center gap-2 mt-3 mb-1 first:mt-0">
                      <span className="text-xs font-bold text-dojo-muted uppercase tracking-wide">{category}</span>
                      <div className="h-px flex-1 bg-slate-100 dark:bg-slate-700" />
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((b) => (
                      <BehaviourRow key={b.id} b={b} onToggle={onToggle} onRemove={onRemove} onUpdate={onUpdate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredPaused.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs font-bold text-dojo-muted uppercase tracking-wide">
                  Paused ({filteredPaused.length})
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700 opacity-60">
                {filteredPaused.map((b) => (
                  <BehaviourRow key={b.id} b={b} paused onToggle={onToggle} onRemove={onRemove} onUpdate={onUpdate} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ─── BehaviourRow ─────────────────────────────────────────────────────────────

function BehaviourRow({
  b, paused = false, onToggle, onRemove, onUpdate,
}: {
  b: Behaviour;
  paused?: boolean;
  onToggle: (b: Behaviour) => void;
  onRemove: (id: number, name: string) => void;
  onUpdate: (id: number, patch: { name?: string; points?: number; icon?: string; category?: string; daily_limit?: number }) => void;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2">
        <div className="w-12 shrink-0">
          {paused ? (
            <span className="flex items-center justify-center text-2xl w-12 h-10">{b.icon}</span>
          ) : (
            <EmojiPicker
              value={b.icon}
              onChange={(emoji) => onUpdate(b.id, { icon: emoji })}
              kind={b.kind as 'positive' | 'negative'}
            />
          )}
        </div>
        <input
          className="flex-1 min-w-0 bg-transparent font-semibold border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-lg px-2 py-1 truncate"
          defaultValue={b.name}
          disabled={paused}
          onBlur={(e) => e.target.value !== b.name && onUpdate(b.id, { name: e.target.value })}
        />
        <input
          type="number"
          className="w-20 bg-transparent tabular-nums text-right border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-lg px-2 py-1 shrink-0"
          defaultValue={b.points}
          disabled={paused}
          onBlur={(e) =>
            Number(e.target.value) !== b.points &&
            onUpdate(b.id, { points: Number(e.target.value) })
          }
        />
        {paused ? (
          <button
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition"
            onClick={() => onToggle(b)}
          >
            ▶ Enable
          </button>
        ) : (
          <button
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-xl transition"
            title="Pause — hides from kid view without deleting"
            onClick={() => onToggle(b)}
          >
            ⏸ Pause
          </button>
        )}
        <button
          className="shrink-0 px-2.5 py-1.5 text-xs text-dojo-danger hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition"
          title="Permanently remove"
          onClick={() => onRemove(b.id, b.name)}
        >
          ✕
        </button>
      </div>
      {!paused && (
        <div className="flex items-center gap-3 mt-1 ml-14">
          <input
            className="text-xs bg-transparent text-dojo-muted border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-lg px-2 py-0.5 w-32"
            defaultValue={b.category ?? ''}
            placeholder="Category..."
            list="category-suggestions"
            onBlur={(e) => e.target.value !== (b.category ?? '') && onUpdate(b.id, { category: e.target.value })}
          />
          {b.kind === 'positive' && (
            <div className="flex items-center gap-1 text-xs text-dojo-muted">
              <span>Daily limit:</span>
              <input
                type="number"
                className="w-16 bg-transparent tabular-nums border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-lg px-2 py-0.5 text-xs"
                defaultValue={b.daily_limit ?? 0}
                min={0}
                onBlur={(e) =>
                  Number(e.target.value) !== (b.daily_limit ?? 0) &&
                  onUpdate(b.id, { daily_limit: Number(e.target.value) })
                }
              />
              <span className="text-dojo-muted/60">(0 = inf)</span>
            </div>
          )}
        </div>
      )}
      {paused && (b.category || b.daily_limit) && (
        <div className="flex items-center gap-3 mt-1 ml-14 text-xs text-dojo-muted">
          {b.category && <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{b.category}</span>}
          {b.kind === 'positive' && b.daily_limit > 0 && <span>Limit: {b.daily_limit}/day</span>}
        </div>
      )}
    </div>
  );
}
