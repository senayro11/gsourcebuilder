// ============================================================
//  ENTERPRISE SYSTEM - GITHUB CONFIGURATION
//  Palitan ang values na ito ng iyong sariling GitHub details
// ============================================================

const GITHUB_CONFIG = {
  owner: 'YOUR_GITHUB_USERNAME',       // e.g. 'senayro11'
  repo:  'YOUR_REPO_NAME',             // e.g. 'enterprise-system'
  branch: 'main',
  token: '',  // PAT token - i-paste lang dito or use login prompt
  // Base path ng db folder sa iyong repo
  dbPath: 'db'
};

// System definitions — kung anong systems ang available
const SYSTEMS = {
  pos:       { name: 'Point of Sale',         icon: '🛒', file: 'pos.html',       color: '#6366f1' },
  inventory: { name: 'Inventory',             icon: '📦', file: 'inventory.html', color: '#0ea5e9' },
  attendance:{ name: 'Attendance & Payroll',  icon: '🕐', file: 'attendance.html',color: '#10b981' },
  budget:    { name: 'Budget & Finance',      icon: '💰', file: 'budget.html',    color: '#f59e0b' },
  users:     { name: 'User Management',       icon: '👥', file: 'users.html',     color: '#8b5cf6' }
};

// Role hierarchy — mas mataas ang number, mas maraming access
const ROLE_LEVELS = {
  guest:      1,
  ojt:        2,
  staff:      3,
  admin:      4,
  superadmin: 5
};

// Permissions per role per system
// superadmin = automatic lahat
const PERMISSIONS = {
  pos: {
    admin:  ['view','create','edit','delete','reports','settings'],
    staff:  ['view','create'],
    ojt:    ['view'],
    guest:  ['view']
  },
  inventory: {
    admin:  ['view','create','edit','delete','reports','settings','adjust'],
    staff:  ['view','create','adjust'],
    ojt:    ['view'],
    guest:  ['view']
  },
  attendance: {
    admin:  ['view','create','edit','delete','reports','settings','payroll','timein'],
    staff:  ['view','timein','own_records'],
    ojt:    ['view','timein','own_records'],
    guest:  []
  },
  budget: {
    admin:  ['view','create','edit','delete','reports','settings','approve'],
    staff:  ['view','create'],
    ojt:    ['view'],
    guest:  []
  },
  users: {
    admin:  [],  // only superadmin
    staff:  [],
    ojt:    [],
    guest:  []
  }
};
