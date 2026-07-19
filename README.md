# 🏢 Enterprise System

Isang integrated business management system na naka-deploy sa GitHub Pages. Gumagamit ng plain TXT files bilang database, na ina-access at ina-update via GitHub API (AJAX).

## 📁 File Structure

```
enterprise-system/
├── index.html          ← Login page
├── dashboard.html      ← Main hub
├── pos.html            ← Point of Sale
├── inventory.html      ← Inventory Management
├── attendance.html     ← Attendance + Payroll
├── budget.html         ← Budget & Finance
├── users.html          ← User Management (SuperAdmin only)
├── css/
│   └── style.css       ← Global styles
├── js/
│   ├── config.js       ← ⚙️ I-edit ito! GitHub settings + permissions
│   ├── auth.js         ← Authentication engine
│   ├── db.js           ← GitHub API database engine
│   └── ui.js           ← Shared UI utilities
└── db/
    ├── accountsDB.txt  ← User accounts
    ├── productsDB.txt  ← Products
    ├── transactionsDB.txt ← POS transactions
    ├── employeesDB.txt ← Employees
    ├── attendanceDB.txt ← Attendance records
    ├── payrollDB.txt   ← Payroll records
    ├── budgetDB.txt    ← Budget entries
    └── inventoryDB.txt ← Stock movements
```

## 🚀 Setup Instructions

### 1. I-fork/upload sa GitHub
- Gumawa ng bagong GitHub repository
- I-upload ang lahat ng files (kasama ang `db/` folder)
- I-enable ang GitHub Pages: Settings → Pages → Source: `main` branch

### 2. I-edit ang `js/config.js`
```javascript
const GITHUB_CONFIG = {
  owner: 'YOUR_GITHUB_USERNAME',  // ← palitan ito
  repo:  'YOUR_REPO_NAME',        // ← palitan ito
  branch: 'main',
  token: '',   // pwede ring ilagay dito, pero mas safe kung sa UI ilagay
  dbPath: 'db'
};
```

### 3. Gumawa ng GitHub Personal Access Token (PAT)
1. Pumunta sa https://github.com/settings/tokens
2. Generate new token (classic)
3. I-check ang `repo` scope (full access)
4. I-copy ang token

### 4. I-set ang token sa login page
- I-click ang "GitHub Token Settings" sa ibaba ng login form
- I-paste ang iyong PAT token
- I-click "I-save ang Token"
- Mino-store ito sa localStorage (hindi nasa GitHub)

### 5. Mag-login!
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

**PALITAN AGAD ANG DEFAULT PASSWORDS sa User Management!**

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
- `admin_pos` → POS System lang
- `admin_inv` → Inventory lang
- `admin_att` → Attendance/Payroll lang
- `admin_bud` → Budget lang
- `superadmin` → Lahat ng systems

## 💾 Database Format (TXT)

Pipe-delimited (`|`) ang format. Ang unang linya ay ang headers.

```
id|name|category|price|stock
P001|White Rice (1kg)|Groceries|55.00|500
P002|Cooking Oil (1L)|Groceries|89.00|200
```

Pwede mong i-edit manually ang TXT files sa GitHub directly kung kailangan.

## 🔧 Customization

### Magdagdag ng bagong system
1. Gumawa ng bagong `.html` file (kopya mula sa isa sa existing)
2. Idagdag sa `SYSTEMS` object sa `config.js`
3. Idagdag ang permissions sa `PERMISSIONS` object
4. Gagawa ang sidebar at dashboard ng link automatically

### Magbago ng roles/permissions
I-edit ang `PERMISSIONS` object sa `config.js`.

### Magdagdag ng fields sa database
1. Idagdag ang field sa header ng TXT file
2. I-update ang relevant HTML/JS na nag-a-access ng field na iyon

## 🔌 Offline Mode & Auto-Sync

Ang system ay **offline-first**: pwede mo pa ring buksan at gamitin ang app kahit walang internet
(hal. naka-save ang page sa computer/browser), basta't nabuksan mo na ito nang online kahit isang beses
(para may naka-cache na data).

Paano gumagana:

1. **Bawat successful na `DB.read()`** ay awtomatikong sinasave sa `localStorage` ng browser
   (`ent_cache_<dbName>`) bilang huling-kilalang snapshot.
2. **Kapag walang internet** (o hindi ma-reach ang GitHub API):
   - Ang mga *read* ay babalik sa naka-cache na snapshot sa halip na mag-error.
   - Ang mga *write* (add/edit/delete) ay ise-save muna nang lokal at ilalagay sa isang
     **offline sync queue** (`ent_sync_queue` sa localStorage) — hindi ito basta mawawala.
3. **Kapag bumalik ang internet** (`online` event, o awtomatikong pag-check bawat ~25 segundo),
   ise-sync ni `js/sync.js` ang lahat ng naka-queue na pagbabago pabalik sa GitHub,
   isa-isa, gamit ang pinakabagong file `sha` para maiwasan ang stale-write errors.
4. Makikita ang **status ng koneksyon at bilang ng pending na pagbabago** sa isang pill sa navbar
   (🟢 Online / 🟡 May pending / 🔴 Offline) sa bawat page — i-click ito para mag-force-sync agad.
5. Ang **SuperAdmin Panel → 🔄 Sync Center** ang buong control room: makikita dito kung anong mga
   database ang may pending na pagbabago, ilan, kailan huling nag-sync, at may buttons para
   mag-force sync o mag-clear ng queue.

### ⚠️ Mahalagang paalala tungkol sa offline sync
- Ito ay **last-write-wins**: kung dalawang device ang gumawa ng offline na pagbabago sa **parehong
  database file** bago mag-sync, ang huling na-sync ang mananatili — puwedeng ma-overwrite ang isa.
  Iwasan ang sabay-sabay na offline editing sa parehong system kung maiiwasan.
- Kailangan pa ring naka-login/naka-access ang device online kahit minsan bago gumana nang maayos
  ang offline mode (para may laman ang local cache).

## ⚠️ Mga Limitasyon

- **Rate limits**: GitHub API ay may 5,000 requests/hour limit per token.
- **Token security**: Ang PAT token ay naka-store sa localStorage ng browser. Hindi ideal para sa high-security applications.
- **No real-time sync**: Hindi automatic ang sync ng ibang tabs. I-refresh ang page para makita ang pinakabagong data.

Para sa mas malaking operasyon, i-consider ang migration sa proper backend (Supabase, Firebase, etc.)

## 📞 Support

Para magdagdag ng bagong system o feature, ipadala ang request kasama ang detalye ng requirements.
