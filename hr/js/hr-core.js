// ============================================================
//  HR-CORE.JS — Shared utilities for all HR pages
// ============================================================

// ---- Toast ----
const Toast = {
  show(msg, type='info', dur=3500) {
    let c = document.getElementById('toast-container');
    if (!c) { c=document.createElement('div'); c.id='toast-container'; document.body.appendChild(c); }
    const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    c.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='all .3s'; setTimeout(()=>el.remove(),300); }, dur);
  }
};

// ---- Loading ----
const Loading = {
  show(msg='Sandali lang...') {
    let o=document.getElementById('global-loading');
    if(!o){ o=document.createElement('div'); o.id='global-loading'; o.className='loading-overlay'; o.innerHTML=`<div class="spinner"></div><div style="color:#94a3b8;font-size:14px">${msg}</div>`; document.body.appendChild(o); }
    o.querySelector('div:last-child').textContent=msg;
    o.classList.add('active');
  },
  hide() { const o=document.getElementById('global-loading'); if(o) o.classList.remove('active'); }
};

// ---- Modal ----
const Modal = {
  open(id)  { const m=document.getElementById(id); if(m) m.classList.add('active'); },
  close(id) { const m=document.getElementById(id); if(m) m.classList.remove('active'); },
  confirm(msg, onYes, onNo) {
    const id='cfm-'+Date.now();
    const d=document.createElement('div');
    d.id=id; d.className='modal-backdrop active';
    d.innerHTML=`<div class="modal" style="max-width:400px"><div class="modal-header"><span class="modal-title">⚠️ Kumpirmasyon</span></div><div class="modal-body"><p style="color:var(--text)">${msg}</p></div><div class="modal-footer"><button class="btn btn-ghost" id="${id}-no">Kanselahin</button><button class="btn btn-danger" id="${id}-yes">Oo, ituloy</button></div></div>`;
    document.body.appendChild(d);
    document.getElementById(`${id}-yes`).onclick=()=>{d.remove();onYes?.();};
    document.getElementById(`${id}-no`).onclick=()=>{d.remove();onNo?.();};
    d.addEventListener('click',e=>{if(e.target===d){d.remove();onNo?.();}});
  }
};

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('active');
});

// ---- Tabs ----
function initTabs(containerSel='.tab-bar') {
  document.querySelectorAll(containerSel).forEach(bar => {
    bar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panelId = btn.dataset.tab;
        bar.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        const wrapper = bar.closest('.tab-wrapper') || document;
        wrapper.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        const panel = wrapper.querySelector(`#${panelId}`);
        if (panel) panel.classList.add('active');
      });
    });
  });
}

// ---- Format helpers ----
const Fmt = {
  peso(v)   { return '₱'+parseFloat(v||0).toLocaleString('en-PH',{minimumFractionDigits:2}); },
  date(s)   { return s ? new Date(s+'T00:00:00').toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—'; },
  time(s)   { return s || '—'; },
  hours(h)  { const n=parseFloat(h||0); return n.toFixed(2)+' hrs'; },
  roleBadge(r) {
    const m={admin:'badge-blue',staff:'badge-success',ojt:'badge-warning',guest:'badge-gray',superadmin:'badge-purple'};
    return `<span class="badge ${m[r]||'badge-gray'}">${(r||'').toUpperCase()}</span>`;
  },
  statusBadge(s) {
    const m={approved:'badge-success',present:'badge-success',active:'badge-success',released:'badge-success',pending:'badge-warning',late:'badge-warning',new:'badge-info',absent:'badge-danger',rejected:'badge-danger',inactive:'badge-gray',suspended:'badge-gray',draft:'badge-gray'};
    const label={approved:'Approved',present:'Present',active:'Active',released:'Released',pending:'Pending',late:'Late',new:'New',absent:'Absent',rejected:'Rejected',inactive:'Inactive',suspended:'Suspended',draft:'Draft'};
    return `<span class="badge ${m[s]||'badge-gray'}">${label[s]||s}</span>`;
  },
  avatarHtml(name, size='32') {
    const initials=(name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    return `<div class="avatar-sm-placeholder" style="width:${size}px;height:${size}px;font-size:${Math.round(size/2.5)}px">${initials}</div>`;
  }
};

// ---- Pagination ----
function paginate(rows, page, perPage=15) {
  const total=rows.length, pages=Math.ceil(total/perPage)||1, start=(page-1)*perPage;
  return { rows:rows.slice(start,start+perPage), total, pages, page, start, showing:`${start+1}–${Math.min(start+perPage,total)} of ${total}` };
}
function renderPager(elId, paged, onPage) {
  const el=document.getElementById(elId); if(!el) return;
  if(paged.pages<=1){el.innerHTML='';return;}
  let h=`<div class="flex-between" style="margin-top:16px;flex-wrap:wrap;gap:8px"><span style="font-size:12px;color:var(--text3)">Showing ${paged.showing}</span><div style="display:flex;gap:4px">`;
  if(paged.page>1)h+=`<button class="btn btn-ghost btn-sm" onclick="(${onPage.toString()})(${paged.page-1})">‹ Prev</button>`;
  for(let i=Math.max(1,paged.page-2);i<=Math.min(paged.pages,paged.page+2);i++){
    h+=`<button class="btn ${i===paged.page?'btn-primary':'btn-ghost'} btn-sm" onclick="(${onPage.toString()})(${i})">${i}</button>`;
  }
  if(paged.page<paged.pages)h+=`<button class="btn btn-ghost btn-sm" onclick="(${onPage.toString()})(${paged.page+1})">Next ›</button>`;
  h+='</div></div>';
  el.innerHTML=h;
}

// ---- Sidebar toggle (responsive) ----
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const topbar   = document.getElementById('topbar');
  const main     = document.getElementById('main-content');
  const overlay  = document.getElementById('sidebar-overlay');
  const toggleBtns = document.querySelectorAll('.sidebar-toggle-btn');
  const isMobile = () => window.innerWidth <= 1024;

  function applyState(open) {
    if (isMobile()) {
      sidebar.classList.toggle('mobile-open', open);
      overlay.classList.toggle('show', open);
      topbar.classList.remove('sidebar-hidden');
      main.classList.remove('sidebar-hidden');
    } else {
      sidebar.classList.toggle('collapsed', !open);
      topbar.classList.toggle('sidebar-hidden', !open);
      main.classList.toggle('sidebar-hidden', !open);
      overlay.classList.remove('show');
    }
  }

  // Default state
  let isOpen = !isMobile();
  applyState(isOpen);

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => { isOpen = !isOpen; applyState(isOpen); });
  });
  overlay?.addEventListener('click', () => { isOpen = false; applyState(false); });

  window.addEventListener('resize', () => {
    isOpen = !isMobile();
    applyState(isOpen);
  });
}

