# 🏢 Enterprise System

An integrated business management system deployed on GitHub Pages. Uses plain TXT files as the database, accessed and updated via the GitHub API (AJAX).

## 📁 File Structure

Each business system (POS, Inventory, Budget, HR) lives in its own folder
with its own `db/` subfolder for the tables it exclusively owns. Tables used
by more than one system (accounts, products) stay in the shared root `db/`
instead of being duplicated — `js/db.js`'s `DB.withPath(path, fn)` lets a
page temporarily read/write a different folder's table without changing its
own default (e.g. `pos/pos.html` reading `productsDB` from the root `db/`
while its own transactions stay in `pos/db/`).

```
enterprise-system/
├── index.html          ← Login page
├── dashboard.html      ← Main hub
├── attendance.html     ← Legacy standalone Attendance + Payroll (superseded by hr/)
├── users.html          ← User Management (SuperAdmin only)
├── superadmin.html     ← SuperAdmin panel
├── edit-profile.html   ← Self-service profile edit
├── change-password.html ← Self-service password change
├── css/
│   └── style.css       ← Global styles (shared by every system, incl. light/dark theme vars)
├── js/
│   ├── config.js       ← ⚙️ Edit this! GitHub settings + permissions + per-system file paths
│   ├── auth.js         ← Authentication engine
│   ├── db.js           ← GitHub API database engine (DB.withPath for cross-folder access)
│   ├── ui.js            ← Shared UI utilities (navbar, sidebar, profile dropdown)
│   ├── sync.js          ← Offline-first queue/cache, shared by root + hr/
│   └── usermgmt.js      ← Per-system "Add/Edit User" modal
├── db/                  ← Shared tables (used by more than one system)
│   ├── accountsDB.txt   ← User accounts (global — every system)
│   ├── productsDB.txt   ← Products (shared: POS + Inventory)
│   ├── employeesDB.txt  ← Employees (legacy attendance.html only)
│   ├── attendanceDB.txt ← Attendance records (legacy attendance.html only)
│   └── payrollDB.txt    ← Payroll records (legacy attendance.html only)
├── pos/
│   ├── pos.html         ← Point of Sale
│   └── db/transactionsDB.txt
├── inventory/
│   ├── inventory.html   ← Inventory Management
│   └── db/inventoryDB.txt
├── budget/
│   ├── budget.html      ← Budget & Finance
│   └── db/budgetDB.txt
└── hr/                  ← Full HR/Attendance/Payroll system (own js/css/db, see below)
    ├── attendance.html
    ├── timein.html       ← Kiosk time in/out
    ├── js/, css/, db/
```

## 🚀 Setup Instructions

### 1. Fork/upload to GitHub
- Create a new GitHub repository
- Upload all files (including the `db/` folder)
- Enable GitHub Pages: Settings → Pages → Source: `main` branch

### 2. Edit `js/config.js`
```javascript
const GITHUB_CONFIG = {
  owner: 'YOUR_GITHUB_USERNAME',  // ← change this
  repo:  'YOUR_REPO_NAME',        // ← change this
  branch: 'main',
  token: '',   // can be set here too, but it's safer to set it via the UI
  dbPath: 'db'
};
```

### 3. Create a GitHub Personal Access Token (PAT)
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Check the `repo` scope (full access)
4. Copy the token

### 4. Set the token on the login page
- Click "GitHub Token Settings" below the login form
- Paste your PAT token
- Click "Save Token"
- It's stored in localStorage (not in GitHub)

### 5. Log in!
Default accounts (password: `admin123`):

| Username    | Role       | System              |
|-------------|------------|---------------------|
| superadmin  | SuperAdmin | All Systems         |
| admin_pos   | Admin      | POS System          |
| admin_inv   | Admin      | Inventory           |
| admin_att   | Admin      | Attendance/Payroll  |
| admin_bud   | Admin      | Budget & Finance    |
| staff01     | Staff      | POS System          |
| ojt01       | OJT        | Inventory           |
| guest01     | Guest      | POS System          |

