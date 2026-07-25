// ============================================================
//  USERMGMT.JS — Per-System User Management
//  Include on every system page. Uses a shared modal.
// ============================================================

const UserMgmt = (() => {
  let currentUser = null;
  let currentSystem = null;
  let allUsers = [];
  let editUsername = null;

  function init(user, system) {
    currentUser  = user;
    currentSystem = system;
    injectModal();
  }

  function injectModal() {
    if (document.getElementById('um-backdrop')) return;
    document.body.insertAdjacentHTML('beforeend', `
<!-- User Management Modal -->
<div class="modal-backdrop" id="um-backdrop">
  <div class="modal modal-lg" style="max-width:860px">
    <div class="modal-header">
      <span class="modal-title">👥 User Management — <span id="um-system-label"></span></span>
      <button class="modal-close" onclick="UI.closeModal('um-backdrop')">✕</button>
    </div>
    <!-- Stats row -->
    <div id="um-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px"></div>
    <!-- Toolbar -->
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <div class="search-bar" style="flex:1;min-width:200px">
        <span>🔍</span>
        <input type="text" id="um-search" placeholder="Search user..." oninput="UserMgmt.filter()">
      </div>
      <select id="um-role-filter" style="padding:8px 12px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);color:var(--text)" onchange="UserMgmt.filter()">
        <option value="">All Roles</option>
        <option value="admin">Admin</option>
        <option value="staff">Staff</option>
        <option value="ojt">OJT</option>
        <option value="guest">Guest</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick="UserMgmt.openAdd()">+ New User</button>
    </div>
    <!-- Table -->
    <div class="table-wrap">
      <table>
        <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="um-tbody"></tbody>
      </table>
    </div>
    <div id="um-pagination"></div>
  </div>
</div>

<!-- Add/Edit User Form Modal -->
<div class="modal-backdrop" id="um-form-backdrop">
  <div class="modal" style="max-width:480px">
    <div class="modal-header">
      <span class="modal-title" id="um-form-title">+ New User</span>
      <button class="modal-close" onclick="UI.closeModal('um-form-backdrop')">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Username *</label><input type="text" id="umf-username" placeholder="lowercase, no spaces"></div>
      <div class="form-group"><label>Full Name *</label><input type="text" id="umf-fullname"></div>
    </div>
    <div class="form-group"><label>Email</label><input type="email" id="umf-email"></div>
    <div class="form-group">
      <label>Role *</label>
      <select id="umf-role">
        <option value="admin">Admin</option>
        <option value="staff">Staff</option>
        <option value="ojt">OJT</option>
        <option value="guest">Guest</option>
      </select>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">ℹ️ This user will only be able to access the <strong id="umf-system-name"></strong> system.</div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label id="umf-pw-label">Password *</label>
        <input type="password" id="umf-password" placeholder="Min 6 characters">
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input type="password" id="umf-password2">
      </div>
    </div>
    <div id="umf-pw-note" style="display:none;font-size:11px;color:var(--text3);margin:-8px 0 12px">ℹ️ Leave the password blank if you don't want to change it.</div>
    <div class="form-group">
      <label>Status</label>
      <select id="umf-status"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="UI.closeModal('um-form-backdrop')">Cancel</button>
      <button class="btn btn-primary" onclick="UserMgmt.save()">Save</button>
    </div>
  </div>
</div>`);
  }

  async function open() {
    if (!currentUser || !currentSystem) return;
    document.getElementById('um-system-label').textContent = SYSTEMS[currentSystem]?.name || currentSystem;
    document.getElementById('umf-system-name').textContent = SYSTEMS[currentSystem]?.name || currentSystem;
    UI.loading(true, 'Loading users...');
    try {
      allUsers = (await DB.read('accountsDB', true))
        .filter(u => u.assigned_system === currentSystem);
      renderStats();
      filter();
      UI.openModal('um-backdrop');
    } catch(e) { UI.toast('Error: '+e.message, 'error'); }
    UI.loading(false);
  }

  function renderStats() {
    const roles = ['admin','staff','ojt','guest'];
    const colors = ['badge-info','badge-success','badge-warning','badge-gray'];
    document.getElementById('um-stats').innerHTML = roles.map((r,i) => {
      const c = allUsers.filter(u=>u.role===r&&u.status==='active').length;
      return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">${r}</div><div style="font-size:22px;font-weight:700;color:var(--white)">${c}</div></div>`;
    }).join('');
  }

  function filter() {
    const q    = (document.getElementById('um-search')?.value||'').toLowerCase();
    const role = document.getElementById('um-role-filter')?.value||'';
    let rows = allUsers;
    if (q)    rows = rows.filter(u => u.username.toLowerCase().includes(q)||u.full_name.toLowerCase().includes(q));
    if (role) rows = rows.filter(u => u.role === role);
    renderTable(rows, 1);
  }

  function renderTable(rows, page) {
    const paged = UI.paginate(rows, page, 8);
    document.getElementById('um-tbody').innerHTML = paged.rows.map(u => `<tr>
      <td><strong class="mono">${u.username}</strong></td>
      <td>${u.full_name}</td>
      <td>${UI.roleBadge(u.role)}</td>
      <td>${UI.statusBadge(u.status)}</td>
      <td style="display:flex;gap:4px">
        <button class="btn btn-ghost btn-sm" onclick="UserMgmt.openEdit('${u.username}')">✏️</button>
        <button class="btn btn-${u.status==='active'?'warning':'success'} btn-sm" onclick="UserMgmt.toggleStatus('${u.username}')">${u.status==='active'?'🔒':'🔓'}</button>
        <button class="btn btn-danger btn-sm" onclick="UserMgmt.deleteUser('${u.username}')">🗑</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3)">No users</td></tr>';
    UI.renderPagination('um-pagination', paged, p => renderTable(rows, p));
  }

  function openAdd() {
    editUsername = null;
    ['umf-username','umf-fullname','umf-email','umf-password','umf-password2'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    document.getElementById('umf-role').value='staff';
    document.getElementById('umf-status').value='active';
    document.getElementById('um-form-title').textContent='+ New User';
    document.getElementById('umf-pw-label').textContent='Password *';
    document.getElementById('umf-pw-note').style.display='none';
    const uEl=document.getElementById('umf-username');if(uEl)uEl.disabled=false;
    UI.openModal('um-form-backdrop');
  }

  function openEdit(username) {
    const u = allUsers.find(x=>x.username===username); if(!u) return;
    editUsername = username;
    document.getElementById('umf-username').value=u.username;
    document.getElementById('umf-username').disabled=true;
    document.getElementById('umf-fullname').value=u.full_name;
    document.getElementById('umf-email').value=u.email||'';
    document.getElementById('umf-role').value=u.role;
    document.getElementById('umf-status').value=u.status;
    document.getElementById('umf-password').value='';
    document.getElementById('umf-password2').value='';
    document.getElementById('um-form-title').textContent='✏️ Edit User';
    document.getElementById('umf-pw-label').textContent='Password (optional)';
    document.getElementById('umf-pw-note').style.display='';
    UI.openModal('um-form-backdrop');
  }

  async function save() {
    const username  = document.getElementById('umf-username').value.trim().toLowerCase();
    const fullName  = document.getElementById('umf-fullname').value.trim();
    const email     = document.getElementById('umf-email').value.trim();
    const role      = document.getElementById('umf-role').value;
    const pw        = document.getElementById('umf-password').value;
    const pw2       = document.getElementById('umf-password2').value;
    const status    = document.getElementById('umf-status').value;

    if (!username||!fullName) { UI.toast('Fill in the required fields','warning'); return; }
    if (!editUsername && !pw) { UI.toast('A password is required for a new user','warning'); return; }
    if (pw && pw !== pw2)  { UI.toast('Passwords do not match!','error'); return; }
    if (pw && pw.length<6) { UI.toast('Password must be at least 6 characters','warning'); return; }

    UI.loading(true,'Saving...');
    try {
      let hashed = '';
      if (pw) hashed = await Auth.hashPassword(pw);
      const allAcc = await DB.read('accountsDB', true);

      if (editUsername) {
        const updates = { full_name:fullName, email, role, status };
        if (hashed) updates.password_hash = hashed;
        await DB.update('accountsDB', r=>r.username===editUsername, updates);
        UI.toast('User updated ✅','success');
      } else {
        if (allAcc.find(u=>u.username===username)) {
          UI.toast('A user with this username already exists!','error');
          UI.loading(false); return;
        }
        await DB.insert('accountsDB', {
          username, password_hash:hashed, role,
          assigned_system: currentSystem,
          full_name:fullName, email, status,
          created_at: new Date().toISOString().split('T')[0]
        });
        UI.toast('User added ✅','success');
      }
      UI.closeModal('um-form-backdrop');
      allUsers = (await DB.read('accountsDB',true)).filter(u=>u.assigned_system===currentSystem);
      renderStats(); filter();
    } catch(e) { UI.toast('Error: '+e.message,'error'); }
    UI.loading(false);
  }

  async function toggleStatus(username) {
    const u = allUsers.find(x=>x.username===username); if(!u) return;
    const newStatus = u.status==='active'?'suspended':'active';
    UI.confirm(`${newStatus==='suspended'?'Suspend':'Activate'} the account of ${u.full_name}?`, async()=>{
      UI.loading(true);
      try {
        await DB.update('accountsDB',r=>r.username===username,{status:newStatus});
        UI.toast(`Account ${newStatus} ✅`,'success');
        allUsers=(await DB.read('accountsDB',true)).filter(u=>u.assigned_system===currentSystem);
        renderStats(); filter();
      } catch(e){UI.toast('Error: '+e.message,'error');}
      UI.loading(false);
    });
  }

  async function deleteUser(username) {
    UI.confirm(`DELETE the account of ${username}? This cannot be undone.`, async()=>{
      UI.loading(true);
      try {
        await DB.remove('accountsDB',r=>r.username===username&&r.assigned_system===currentSystem);
        UI.toast('User deleted','success');
        allUsers=(await DB.read('accountsDB',true)).filter(u=>u.assigned_system===currentSystem);
        renderStats(); filter();
      } catch(e){UI.toast('Error: '+e.message,'error');}
      UI.loading(false);
    });
  }

  return { init, open, filter, openAdd, openEdit, save, toggleStatus, deleteUser };
})();

// Global function for the sidebar link
function openUserMgmt() { UserMgmt.open(); }
