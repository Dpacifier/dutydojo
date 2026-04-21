import { app, dialog, Notification, type IpcMain } from 'electron';
import { supabase, restoreSession, isConfigured } from './supabaseClient';
import { pushRecord, pushAll, pullAll, setUserId, getUserId } from './syncService';
import { sendApprovalAlert, sendTestEmail, sendWeeklyDigest } from './emailService';
import fs from 'node:fs';
import path from 'node:path';
import {
  authRepo,
  behavioursRepo,
  childBehaviourExcludesRepo,
  childConsequencesRepo,
  childrenRepo,
  consequencesRepo,
  historyRepo,
  pendingRepo,
  pointsRepo,
  reportsRepo,
  rewardsRepo,
  settingsRepo,
} from './db/repositories';

import { getDb, getDbFilePath, saveDbNow } from './db/database';

export function registerIpcHandlers(ipc: IpcMain) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  ipc.handle('auth:isSetup', () => authRepo.isSetup());
  ipc.handle('auth:setup', (_e, { name, password }) => {
    authRepo.setup(name, password);
    return true;
  });
  ipc.handle('auth:verify', (_e, password: string) => authRepo.verify(password));
  ipc.handle('auth:changePassword', (_e, { oldPassword, newPassword }) =>
    authRepo.changePassword(oldPassword, newPassword)
  );
  ipc.handle('auth:hasRecovery', () => authRepo.hasRecovery());
  ipc.handle('auth:getRecoveryQuestion', () => authRepo.getRecoveryQuestion());
  ipc.handle('auth:setRecovery', (_e, { question, answer }) =>
    authRepo.setRecovery(question, answer)
  );
  ipc.handle('auth:verifyRecoveryAndReset', (_e, { answer, newPassword }) =>
    authRepo.verifyRecoveryAndReset(answer, newPassword)
  );
  ipc.handle('auth:hasKidPin', () => authRepo.hasKidPin());
  ipc.handle('auth:setKidPin', (_e, pin: string) => {
    authRepo.setKidPin(pin);
    return true;
  });
  ipc.handle('auth:verifyKidPin', (_e, pin: string) => authRepo.verifyKidPin(pin));
  ipc.handle('auth:clearKidPin', () => {
    authRepo.clearKidPin();
    return true;
  });

  // ── Parent settings ───────────────────────────────────────────────────────
  ipc.handle('settings:get', () => settingsRepo.get());
  ipc.handle('settings:save', (_e, settings) => {
    settingsRepo.save(settings);
    return true;
  });

  // ── Children ──────────────────────────────────────────────────────────────
  ipc.handle('children:list', () => childrenRepo.list());
  ipc.handle('children:listAll', () => childrenRepo.listAll());
  ipc.handle('children:add', (_e, { name, avatarEmoji, goalPoints, consequenceThreshold, initialPoints, themeColor }) =>
    childrenRepo.add(name, avatarEmoji, goalPoints, consequenceThreshold, initialPoints, themeColor)
  );
  ipc.handle('children:update', (_e, { id, ...patch }) =>
    childrenRepo.update(id, {
      name: patch.name,
      avatar_emoji: patch.avatarEmoji,
      goal_points: patch.goalPoints,
      consequence_threshold: patch.consequenceThreshold,
      notes: patch.notes,
      theme_color: patch.themeColor,
    })
  );
  ipc.handle('children:archive', (_e, id: number) => {
    childrenRepo.archive(id);
    return true;
  });
  ipc.handle('children:unarchive', (_e, id: number) => {
    childrenRepo.unarchive(id);
    return true;
  });
  ipc.handle('children:delete', (_e, id: number) => {
    childrenRepo.remove(id);
    return true;
  });

  // ── Behaviours ────────────────────────────────────────────────────────────
  ipc.handle('behaviours:list', () => behavioursRepo.list());
  ipc.handle('behaviours:listAll', () => behavioursRepo.listAll());
  ipc.handle('behaviours:add', (_e, { name, kind, points, icon, dailyLimit, category }) =>
    behavioursRepo.add(name, kind, points, icon, dailyLimit, category)
  );
  ipc.handle('behaviours:update', (_e, { id, ...patch }) => behavioursRepo.update(id, patch));
  ipc.handle('behaviours:setActive', (_e, { id, active }: { id: number; active: 0 | 1 }) => {
    behavioursRepo.setActive(id, active);
    return true;
  });
  ipc.handle('behaviours:delete', (_e, id: number) => {
    behavioursRepo.remove(id);
    return true;
  });

  // ── Rewards ───────────────────────────────────────────────────────────────
  ipc.handle('rewards:list', () => rewardsRepo.list());
  ipc.handle('rewards:add', (_e, { name, cost, icon }) => rewardsRepo.add(name, cost, icon));
  ipc.handle('rewards:update', (_e, { id, ...patch }) => rewardsRepo.update(id, patch));
  ipc.handle('rewards:delete', (_e, id: number) => {
    rewardsRepo.remove(id);
    return true;
  });
  ipc.handle('rewards:redeem', (_e, { childId, rewardId }) =>
    rewardsRepo.redeem(childId, rewardId)
  );

  // ── Consequences (library) ────────────────────────────────────────────────
  ipc.handle('consequences:list', () => consequencesRepo.list());
  ipc.handle('consequences:add', (_e, { name, icon, description }) =>
    consequencesRepo.add(name, icon, description)
  );
  ipc.handle('consequences:delete', (_e, id: number) => {
    consequencesRepo.remove(id);
    return true;
  });

  // ── Consequence assignments ───────────────────────────────────────────────
  ipc.handle('childConsequences:assign', (_e, { childId, consequenceId, durationDays, note }) =>
    childConsequencesRepo.assign(childId, consequenceId, durationDays, note)
  );
  ipc.handle('childConsequences:resolve', (_e, id: number) => {
    childConsequencesRepo.resolve(id);
    return true;
  });
  ipc.handle('childConsequences:getActiveForChild', (_e, childId: number) =>
    childConsequencesRepo.getActiveForChild(childId)
  );
  ipc.handle('childConsequences:getAllActive', () =>
    childConsequencesRepo.getAllActive()
  );

  // ── Pending behaviour approvals ──────────────────────────────────────────
  ipc.handle('pending:list', () => pendingRepo.list());
  ipc.handle('pending:count', () => pendingRepo.count());
  ipc.handle('pending:add', (_e, { childId, behaviourId }) => {
    const result = pendingRepo.add(childId, behaviourId);
    // Fire a system notification so parents know there's something to review
    if (Notification.isSupported()) {
      new Notification({
        title: 'DutyDojo — Approval needed',
        body: `${result.child_name} submitted "${result.behaviour_name}" for review.`,
        silent: false,
      }).show();
    }
    return result;
  });
  ipc.handle('pending:approve', (_e, id: number) => pendingRepo.approve(id));
  ipc.handle('pending:reject', (_e, id: number) => {
    pendingRepo.reject(id);
    return true;
  });
  ipc.handle('pending:rejectAll', () => {
    pendingRepo.rejectAll();
    return true;
  });
  ipc.handle('pending:approveAll', () => pendingRepo.approveAll());

  // ── Points / history / reports ────────────────────────────────────────────
  ipc.handle('points:applyBehaviour', (_e, { childId, behaviourId }) =>
    pointsRepo.applyBehaviour(childId, behaviourId)
  );
  ipc.handle('points:manualAdjust', (_e, { childId, delta, reason }) =>
    pointsRepo.manualAdjust(childId, delta, reason)
  );
  ipc.handle('points:getForChild', (_e, childId: number) => pointsRepo.balance(childId));
  ipc.handle('history:getStreak', (_e, childId: number) =>
    historyRepo.getStreak(childId)
  );
  ipc.handle('history:list', (_e, { childId, fromIso, toIso }) =>
    historyRepo.list({ childId, fromIso, toIso })
  );
  ipc.handle('history:getClaimedRewards', (_e, childId: number) =>
    historyRepo.getClaimedRewards(childId)
  );
  ipc.handle('history:markFulfilled', (_e, historyId: number) => {
    historyRepo.markFulfilled(historyId);
    return true;
  });
  ipc.handle('history:exportForChild', (_e, childId: number) =>
    historyRepo.exportForChild(childId)
  );
  ipc.handle('history:exportAll', () => historyRepo.exportAll());
  ipc.handle('reports:summary', (_e, { childId, days }) =>
    reportsRepo.summary(childId, days)
  );
  ipc.handle('reports:behaviourTrend', (_e, { childId, reason, days }) =>
    reportsRepo.getBehaviourTrend(childId, reason, days)
  );
  ipc.handle('reports:siblingComparison', () => reportsRepo.getSiblingComparison());
  ipc.handle('history:balanceOverTime', (_e, { childId, days }) =>
    historyRepo.getBalanceOverTime(childId, days)
  );

  // ── Consequences: update library item ────────────────────────────────────
  ipc.handle('consequences:update', (_e, { id, ...patch }) =>
    consequencesRepo.update(id, patch)
  );

  // ── History: undo + notes ────────────────────────────────────────────────
  ipc.handle('history:undo', (_e, historyId: number) =>
    historyRepo.undoEntry(historyId)
  );
  ipc.handle('history:updateNote', (_e, { historyId, note }: { historyId: number; note: string }) => {
    historyRepo.updateNote(historyId, note);
    return true;
  });

  // ── Per-child behaviour excludes ─────────────────────────────────────────
  ipc.handle('childBehaviourExcludes:list', (_e, childId: number) =>
    childBehaviourExcludesRepo.getForChild(childId)
  );
  ipc.handle('childBehaviourExcludes:toggle', (_e, { childId, behaviourId }) =>
    childBehaviourExcludesRepo.toggle(childId, behaviourId)
  );

  // ── Backup / restore ─────────────────────────────────────────────────────
  ipc.handle('backup:export', async () => {
    const dbPath = getDbFilePath();
    if (!dbPath) return { ok: false, message: 'Database not initialised' };
    saveDbNow();
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save DutyDojo Backup',
      defaultPath: path.join(
        app.getPath('documents'),
        `DutyDojo_backup_${new Date().toISOString().slice(0, 10)}.sqlite`
      ),
      filters: [{ name: 'DutyDojo Backup', extensions: ['sqlite'] }],
    });
    if (canceled || !filePath) return { ok: false, message: 'Cancelled' };
    fs.copyFileSync(dbPath, filePath);
    return { ok: true, path: filePath };
  });

  ipc.handle('backup:restore', async (e) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Restore DutyDojo Backup',
      filters: [{ name: 'DutyDojo Backup', extensions: ['sqlite'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return { ok: false, message: 'Cancelled' };
    const srcPath = filePaths[0];
    // Validate: SQLite files start with 'SQLite format 3'
    const magic = Buffer.alloc(15);
    const fd = fs.openSync(srcPath, 'r');
    fs.readSync(fd, magic, 0, 15, 0);
    fs.closeSync(fd);
    if (magic.toString('utf8') !== 'SQLite format 3') {
      return { ok: false, message: 'Not a valid SQLite backup file' };
    }
    const dbPath = getDbFilePath();
    fs.copyFileSync(srcPath, dbPath);
    // Restart the app to reload the restored database
    app.relaunch();
    app.exit(0);
    return { ok: true };
  });

  // ── Cloud sync ────────────────────────────────────────────────────────────

  /** Helpers to read/write cloud_config in SQLite */
  function getCloudConfig() {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM cloud_config LIMIT 1');
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows[0] ?? null;
  }

  function saveCloudConfig(patch: Record<string, unknown>) {
    const db = getDb();
    const existing = getCloudConfig();
    if (!existing) {
      db.run(`INSERT OR REPLACE INTO cloud_config
        (id, access_token, refresh_token, user_id, user_email, last_pull_at,
         resend_api_key, notification_email, weekly_digest, approval_alerts)
        VALUES (1, ?, ?, ?, ?, '', '', '', 0, 0)`, [
        patch.access_token ?? '', patch.refresh_token ?? '',
        patch.user_id ?? '', patch.user_email ?? '',
      ]);
    } else {
      const pairs = Object.keys(patch).map(k => `${k} = ?`).join(', ');
      const vals  = Object.values(patch).map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
      db.run(`UPDATE cloud_config SET ${pairs} WHERE id = 1`, vals as (string | number)[]);
    }
    saveDbNow();
  }

  ipc.handle('cloud:status', () => {
    const cfg = getCloudConfig();
    return {
      configured: isConfigured(),
      connected:  Boolean(cfg?.user_id),
      email:      (cfg?.user_email as string) ?? '',
      lastSync:   (cfg?.last_pull_at as string) ?? '',
      resendKey:  Boolean(cfg?.resend_api_key),
      notifEmail: (cfg?.notification_email as string) ?? '',
      weeklyDigest:  Boolean(cfg?.weekly_digest),
      approvalAlerts: Boolean(cfg?.approval_alerts),
    };
  });

  ipc.handle('cloud:signUp', async (_e, { email, password }: { email: string; password: string }) => {
    const sb = supabase();
    if (!sb) return { ok: false, error: 'Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env' };
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    if (!data.session) return { ok: true, needsConfirmation: true };
    const { access_token, refresh_token } = data.session;
    const userId = data.user!.id;
    saveCloudConfig({ access_token, refresh_token, user_id: userId, user_email: email });
    setUserId(userId);
    // Push all local data to the new account
    pushAll().catch(console.error);
    return { ok: true, needsConfirmation: false };
  });

  ipc.handle('cloud:signIn', async (_e, { email, password }: { email: string; password: string }) => {
    const sb = supabase();
    if (!sb) return { ok: false, error: 'Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env' };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    const { access_token, refresh_token } = data.session;
    const userId = data.user.id;
    saveCloudConfig({ access_token, refresh_token, user_id: userId, user_email: email });
    setUserId(userId);
    // Pull remote data first, then push any local-only records
    const pullResult = await pullAll();
    pushAll().catch(console.error);
    return { ok: true, pulled: pullResult.pulled };
  });

  ipc.handle('cloud:signOut', () => {
    saveCloudConfig({ access_token: '', refresh_token: '', user_id: '', user_email: '' });
    setUserId('');
    supabase()?.auth.signOut().catch(console.error);
    return true;
  });

  ipc.handle('cloud:syncNow', async () => {
    if (!getUserId()) return { ok: false, error: 'Not signed in' };
    await pushAll();
    const result = await pullAll();
    return { ok: true, pulled: result.pulled, error: result.error };
  });

  ipc.handle('cloud:saveEmailConfig', (_e, cfg: {
    resendKey: string;
    notifEmail: string;
    weeklyDigest: boolean;
    approvalAlerts: boolean;
  }) => {
    saveCloudConfig({
      resend_api_key:     cfg.resendKey,
      notification_email: cfg.notifEmail,
      weekly_digest:      cfg.weeklyDigest ? 1 : 0,
      approval_alerts:    cfg.approvalAlerts ? 1 : 0,
    });
    return true;
  });

  ipc.handle('cloud:sendTestEmail', async (_e, { apiKey, to }: { apiKey: string; to: string }) => {
    const ok = await sendTestEmail(apiKey, to);
    return { ok };
  });

  ipc.handle('cloud:sendWeeklyDigest', async () => {
    const ok = await sendWeeklyDigest();
    return { ok };
  });

  // Wire approval alert into pending:add — remove original handler then re-register with email alert
  ipc.removeHandler('pending:add');
  ipc.handle('pending:add', (_e, { childId, behaviourId }) => {
    const result = pendingRepo.add(childId, behaviourId);
    if (Notification.isSupported()) {
      new Notification({
        title: 'DutyDojo — Approval needed',
        body: `${result.child_name} submitted "${result.behaviour_name}" for review.`,
        silent: false,
      }).show();
    }
    // Email alert (fire & forget)
    sendApprovalAlert(result.child_name, result.behaviour_name).catch(console.error);
    return result;
  });
}
