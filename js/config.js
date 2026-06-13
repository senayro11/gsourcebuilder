// ============================================================
//  ENTERPRISE SYSTEM - GITHUB CONFIGURATION
// ============================================================

const GITHUB_CONFIG = {
  owner: 'senayro11',
  repo:  'gsourcebuilder',
  branch: 'main',
  token: '',
  dbPath: 'db'
};

// System definitions
const SYSTEMS = {
  pos:        { name: 'Point of Sale',        icon: '馃洅', file: 'pos.html',        color: '#6366f1' },
  inventory:  { name: 'Inventory',            icon: '馃摝', file: 'inventory.html',  color: '#0ea5e9' },
  attendance: { name: 'Attendance & Payroll', icon: '馃晲', file: 'attendance.html', color: '#10b981' },
  budget:     { name: 'Budget & Finance',     icon: '馃挵', file: 'budget.html',     color: '#f59e0b' }
};

// Superadmin-only system (not in SYSTEMS to hide from normal users)
const SUPERADMIN_SYSTEM = { name: 'SuperAdmin Panel', icon: '鈿欙笍', file: 'superadmin.html', color: '#8b5cf6' };

// Role hierarchy
const ROLE_LEVELS = { guest: 1, ojt: 2, staff: 3, admin: 4, superadmin: 5 };

// Permissions per role per system
// 'manage_users' = can add/edit/delete users WITHIN their own system only
const PERMISSIONS = {
  pos: {
    admin:  ['view','create','edit','delete','reports','settings','adjust','manage_users','timein'],
    staff:  ['view','create','timein'],
    ojt:    ['view','timein'],
    guest:  ['view']
  },
  inventory: {
    admin:  ['view','create','edit','delete','reports','settings','adjust','manage_users'],
    staff:  ['view','create','adjust'],
    ojt:    ['view'],
    guest:  ['view']
  },
  attendance: {
    admin:  ['view','create','edit','delete','reports','settings','payroll','manage_users','timein'],
    staff:  ['view','timein','own_records'],
    ojt:    ['view','timein','own_records'],
    guest:  []
  },
  budget: {
    admin:  ['view','create','edit','delete','reports','settings','approve','manage_users'],
    staff:  ['view','create'],
    ojt:    ['view'],
    guest:  []
  }
};

