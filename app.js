'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────
// Event: { id, name, desc, createdAt, members: string[], transactions: Tx[], settled: string[] }
// Tx:    { id, payer, amount, desc, date }
let state = { events: [] };
let currentEventId = null;

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem('dividapp_state');
    if (raw) state = JSON.parse(raw);
  } catch (e) { console.warn('Error cargando estado:', e); }
}

function saveState() {
  try {
    localStorage.setItem('dividapp_state', JSON.stringify(state));
  } catch (e) { console.warn('Error guardando estado:', e); }
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

function money(n) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function avClass(i) { return 'av' + (i % 6); }

function getEvent(id) { return state.events.find(e => e.id === id); }

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ─── VIEWS ───────────────────────────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ─── MODALS ──────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

document.querySelectorAll('[data-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});

// ─── HOME ─────────────────────────────────────────────────────────────────────
function renderHome() {
  const list  = document.getElementById('events-list');
  const empty = document.getElementById('events-empty');

  if (state.events.length === 0) {
    empty.style.display = 'block';
    list.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = state.events.map(ev => {
    const total = ev.transactions.reduce((s, t) => s + Number(t.amount), 0);
    const mc = ev.members.length;
    const tc = ev.transactions.length;
    return `
      <div class="event-card" role="button" tabindex="0" data-id="${ev.id}">
        <div class="event-card-info">
          <p class="event-card-name">${esc(ev.name)}</p>
          <p class="event-card-meta">${mc} participante${mc !== 1 ? 's' : ''} · ${tc} gasto${tc !== 1 ? 's' : ''}</p>
        </div>
        <span class="event-card-total">${money(total)}</span>
        <span class="event-card-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      </div>`;
  }).join('');

  list.querySelectorAll('.event-card').forEach(card => {
    const open = () => openEvent(card.dataset.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
  });
}

// ─── CREATE EVENT ─────────────────────────────────────────────────────────────
let newParticipants = [];

document.getElementById('btn-new-event').addEventListener('click', () => {
  newParticipants = [];
  document.getElementById('input-event-name').value = '';
  document.getElementById('input-event-desc').value = '';
  document.getElementById('input-participant').value = '';
  renderChips();
  openModal('modal-event');
  setTimeout(() => document.getElementById('input-event-name').focus(), 60);
});

document.getElementById('btn-add-participant').addEventListener('click', addChip);
document.getElementById('input-participant').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addChip(); }
});

function addChip() {
  const input = document.getElementById('input-participant');
  const name = input.value.trim();
  if (!name) return;
  if (newParticipants.map(n => n.toLowerCase()).includes(name.toLowerCase())) {
    toast('Ese participante ya está en la lista'); return;
  }
  newParticipants.push(name);
  input.value = '';
  renderChips();
  input.focus();
}

function renderChips() {
  const c = document.getElementById('participants-chips');
  c.innerHTML = newParticipants.map((name, i) => `
    <div class="chip">
      ${esc(name)}
      <button class="chip-remove" data-i="${i}" aria-label="Quitar ${esc(name)}">×</button>
    </div>`).join('');
  c.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      newParticipants.splice(Number(btn.dataset.i), 1);
      renderChips();
    });
  });
}

document.getElementById('btn-save-event').addEventListener('click', () => {
  const name = document.getElementById('input-event-name').value.trim();
  const desc = document.getElementById('input-event-desc').value.trim();
  if (!name) { toast('Ingresa un nombre para el evento'); return; }
  if (newParticipants.length < 2) { toast('Agrega al menos 2 participantes'); return; }

  state.events.unshift({
    id: uid(), name, desc,
    createdAt: new Date().toISOString(),
    members: [...newParticipants],
    transactions: [],
    settled: []
  });
  saveState();
  closeModal('modal-event');
  renderHome();
  toast('¡Evento creado!');
});

// ─── EVENT VIEW ───────────────────────────────────────────────────────────────
function openEvent(id) {
  currentEventId = id;
  const ev = getEvent(id);
  if (!ev) return;
  document.getElementById('event-header-title').textContent = ev.name;
  renderEvent();
  showView('view-event');
}

document.getElementById('btn-back').addEventListener('click', () => {
  currentEventId = null;
  renderHome();
  showView('view-home');
});

function renderEvent() {
  const ev = getEvent(currentEventId);
  if (!ev) return;
  const total = ev.transactions.reduce((s, t) => s + Number(t.amount), 0);
  document.getElementById('summary-total').textContent   = money(total);
  document.getElementById('summary-members').textContent = ev.members.length;
  renderMembers(ev);
  renderTxList(ev);
  renderBalances(ev);
}

// ── Members ──
function renderMembers(ev) {
  document.getElementById('members-list').innerHTML =
    ev.members.map((name, i) => `
      <div class="member-chip">
        <div class="member-avatar ${avClass(i)}">${initials(name)}</div>
        ${esc(name)}
      </div>`).join('');
}

document.getElementById('btn-add-member').addEventListener('click', () => {
  document.getElementById('input-member-name').value = '';
  openModal('modal-member');
  setTimeout(() => document.getElementById('input-member-name').focus(), 60);
});

document.getElementById('btn-save-member').addEventListener('click', () => {
  const ev = getEvent(currentEventId);
  if (!ev) return;
  const name = document.getElementById('input-member-name').value.trim();
  if (!name) { toast('Ingresa un nombre'); return; }
  if (ev.members.map(n => n.toLowerCase()).includes(name.toLowerCase())) {
    toast('Ese participante ya existe'); return;
  }
  ev.members.push(name);
  saveState();
  closeModal('modal-member');
  renderEvent();
  toast(`${name} agregado`);
});

