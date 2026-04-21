import { create } from 'zustand';
import type { Behaviour, Child, Consequence, Reward } from './types';

type View =
  | { name: 'loading' }
  | { name: 'onboarding' }
  | { name: 'kid' }
  | { name: 'parent-login' }
  | { name: 'parent-portal'; tab: ParentTab };

export type ParentTab =
  | 'children'
  | 'behaviours'
  | 'rewards'
  | 'consequences'
  | 'approvals'
  | 'history'
  | 'reports'
  | 'settings';

type AppState = {
  view: View;
  children: Child[];
  behaviours: Behaviour[];
  rewards: Reward[];
  consequences: Consequence[];
  activeChildId: number | null;
  unlocked: boolean;
  darkMode: boolean;
  requireApproval: boolean;
  pendingCount: number;

  setView: (v: View) => void;
  goParent: (tab?: ParentTab) => void;
  goKid: () => void;
  setActiveChild: (id: number | null) => void;
  refreshAll: () => Promise<void>;
  refreshChildren: () => Promise<void>;
  refreshBehaviours: () => Promise<void>;
  refreshRewards: () => Promise<void>;
  refreshConsequences: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  unlockParent: () => void;
  lockParent: () => void;
  toggleDarkMode: () => void;
  bootstrap: () => Promise<void>;
};

export const useApp = create<AppState>((set, get) => ({
  view: { name: 'loading' },
  children: [],
  behaviours: [],
  rewards: [],
  consequences: [],
  activeChildId: null,
  unlocked: false,
  darkMode: localStorage.getItem('dojo-dark') === '1',
  requireApproval: false,
  pendingCount: 0,

  setView: (v) => set({ view: v }),
  goParent: (tab = 'children') => {
    if (!get().unlocked) return set({ view: { name: 'parent-login' } });
    set({ view: { name: 'parent-portal', tab } });
  },
  goKid: () => set({ view: { name: 'kid' } }),
  setActiveChild: (id) => set({ activeChildId: id }),
  unlockParent: () => set({ unlocked: true }),
  lockParent: () => set({ unlocked: false }),
  toggleDarkMode: () => {
    const next = !get().darkMode;
    localStorage.setItem('dojo-dark', next ? '1' : '0');
    set({ darkMode: next });
  },

  refreshAll: async () => {
    await Promise.all([
      get().refreshChildren(),
      get().refreshBehaviours(),
      get().refreshRewards(),
      get().refreshConsequences(),
    ]);
  },
  refreshChildren: async () => {
    const children = await window.dojo.listChildren();
    const active = get().activeChildId;
    set({
      children,
      activeChildId: children.some((c) => c.id === active)
        ? active
        : children[0]?.id ?? null,
    });
  },
  refreshBehaviours: async () => {
    const behaviours = await window.dojo.listBehaviours();
    set({ behaviours });
  },
  refreshRewards: async () => {
    const rewards = await window.dojo.listRewards();
    set({ rewards });
  },
  refreshConsequences: async () => {
    const consequences = await window.dojo.listConsequences();
    set({ consequences });
  },
  refreshSettings: async () => {
    const s = await window.dojo.getSettings();
    set({ requireApproval: s.require_approval === 1 });
  },
  refreshPendingCount: async () => {
    const count = await window.dojo.countPending();
    set({ pendingCount: count });
  },

  bootstrap: async () => {
    const isSetup = await window.dojo.isSetup();
    if (!isSetup) {
      set({ view: { name: 'onboarding' } });
      return;
    }
    await get().refreshAll();
    await Promise.all([get().refreshSettings(), get().refreshPendingCount()]);
    set({ view: { name: 'kid' } });
  },
}));
