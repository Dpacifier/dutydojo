# DutyDojo — MVP

Desktop app for families to track children's chores, behaviours, points, rewards and milestones.
Built with Electron + React + TypeScript + SQLite (via sql.js / WebAssembly — no C++ compiler needed). All data is stored locally on the computer where the app runs — nothing leaves your device.

## What's in this MVP

- First-launch onboarding (create parent account + first child)
- Password-protected parent portal
- Kid-facing view — big progress bar, tap-to-log behaviours, confetti + trophy at milestones
- Manage children (avatars, goal points)
- Manage behaviours (positive earners + needs attention items, with custom point values and emoji icons)
- Manage rewards (cost in points, redeem for a child)
- Reports — earned vs deducted bar chart, most frequent behaviours, filterable by 7/14/30/90 days
- History log per child
- Change parent password

---

## Step-by-step: run DutyDojo on your Windows PC

> You will need to do these steps once the first time. After that, `npm run electron:dev` is all you need to start the app again.

### 1. Install Node.js (only once, ever)

1. Go to **https://nodejs.org**
2. Click the **LTS** download (the green button on the left). As of 2026 this is Node 22 or newer — any LTS works.
3. Run the installer. Accept the defaults. You do **not** need "Automatically install the necessary tools" — DutyDojo has no native code to compile.
4. **Verify it worked**: open PowerShell (press `Win`, type `powershell`, Enter) and run:
   ```powershell
   node --version
   npm --version
   ```
   Both should print a version number. If they do, you're good.

### 2. Put the project somewhere OUTSIDE OneDrive

⚠️ **Do not keep this project inside a OneDrive folder.** OneDrive constantly re-scans files and locks them while syncing, which breaks `npm install` and Electron builds. Keep the project on a plain local drive.

**Recommended location: `C:\DutyDojo`**

### 3. Open a PowerShell in the project folder

1. Open File Explorer and navigate to the project folder (e.g. `C:\DutyDojo`).
2. Click the address bar at the top, delete everything, type `powershell` and press Enter.
3. A blue terminal opens, already inside the project folder. This is where every command in the next steps goes.

### 4. Install the app's dependencies (only once)

In that PowerShell window, run:

```powershell
npm install
```

This downloads all the libraries DutyDojo needs into a `node_modules` folder. It takes a couple of minutes the first time. No C++ compiler or Visual Studio is required — the database engine (`sql.js`) is pure WebAssembly.

### 5. Start DutyDojo in development mode

```powershell
npm run electron:dev
```

A DutyDojo window opens with hot-reload — any code change updates the window automatically.

**First time you run it** you'll see the onboarding screen: pick a parent name, set a password, add your first child. Then the kid view opens.

To stop, go back to the PowerShell window and press `Ctrl + C`. Confirm with `Y`.

### 6. (Later) Build a proper Windows installer

When you want a real `.exe` you can share with friends or install on another PC:

```powershell
npm run dist
```

After a few minutes, the installer will be in the `release` folder inside the project.
Double-click it to install DutyDojo like a normal Windows app. The `release` folder is fine to zip up and share.

---

## Where is the data stored?

Local SQLite file in your Windows user data folder:

```
%APPDATA%\DutyDojo\dutydojo.sqlite
```

You can copy that file to back it up. Deleting it resets the app to a fresh onboarding.

---

## Troubleshooting

**`npm install` fails with EPERM, "operation not permitted" or "file is in use"**: the project is inside a OneDrive-synced folder. Move it to `C:\DutyDojo` (or any non-OneDrive path), delete any half-installed `node_modules`, then run `npm install` again.

**"running scripts is disabled on this system"** (blocks `npm`): open PowerShell once and run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, press `Y` to confirm, then retry.

**Blank window when running `npm run electron:dev`**: wait 10 seconds on the first run — Vite has to compile the first time. If still blank, press `Ctrl + Shift + I` inside the window to open DevTools and check the Console tab for errors.

**"Port 5173 is already in use"**: another Vite project is running. Close it or change the port in `vite.config.ts`.

**Forgot parent password**: delete `%APPDATA%\DutyDojo\dutydojo.sqlite` and relaunch — you'll go through onboarding again. This wipes all points/history. (A secure reset flow is on the roadmap.)

---

## Roadmap (next phases)

1. **Cloud sync + multi-device** — Supabase Postgres + Row-Level Security, same React UI.
2. **Web app** — move the current React UI behind a browser wrapper (same codebase).
3. **Mobile apps (iOS + Android)** — React Native / Expo, re-using the data model and component logic.
4. **AI layer** — behavioural trend detection, personalised reward suggestions, parent coaching tips (OpenAI/Anthropic API).
5. **Account system** — email-based login so families can recover passwords and share between parents.

---

## Project structure

```
Dutydojo App/
├── electron/
│   ├── main.ts             # Electron entry point (creates the window)
│   ├── preload.ts          # Safe bridge between UI and database
│   ├── ipc.ts              # Registers all IPC handlers
│   └── db/
│       ├── database.ts     # sql.js (WebAssembly SQLite) init + save-to-disk
│       ├── schema.ts       # Table definitions + default seed data
│       └── repositories.ts # CRUD functions for each table
├── src/
│   ├── main.tsx            # React entry
│   ├── App.tsx             # Top-level router (view state)
│   ├── store.ts            # Zustand store
│   ├── types.ts            # Shared TypeScript types
│   ├── index.css           # Tailwind + custom classes
│   └── components/
│       ├── Onboarding.tsx
│       ├── KidView.tsx
│       ├── ParentLogin.tsx
│       ├── ParentPortal.tsx
│       ├── ManageChildren.tsx
│       ├── ManageBehaviours.tsx
│       ├── ManageRewards.tsx
│       ├── Reports.tsx
│       ├── History.tsx
│       └── Settings.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── package.json
```