// ── Transactions ──
function renderTxList(ev) {
  const list  = document.getElementById('tx-list');
  const empty = document.getElementById('tx-empty');
  if (ev.transactions.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const sorted = [...ev.transactions].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = sorted.map(tx => {
    const idx = ev.members.findIndex(m => m === tx.payer);
    const av = avClass(idx >= 0 ? idx : 0);
    return `
      <div class="tx-item">
        <div class="tx-avatar ${av}">${initials(tx.payer)}</div>
        <div class="tx-info">
          <p class="tx-name">${esc(tx.payer)}</p>
          <p class="tx-desc">${esc(tx.desc)}</p>
          <p class="tx-date">${fmtDate(tx.date)}</p>
        </div>
        <span class="tx-amount">${money(tx.amount)}</span>
      </div>`;
  }).join('');
}

document.getElementById('btn-add-tx').addEventListener('click', () => {
  const ev = getEvent(currentEventId);
  if (!ev || ev.members.length === 0) { toast('Primero agrega participantes'); return; }
  const sel = document.getElementById('tx-payer');
  sel.innerHTML = ev.members.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-desc').value   = '';
  document.getElementById('tx-date').value   = new Date().toISOString().split('T')[0];
  openModal('modal-tx');
  setTimeout(() => document.getElementById('tx-amount').focus(), 60);
});

document.getElementById('btn-save-tx').addEventListener('click', () => {
  const ev = getEvent(currentEventId);
  if (!ev) return;
  const payer  = document.getElementById('tx-payer').value;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const desc   = document.getElementById('tx-desc').value.trim();
  const date   = document.getElementById('tx-date').value;

  if (!payer)              { toast('Selecciona quién pagó'); return; }
  if (!amount || amount <= 0) { toast('Ingresa un monto válido'); return; }
  if (!desc)               { toast('Ingresa una descripción'); return; }
  if (!date)               { toast('Selecciona una fecha'); return; }

  ev.transactions.push({ id: uid(), payer, amount, desc, date });
  ev.settled = [];   // reset al agregar nuevo gasto
  saveState();
  closeModal('modal-tx');
  renderEvent();
  toast('Gasto registrado');
});

// ─── BALANCE ALGORITHM ────────────────────────────────────────────────────────
// Greedy matching: empareja acreedores con deudores minimizando transacciones
function computeBalances(ev) {
  const n = ev.members.length;
  if (n < 2) return [];
  const total = ev.transactions.reduce((s, t) => s + Number(t.amount), 0);
  if (total === 0) return [];

  const share = total / n;
  const paid  = {};
  ev.members.forEach(m => { paid[m] = 0; });
  ev.transactions.forEach(tx => { paid[tx.payer] = (paid[tx.payer] || 0) + Number(tx.amount); });

  const net = ev.members.map(m => ({ name: m, bal: Math.round((paid[m] - share) * 100) / 100 }));
  const cred = net.filter(p => p.bal >  0.01).sort((a, b) => b.bal - a.bal).map(p => ({...p}));
  const debt = net.filter(p => p.bal < -0.01).sort((a, b) => a.bal - b.bal).map(p => ({...p}));

  const result = [];
  let ci = 0, di = 0;
  while (ci < cred.length && di < debt.length) {
    const amt = Math.min(cred[ci].bal, -debt[di].bal);
    result.push({ from: debt[di].name, to: cred[ci].name, amount: Math.round(amt) });
    cred[ci].bal -= amt;
    debt[di].bal += amt;
    if (Math.abs(cred[ci].bal) < 0.01) ci++;
    if (Math.abs(debt[di].bal) < 0.01) di++;
  }
  return result;
}

function renderBalances(ev) {
  const list  = document.getElementById('balances-list');
  const empty = document.getElementById('balances-empty');
  const balances = computeBalances(ev);

  if (balances.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = balances.map(b => {
    const key      = `${b.from}→${b.to}`;
    const settled  = ev.settled.includes(key);
    return `
      <div class="balance-item${settled ? ' settled' : ''}">
        <div class="balance-text">
          <strong>${esc(b.from)}</strong> le debe a <strong>${esc(b.to)}</strong>
        </div>
        <span class="balance-amount">${money(b.amount)}</span>
        ${settled
          ? `<span class="settled-badge">acordado ✓</span>`
          : `<button class="btn-settle" data-key="${esc(key)}">Acordado</button>`
        }
      </div>`;
  }).join('');

  list.querySelectorAll('.btn-settle').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = getEvent(currentEventId);
      if (!ev) return;
      const key = btn.dataset.key;
      if (!ev.settled.includes(key)) {
        ev.settled.push(key);
        saveState();
        renderBalances(ev);
        toast('Deuda marcada como acordada ✓');
      }
    });
  });
}

// ─── OFFLINE ─────────────────────────────────────────────────────────────────
function updateOnline() {
  document.getElementById('offline-banner').hidden = navigator.onLine;
}
window.addEventListener('online',  updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

// ─── SERVICE WORKER ──────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(r => console.log('SW registrado:', r.scope))
      .catch(e => console.warn('SW error:', e));
  });
}

// ─── SHORTCUT: ?action=new ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (new URLSearchParams(window.location.search).get('action') === 'new') {
    document.getElementById('btn-new-event').click();
    window.history.replaceState({}, '', '/');
  }
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadState();
renderHome();