// ============================================================
//  HR-CONFIG.JS — Edit the owner and repo
// ============================================================
const GITHUB_CONFIG = {
  owner:  'senayro11',
  repo:   'gsourcebuilder',
  branch: 'main',
  token:  '',
  dbPath: 'hr/db'
};

const HR_LEAVE_TYPES = ['Vacation Leave','Sick Leave','Medical Leave','Casual Leave','Emergency Leave','Maternity Leave','Paternity Leave'];
// Fallback defaults -- the editable, persisted copy lives in hrconfigDB under
// key "leave_policy" (see loadLeavePolicy() in attendance.html) so HR can
// change allocations / convertible-to-cash per leave type without a redeploy.
const HR_LEAVE_ALLOCATIONS = { 'Vacation Leave':12, 'Sick Leave':5, 'Medical Leave':4, 'Casual Leave':8, 'Emergency Leave':3, 'Maternity Leave':60, 'Paternity Leave':7 };
const HR_LEAVE_CONVERTIBLE = { 'Vacation Leave':true, 'Sick Leave':false, 'Medical Leave':false, 'Casual Leave':false, 'Emergency Leave':false, 'Maternity Leave':false, 'Paternity Leave':false };
const HR_DEPARTMENTS = ['Sales','Inventory','Operations','Finance','Logistics','HR','IT','Management'];
const REGULAR_HOURS = 8;
const OT_MULTIPLIER = 1.25;
