import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase, getDb, saveDbNow } from './db/database';
import { registerIpcHandlers } from './ipc';
import { restoreSession } from './supabaseClient';
import { setUserId, pullAll } from './syncService';
import { sendWeeklyDigest } from './emailService';

// __dirname is available because vite-plugin-electron compiles main to CommonJS.
process.env.APP_ROOT = path.join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

function resolvePreload(): string {
  // vite-plugin-electron may output preload as either preload.mjs or preload.js
  // depending on sandbox / format settings. Pick whichever exists.
  const mjs = path.join(__dirname, 'preload.mjs');
  const js = path.join(__dirname, 'preload.js');
  if (fs.existsSync(mjs)) return mjs;
  return js;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'DutyDojo',
    backgroundColor: '#F8FAFC',
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

/** Restore cloud session and kick off a background pull if credentials exist. */
async function initCloudSync() {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM cloud_config LIMIT 1');
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    const cfg = rows[0];
    if (!cfg?.user_id) return;

    const restored = await restoreSession(cfg.access_token as string, cfg.refresh_token as string);
    if (!restored) return;

    setUserId(cfg.user_id as string);
    console.log('[cloud] Session restored for', cfg.user_email);

    // Pull changes from cloud in the background
    pullAll().catch(console.error);
  } catch (e) {
    console.error('[cloud] initCloudSync error:', e);
  }
}

/** Schedule the weekly digest. Fires every Monday at 08:00 local time. */
function scheduleWeeklyDigest() {
  function msUntilNextMonday8am(): number {
    const now = new Date();
    const day = now.getDay(); // 0=Sun … 6=Sat
    const daysUntilMon = day === 1 ? 7 : (8 - day) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMon);
    next.setHours(8, 0, 0, 0);
    return Math.max(0, next.getTime() - now.getTime());
  }
  function schedule() {
    const delay = msUntilNextMonday8am();
    console.log(`[digest] Next weekly digest in ${Math.round(delay / 3_600_000)}h`);
    setTimeout(async () => {
      await sendWeeklyDigest().catch(console.error);
      schedule(); // re-schedule for the following Monday
    }, delay);
  }
  schedule();
}

app.whenReady().then(async () => {
  try {
    const userDataPath = app.getPath('userData');
    await initDatabase(path.join(userDataPath, 'dutydojo.sqlite'));
    registerIpcHandlers(ipcMain);
    await initCloudSync();
    scheduleWeeklyDigest();
    createWindow();
  } catch (err) {
    dialog.showErrorBox('DutyDojo startup error', String((err as Error)?.stack ?? err));
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Make sure any pending writes are flushed to disk before the app exits.
app.on('before-quit', () => {
  try {
    saveDbNow();
  } catch (err) {
    console.error('Failed to flush DutyDojo database on quit:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