// ---- Nav active state ----
function setActiveNav(pageId) {
  document.querySelectorAll('.nav-sub-item, .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });
  // Open parent if sub is active
  document.querySelectorAll('.nav-parent').forEach(parent => {
    const sub = parent.nextElementSibling;
    if (sub && sub.querySelector('.active')) {
      parent.classList.add('open');
      sub.classList.add('open');
    }
  });
}

// ---- Nav accordion ----
function initNavAccordion() {
  document.querySelectorAll('.nav-parent').forEach(item => {
    item.addEventListener('click', () => {
      const sub = item.nextElementSibling;
      if (!sub || !sub.classList.contains('nav-sub')) return;
      item.classList.toggle('open');
      sub.classList.toggle('open');
    });
  });
}

// ---- Clock ----
function startClock(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) + '  ' + now.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
  }
  tick(); setInterval(tick, 1000);
}

// ---- DB (reuse from enterprise system pattern but for HR) ----
// This assumes GITHUB_CONFIG is set in config.js
const HRDB = (() => {
  const cache={}, shas={};
  function apiUrl(name) {
    const{owner,repo,branch,dbPath}=GITHUB_CONFIG;
    return `https://api.github.com/repos/${owner}/${repo}/contents/${dbPath}/${name}.txt`;
  }
  function hdrs() {
    return {'Authorization':`token ${GITHUB_CONFIG.token}`,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
  }
  function parse(raw) {
    const lines=raw.trim().split('\n').filter(l=>l.trim()&&!l.startsWith('#'));
    if(!lines.length) return [];
    const heads=lines[0].split('|').map(h=>h.trim());
    return lines.slice(1).map(line=>{
      const vals=line.split('|'); const obj={};
      heads.forEach((h,i)=>{obj[h]=(vals[i]||'').trim();}); return obj;
    });
  }
  function serialize(rows,header) {
    if(!rows||!rows.length) return header+'\n';
    const keys=header.split('|');
    return [header,...rows.map(r=>keys.map(k=>r[k]??'').join('|'))].join('\n')+'\n';
  }
  async function read(name, force=false) {
    if(cache[name]&&!force) return cache[name];
    const res=await fetch(apiUrl(name),{headers:hdrs()});
    if(!res.ok){if(res.status===404){cache[name]=[];return[];}throw new Error(`DB read error ${res.status}: ${name}`);}
    const json=await res.json();
    shas[name]=json.sha;
    const content=atob(json.content.replace(/\n/g,''));
    cache[name]=parse(content);
    cache[`${name}_header`]=content.split('\n')[0];
    return cache[name];
  }
  async function write(name, rows) {
    const header=cache[`${name}_header`]||Object.keys(rows[0]).join('|');
    const content=serialize(rows,header);
    const encoded=btoa(unescape(encodeURIComponent(content)));
    const body={message:`Update ${name} - ${new Date().toISOString()}`,content:encoded,sha:shas[name],branch:GITHUB_CONFIG.branch};
    const res=await fetch(apiUrl(name),{method:'PUT',headers:hdrs(),body:JSON.stringify(body)});
    if(!res.ok){const e=await res.json();throw new Error(`DB write: ${e.message}`);}
    const json=await res.json();
    shas[name]=json.content.sha;
    cache[name]=rows;
    return true;
  }
  async function insert(name,row){const rows=await read(name,true);rows.push(row);return write(name,rows);}
  async function update(name,cond,updates){const rows=await read(name,true);let n=0;const newRows=rows.map(r=>{if(cond(r)){n++;return{...r,...updates};}return r;});if(!n)return 0;await write(name,newRows);return n;}
  async function remove(name,cond){const rows=await read(name,true);const newRows=rows.filter(r=>!cond(r));if(newRows.length===rows.length)return 0;await write(name,newRows);return rows.length-newRows.length;}
  function nextId(rows,field,prefix){if(!rows.length)return`${prefix}001`;const nums=rows.map(r=>parseInt((r[field]||'').replace(prefix,''))||0);return`${prefix}${String(Math.max(...nums)+1).padStart(3,'0')}`;}
  function clearCache(name){if(name){delete cache[name];delete shas[name];}else{Object.keys(cache).forEach(k=>delete cache[k]);}}
  return{read,write,insert,update,remove,nextId,clearCache,parse,serialize};
})();