**CHANGE THE DEFAULT PASSWORDS RIGHT AWAY in User Management!**

## 🔐 Access Control

| Feature              | Guest | OJT | Staff | Admin | SuperAdmin |
|----------------------|-------|-----|-------|-------|------------|
| View data            | ✅    | ✅  | ✅    | ✅    | ✅         |
| Create/add records   | ❌    | ❌  | ✅    | ✅    | ✅         |
| Edit records         | ❌    | ❌  | ❌    | ✅    | ✅         |
| Delete records       | ❌    | ❌  | ❌    | ✅    | ✅         |
| Generate reports     | ❌    | ❌  | ❌    | ✅    | ✅         |
| Manage users         | ❌    | ❌  | ❌    | ❌    | ✅         |
| Access all systems   | ❌    | ❌  | ❌    | ❌    | ✅         |

### Important: Admin per System
- `admin_pos` → POS System only
- `admin_inv` → Inventory only
- `admin_att` → Attendance/Payroll only
- `admin_bud` → Budget only
- `superadmin` → All systems

## 💾 Database Format (TXT)

The format is pipe-delimited (`|`). The first line is the headers.

```
id|name|category|price|stock
P001|White Rice (1kg)|Groceries|55.00|500
P002|Cooking Oil (1L)|Groceries|89.00|200
```

You can edit the TXT files manually on GitHub directly if needed.

## 🔧 Customization

### Adding a new system
1. Create a new `.html` file (copy from an existing one)
2. Add it to the `SYSTEMS` object in `config.js`
3. Add the permissions to the `PERMISSIONS` object
4. The sidebar and dashboard will link to it automatically

### Changing roles/permissions
Edit the `PERMISSIONS` object in `config.js`.

### Adding fields to the database
1. Add the field to the TXT file's header
2. Update the relevant HTML/JS that accesses that field

## 🔌 Offline Mode & Auto-Sync

The system is **offline-first**: you can still open and use the app even without internet
(e.g. the page was already saved on the computer/browser), as long as you've opened it online
at least once before (so there's already cached data).

How it works:

1. **Every successful `DB.read()`** is automatically saved to the browser's `localStorage`
   (`ent_cache_<dbName>`) as the last-known snapshot.
2. **When there's no internet** (or the GitHub API can't be reached):
   - *Reads* fall back to the cached snapshot instead of erroring out.
   - *Writes* (add/edit/delete) are saved locally first and placed into an
     **offline sync queue** (`ent_sync_queue` in localStorage) — nothing is lost.
3. **When internet comes back** (`online` event, or an automatic check every ~25 seconds),
   `js/sync.js` syncs all queued changes back to GitHub, one at a time,
   using the latest file `sha` to avoid stale-write errors.
4. **Connection status and pending change count** are shown in a pill on the navbar
   (🟢 Online / 🟡 Pending changes / 🔴 Offline) on every page — click it to force a sync immediately.
5. The **SuperAdmin Panel → 🔄 Sync Center** is the full control room: it shows which
   databases have pending changes, how many, when the last sync happened, and has buttons
   to force a sync or clear the queue.

### ⚠️ Important notes about offline sync
- This is **last-write-wins**: if two devices make offline changes to the **same
  database file** before syncing, whichever syncs last wins — the other change can be overwritten.
  Avoid simultaneous offline editing on the same system where possible.
- The device still needs to log in/access the system online at least once before offline
  mode works properly (so the local cache has data in it).

## ⚠️ Limitations

- **Rate limits**: The GitHub API has a 5,000 requests/hour limit per token.
- **Token security**: The PAT token is stored in the browser's localStorage. Not ideal for high-security applications.
- **No real-time sync**: Syncing across other tabs isn't automatic. Refresh the page to see the latest data.

For larger-scale operations, consider migrating to a proper backend (Supabase, Firebase, etc.)

## 📞 Support

To add a new system or feature, send the request along with the requirement details.
