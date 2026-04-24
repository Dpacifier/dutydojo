export type Child = {
  id: number;
  name: string;
  avatar_emoji: string;
  goal_points: number;
  consequence_threshold: number;
  archived: number; // 0 | 1
  notes: string;
  theme_color: string; // hex colour e.g. '#6366f1'
  created_at: string;
};

export type Behaviour = {
  id: number;
  name: string;
  kind: 'positive' | 'negative';
  points: number;
  icon: string;
  active: number;
  daily_limit: number; // 0 = unlimited
  category: string;
};

export type Reward = {
  id: number;
  name: string;
  cost: number;
  icon: string;
  active: number;
};

export type Consequence = {
  id: number;
  name: string;
  icon: string;
  description: string;
  active: number;
  created_at: string;
};

export type AssignedConsequence = {
  id: number;
  child_id: number;
  consequence_id: number;
  duration_days: number;
  assigned_at: string;
  expires_at: string | null;
  resolved: number;
  resolved_at: string | null;
  note: string;
  // joined
  consequence_name: string;
  consequence_icon: string;
  consequence_description: string;
  child_name: string;
  child_avatar: string;
};

export type HistoryEntry = {
  id: number;
  child_id: number;
  delta: number;
  reason: string;
  kind: 'positive' | 'negative' | 'reward' | 'manual';
  behaviour_id: number | null;
  reward_id: number | null;
  fulfilled: number; // 0 = pending, 1 = fulfilled
  note: string;
  created_at: string;
};

export type HistoryExportRow = HistoryEntry & {
  child_name: string;
  child_avatar: string;
};

export type ParentSettings = {
  default_start_points: number;
  default_goal_points: number;
  default_threshold: number;
  require_approval: number; // 0 | 1
  max_points_per_day: number; // 0 = unlimited
};

export type PendingBehaviour = {
  id: number;
  child_id: number;
  behaviour_id: number;
  created_at: string;
  // joined
  child_name: string;
  child_avatar: string;
  behaviour_name: string;
  behaviour_icon: string;
  behaviour_points: number;
  behaviour_kind: 'positive' | 'negative';
};

export type BehaviourTrend = {
  daily: Array<{ day: string; count: number; delta: number }>;
  totalCount: number;
  totalDelta: number;
  peakDay: string | null;
  peakCount: number;
};

export type ReportSummary = {
  daily: Array<{ day: string; earned: number; deducted: number }>;
  frequent: Array<{ reason: string; count: number; total_delta: number }>;
  balance: number;
  totalEarned: number;
  totalDeducted: number;
  totalRewardsClaimed: number;
  topClaimedRewards: Array<{ reason: string; count: number }>;
};

export type SiblingSnapshot = {
  child_id: number;
  child_name: string;
  child_avatar: string;
  theme_color: string;
  balance: number;
  earned_this_week: number;
  streak: number;
};

