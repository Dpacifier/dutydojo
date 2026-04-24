import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // ── Auth / setup ───────────────────────────────────────────────────────────
  isSetup: () => ipcRenderer.invoke('auth:isSetup'),
  setupParent: (payload: { name: string; password: string }) =>
    ipcRenderer.invoke('auth:setup', payload),
  verifyParent: (password: string) =>
    ipcRenderer.invoke('auth:verify', password),
  changeParentPassword: (payload: { oldPassword: string; newPassword: string }) =>
    ipcRenderer.invoke('auth:changePassword', payload),
  hasRecovery: () => ipcRenderer.invoke('auth:hasRecovery'),
  getRecoveryQuestion: () => ipcRenderer.invoke('auth:getRecoveryQuestion'),
  setRecovery: (payload: { question: string; answer: string }) =>
    ipcRenderer.invoke('auth:setRecovery', payload),
  verifyRecoveryAndReset: (payload: { answer: string; newPassword: string }) =>
    ipcRenderer.invoke('auth:verifyRecoveryAndReset', payload),
  hasKidPin: () => ipcRenderer.invoke('auth:hasKidPin'),
  setKidPin: (pin: string) => ipcRenderer.invoke('auth:setKidPin', pin),
  verifyKidPin: (pin: string) => ipcRenderer.invoke('auth:verifyKidPin', pin),
  clearKidPin: () => ipcRenderer.invoke('auth:clearKidPin'),

  // ── Parent settings ────────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload: {
    default_start_points: number;
    default_goal_points: number;
    default_threshold: number;
  }) => ipcRenderer.invoke('settings:save', payload),

  // ── Children ───────────────────────────────────────────────────────────────
  listChildren: () => ipcRenderer.invoke('children:list'),
  listAllChildren: () => ipcRenderer.invoke('children:listAll'),
  addChild: (payload: {
    name: string;
    avatarEmoji?: string;
    goalPoints?: number;
    consequenceThreshold?: number;
    initialPoints?: number;
    themeColor?: string;
  }) => ipcRenderer.invoke('children:add', payload),
  updateChild: (payload: {
    id: number;
    name?: string;
    avatarEmoji?: string;
    goalPoints?: number;
    consequenceThreshold?: number;
    notes?: string;
    themeColor?: string;
  }) => ipcRenderer.invoke('children:update', payload),
  archiveChild: (id: number) => ipcRenderer.invoke('children:archive', id),
  unarchiveChild: (id: number) => ipcRenderer.invoke('children:unarchive', id),
  deleteChild: (id: number) => ipcRenderer.invoke('children:delete', id),

  // ── Behaviours ─────────────────────────────────────────────────────────────
  listBehaviours: () => ipcRenderer.invoke('behaviours:list'),
  listAllBehaviours: () => ipcRenderer.invoke('behaviours:listAll'),
  setBehaviourActive: (payload: { id: number; active: 0 | 1 }) =>
    ipcRenderer.invoke('behaviours:setActive', payload),
  addBehaviour: (payload: {
    name: string;
    kind: 'positive' | 'negative';
    points: number;
    icon?: string;
    dailyLimit?: number;
    category?: string;
  }) => ipcRenderer.invoke('behaviours:add', payload),
  updateBehaviour: (payload: {
    id: number;
    name?: string;
    kind?: 'positive' | 'negative';
    points?: number;
    icon?: string;
    daily_limit?: number;
    category?: string;
  }) => ipcRenderer.invoke('behaviours:update', payload),
  deleteBehaviour: (id: number) => ipcRenderer.invoke('behaviours:delete', id),

  // ── Rewards ────────────────────────────────────────────────────────────────
  listRewards: () => ipcRenderer.invoke('rewards:list'),
  addReward: (payload: { name: string; cost: number; icon?: string }) =>
    ipcRenderer.invoke('rewards:add', payload),
  updateReward: (payload: { id: number; name?: string; cost?: number; icon?: string }) =>
    ipcRenderer.invoke('rewards:update', payload),
  deleteReward: (id: number) => ipcRenderer.invoke('rewards:delete', id),
  redeemReward: (payload: { childId: number; rewardId: number }) =>
    ipcRenderer.invoke('rewards:redeem', payload),

  // ── Consequences (library) ────────────────────────────────────────────────
  listConsequences: () => ipcRenderer.invoke('consequences:list'),
  addConsequence: (payload: { name: string; icon: string; description: string }) =>
    ipcRenderer.invoke('consequences:add', payload),
  deleteConsequence: (id: number) => ipcRenderer.invoke('consequences:delete', id),

  // ── Consequence assignments ───────────────────────────────────────────────
  assignConsequence: (payload: {
    childId: number;
    consequenceId: number;
    durationDays: number;
    note?: string;
  }) => ipcRenderer.invoke('childConsequences:assign', payload),
  resolveConsequence: (id: number) =>
    ipcRenderer.invoke('childConsequences:resolve', id),
  getActiveConsequencesForChild: (childId: number) =>
    ipcRenderer.invoke('childConsequences:getActiveForChild', childId),
  getAllActiveConsequences: () =>
    ipcRenderer.invoke('childConsequences:getAllActive'),

  // ── Pending behaviour approvals ───────────────────────────────────────────
  listPending: () => ipcRenderer.invoke('pending:list'),
  countPending: () => ipcRenderer.invoke('pending:count'),
  addPending: (payload: { childId: number; behaviourId: number }) =>
    ipcRenderer.invoke('pending:add', payload),
  approvePending: (id: number) => ipcRenderer.invoke('pending:approve', id),
  rejectPending: (id: number) => ipcRenderer.invoke('pending:reject', id),
  rejectAllPending: () => ipcRenderer.invoke('pending:rejectAll'),
  approveAllPending: () => ipcRenderer.invoke('pending:approveAll'),

  // ── Points / history / reports ─────────────────────────────────────────────
  applyBehaviour: (payload: { childId: number; behaviourId: number }) =>
    ipcRenderer.invoke('points:applyBehaviour', payload),
  manualAdjust: (payload: { childId: number; delta: number; reason: string }) =>
    ipcRenderer.invoke('points:manualAdjust', payload),
  getChildPoints: (childId: number) =>
    ipcRenderer.invoke('points:getForChild', childId),
  getStreak: (childId: number) =>
    ipcRenderer.invoke('history:getStreak', childId),
  getHistory: (payload: { childId?: number; fromIso?: string; toIso?: string }) =>
    ipcRenderer.invoke('history:list', payload),
  getClaimedRewards: (childId: number) =>
    ipcRenderer.invoke('history:getClaimedRewards', childId),
  markFulfilled: (historyId: number) =>
    ipcRenderer.invoke('history:markFulfilled', historyId),
  getReport: (payload: { childId: number; days?: number }) =>
    ipcRenderer.invoke('reports:summary', payload),
  getBehaviourTrend: (payload: { childId: number; reason: string; days?: number }) =>
    ipcRenderer.invoke('reports:behaviourTrend', payload),
  getSiblingComparison: () => ipcRenderer.invoke('reports:siblingComparison'),
  getBalanceOverTime: (payload: { childId: number; days?: number }) =>
    ipcRenderer.invoke('history:balanceOverTime', payload),
  exportHistoryForChild: (childId: number) =>
    ipcRenderer.invoke('history:exportForChild', childId),
  exportAllHistory: () =>
    ipcRenderer.invoke('history:exportAll'),

  // ── History: undo + notes ──────────────────────────────────────────────────
  undoHistory: (historyId: number) =>
    ipcRenderer.invoke('history:undo', historyId),
  updateHistoryNote: (payload: { historyId: number; note: string }) =>
    ipcRenderer.invoke('history:updateNote', payload),

  // ── Consequences: update ──────────────────────────────────────────────────
  updateConsequence: (payload: { id: number; name?: string; icon?: string; description?: string }) =>
    ipcRenderer.invoke('consequences:update', payload),

  // ── Per-child behaviour excludes ──────────────────────────────────────────
  listBehaviourExcludes: (childId: number) =>
    ipcRenderer.invoke('childBehaviourExcludes:list', childId),
  toggleBehaviourExclude: (payload: { childId: number; behaviourId: number }) =>
    ipcRenderer.invoke('childBehaviourExcludes:toggle', payload),

  // ── Backup / restore ──────────────────────────────────────────────────────
  backupExport: () => ipcRenderer.invoke('backup:export'),
  backupRestore: () => ipcRenderer.invoke('backup:restore'),

  // ── Cloud sync ─────────────────────────────────────────────────────────────
  cloudStatus: () => ipcRenderer.invoke('cloud:status'),
  cloudSignUp: (payload: { email: string; password: string }) =>
    ipcRenderer.invoke('cloud:signUp', payload),
  cloudSignIn: (payload: { email: string; password: string }) =>
    ipcRenderer.invoke('cloud:signIn', payload),
  cloudSignOut: () => ipcRenderer.invoke('cloud:signOut'),
  cloudSyncNow: () => ipcRenderer.invoke('cloud:syncNow'),
  cloudSaveEmailConfig: (payload: {
    resendKey: string;
    notifEmail: string;
    weeklyDigest: boolean;
    approvalAlerts: boolean;
  }) => ipcRenderer.invoke('cloud:saveEmailConfig', payload),
  cloudSendTestEmail: (payload: { apiKey: string; to: string }) =>
    ipcRenderer.invoke('cloud:sendTestEmail', payload),
  cloudSendWeeklyDigest: () => ipcRenderer.invoke('cloud:sendWeeklyDigest'),
  cloudResetPassword: (email: string) => ipcRenderer.invoke('cloud:resetPassword', email),
};

contextBridge.exposeInMainWorld('dojo', api);

export type DojoApi = typeof api;
