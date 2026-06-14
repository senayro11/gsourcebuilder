// ============================================================
//  HR-CONFIG.JS — I-edit ang owner at repo
// ============================================================
const GITHUB_CONFIG = {
  owner:  'senayro11',
  repo:   'gsourcebuilder',
  branch: 'main',
  token:  '',
  dbPath: 'hr/db'
};

const HR_LEAVE_TYPES = ['Annual Leave','Sick Leave','Medical Leave','Casual Leave','Emergency Leave','Maternity Leave','Paternity Leave'];
const HR_LEAVE_ALLOCATIONS = { 'Annual Leave':12, 'Sick Leave':5, 'Medical Leave':4, 'Casual Leave':8, 'Emergency Leave':3, 'Maternity Leave':60, 'Paternity Leave':7 };
const HR_DEPARTMENTS = ['Sales','Inventory','Operations','Finance','Logistics','HR','IT','Management'];
const REGULAR_HOURS = 8;
const OT_MULTIPLIER = 1.25;