export type DojoApi = {
  // Auth
  isSetup: () => Promise<boolean>;
  setupParent: (payload: { name: string; password: string }) => Promise<boolean>;
  verifyParent: (password: string) => Promise<boolean>;
  changeParentPassword: (payload: { oldPassword: string; newPassword: string }) => Promise<boolean>;
  hasRecovery: () => Promise<boolean>;
  getRecoveryQuestion: () => Promise<string | null>;
  setRecovery: (payload: { question: string; answer: string }) => Promise<void>;
  verifyRecoveryAndReset: (payload: { answer: string; newPassword: string }) => Promise<boolean>;
  // Kid PIN
  hasKidPin: () => Promise<boolean>;
  setKidPin: (pin: string) => Promise<boolean>;
  verifyKidPin: (pin: string) => Promise<boolean>;
  clearKidPin: () => Promise<boolean>;

  // Parent settings
  getSettings: () => Promise<ParentSettings>;
  saveSettings: (payload: ParentSettings) => Promise<boolean>;

  // Children
  listChildren: () => Promise<Child[]>;
  listAllChildren: () => Promise<Child[]>;
  addChild: (payload: {
    name: string;
    avatarEmoji?: string;
    goalPoints?: number;
    consequenceThreshold?: number;
    initialPoints?: number;
    themeColor?: string;
  }) => Promise<Child>;
  updateChild: (payload: {
    id: number;
    name?: string;
    avatarEmoji?: string;
    goalPoints?: number;
    consequenceThreshold?: number;
    notes?: string;
    themeColor?: string;
  }) => Promise<Child>;
  archiveChild: (id: number) => Promise<boolean>;
  unarchiveChild: (id: number) => Promise<boolean>;
  deleteChild: (id: number) => Promise<boolean>;

  // Behaviours
  listBehaviours: () => Promise<Behaviour[]>;
  listAllBehaviours: () => Promise<Behaviour[]>;
  setBehaviourActive: (payload: { id: number; active: 0 | 1 }) => Promise<boolean>;
  addBehaviour: (payload: {
    name: string;
    kind: 'positive' | 'negative';
    points: number;
    icon?: string;
    dailyLimit?: number;
    category?: string;
  }) => Promise<Behaviour>;
  updateBehaviour: (payload: {
    id: number;
    name?: string;
    kind?: 'positive' | 'negative';
    points?: number;
    icon?: string;
    daily_limit?: number;
    category?: string;
  }) => Promise<Behaviour>;
  deleteBehaviour: (id: number) => Promise<boolean>;

  // Rewards
  listRewards: () => Promise<Reward[]>;
  addReward: (payload: { name: string; cost: number; icon?: string }) => Promise<Reward>;
  updateReward: (payload: { id: number; name?: string; cost?: number; icon?: string }) => Promise<Reward>;
  deleteReward: (id: number) => Promise<boolean>;
  redeemReward: (payload: { childId: number; rewardId: number }) => Promise<{
    ok: boolean;
    message?: string;
    balance?: number;
  }>;

  // Consequences (library)
  listConsequences: () => Promise<Consequence[]>;
  addConsequence: (payload: { name: string; icon: string; description: string }) => Promise<Consequence>;
  deleteConsequence: (id: number) => Promise<boolean>;

  // Consequence assignments
  assignConsequence: (payload: {
    childId: number;
    consequenceId: number;
    durationDays: number;
    note?: string;
  }) => Promise<AssignedConsequence>;
  resolveConsequence: (id: number) => Promise<boolean>;
  getActiveConsequencesForChild: (childId: number) => Promise<AssignedConsequence[]>;
  getAllActiveConsequences: () => Promise<AssignedConsequence[]>;

  // Pending behaviour approvals
  listPending: () => Promise<PendingBehaviour[]>;
  countPending: () => Promise<number>;
  addPending: (payload: { childId: number; behaviourId: number }) => Promise<PendingBehaviour>;
  approvePending: (id: number) => Promise<{ balance: number; delta: number; milestone: boolean; consequenceTriggered: boolean }>;
  rejectPending: (id: number) => Promise<boolean>;
  rejectAllPending: () => Promise<boolean>;
  approveAllPending: () => Promise<Array<{ balance: number; delta: number; milestone: boolean; consequenceTriggered: boolean }>>;

  // Points / history / reports
  applyBehaviour: (payload: { childId: number; behaviourId: number }) => Promise<{
    balance: number;
    delta: number;
    milestone: boolean;
    consequenceTriggered: boolean;
    historyId: number;
    capped?: boolean;
  }>;
  manualAdjust: (payload: { childId: number; delta: number; reason: string }) => Promise<{ balance: number }>;
  getChildPoints: (childId: number) => Promise<number>;
  getStreak: (childId: number) => Promise<number>;
  getHistory: (payload: { childId?: number; fromIso?: string; toIso?: string }) => Promise<HistoryEntry[]>;
  getClaimedRewards: (childId: number) => Promise<HistoryEntry[]>;
  markFulfilled: (historyId: number) => Promise<boolean>;
  getReport: (payload: { childId: number; days?: number }) => Promise<ReportSummary>;
  getBehaviourTrend: (payload: { childId: number; reason: string; days?: number }) => Promise<BehaviourTrend>;
  exportHistoryForChild: (childId: number) => Promise<HistoryExportRow[]>;
  exportAllHistory: () => Promise<HistoryExportRow[]>;
  getSiblingComparison: () => Promise<SiblingSnapshot[]>;
  getBalanceOverTime: (payload: { childId: number; days?: number }) => Promise<Array<{ day: string; balance: number }>>;

  // History: undo + notes
  undoHistory: (historyId: number) => Promise<{ ok: boolean; balance?: number; message?: string }>;
  updateHistoryNote: (payload: { historyId: number; note: string }) => Promise<boolean>;

  // Consequences: update
  updateConsequence: (payload: { id: number; name?: string; icon?: string; description?: string }) => Promise<Consequence>;

  // Per-child behaviour excludes
  listBehaviourExcludes: (childId: number) => Promise<number[]>;
  toggleBehaviourExclude: (payload: { childId: number; behaviourId: number }) => Promise<number[]>;

  // Backup / restore
  backupExport: () => Promise<{ ok: boolean; message?: string; path?: string }>;
  backupRestore: () => Promise<{ ok: boolean; message?: string }>;

  // Cloud sync
  cloudStatus: () => Promise<{
    configured: boolean;
    connected: boolean;
    email: string;
    lastSync: string;
    resendKey: boolean;
    notifEmail: string;
    weeklyDigest: boolean;
    approvalAlerts: boolean;
  }>;
  cloudSignUp: (payload: { email: string; password: string }) => Promise<{ ok: boolean; error?: string; needsConfirmation?: boolean }>;
  cloudSignIn: (payload: { email: string; password: string }) => Promise<{ ok: boolean; error?: string; pulled?: number }>;
  cloudSignOut: () => Promise<boolean>;
  cloudSyncNow: () => Promise<{ ok: boolean; pulled?: number; error?: string }>;
  cloudSaveEmailConfig: (payload: { resendKey: string; notifEmail: string; weeklyDigest: boolean; approvalAlerts: boolean }) => Promise<boolean>;
  cloudSendTestEmail: (payload: { apiKey: string; to: string }) => Promise<{ ok: boolean }>;
  cloudSendWeeklyDigest: () => Promise<{ ok: boolean }>;
  cloudResetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
};

declare global {
  interface Window {
    dojo: DojoApi;
  }
}
