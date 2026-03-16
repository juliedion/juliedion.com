/* ============================================================
   Schalmont PTO — Main Application JavaScript
   ============================================================ */

/* === Utility Functions === */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
}

function getMonthName(m) {
  return ['January','February','March','April','May','June','July',
          'August','September','October','November','December'][m];
}

function pad(n) { return String(n).padStart(2, '0'); }

function showAlert(container, msg, type = 'success', duration = 4000) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  container.insertAdjacentElement('afterbegin', el);
  if (duration) setTimeout(() => el.remove(), duration);
  return el;
}

function initNavToggle() {
  const toggle = $('#nav-toggle');
  const links  = $('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', links.classList.contains('open'));
  });
  // Close on link click
  $$('.nav-links a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
const Store = {
  get: (key, def = []) => {
    try { return JSON.parse(localStorage.getItem('pto_' + key)) ?? def; } catch { return def; }
  },
  set: (key, val) => localStorage.setItem('pto_' + key, JSON.stringify(val)),
  push: (key, item, def = []) => {
    const arr = Store.get(key, def);
    arr.push(item);
    Store.set(key, arr);
    return arr;
  }
};

/* ============================================================
   SAMPLE DATA (pre-populated on first load)
   ============================================================ */
function seedData() {

  // Directory — starts empty; families add themselves
  if (!Store.get('dir_seeded_v3', false)) {
    Store.set('directory', []);
    Store.set('dir_seeded_v3', true);
  }

  // Volunteer events
  if (!Store.get('vol_seeded', false)) {
    const volEvents = [
      {
        id: 'v1',
        title: 'Spring Book Fair',
        date: '2026-03-16',
        roles: [
          { id: 'r1', name: 'Setup Crew', description: 'Help set up tables and displays (7:00–8:30 AM)', slots: 6, signups: [] },
          { id: 'r2', name: 'Cashier / Sales', description: 'Help students purchase books (8:30 AM–12:00 PM)', slots: 4, signups: [] },
          { id: 'r3', name: 'Cashier / Sales', description: 'Help students purchase books (12:00–3:30 PM)', slots: 4, signups: [] },
          { id: 'r4', name: 'Teardown Crew', description: 'Help pack up at end of day (3:00–4:30 PM)', slots: 4, signups: [] }
        ]
      },
      {
        id: 'v2',
        title: 'Spring Carnival',
        date: '2026-04-25',
        roles: [
          { id: 'r5', name: 'Game Booth Host', description: 'Run a carnival game booth (11 AM–1 PM)', slots: 8, signups: [] },
          { id: 'r6', name: 'Game Booth Host', description: 'Run a carnival game booth (1–4 PM)', slots: 8, signups: [] },
          { id: 'r7', name: 'Food Service', description: 'Help serve food and drinks all day', slots: 6, signups: [] },
          { id: 'r8', name: 'Raffle Table', description: 'Sell raffle tickets and manage prizes', slots: 3, signups: [] },
          { id: 'r9', name: 'Setup / Breakdown', description: 'Setup 8–11 AM or Breakdown 4–6 PM', slots: 10, signups: [] }
        ]
      },
      {
        id: 'v3',
        title: 'Teacher Appreciation Luncheon',
        date: '2026-05-06',
        roles: [
          { id: 'r10', name: 'Food Donation', description: 'Bring a dish to share (drop off by 11 AM)', slots: 12, signups: [] },
          { id: 'r11', name: 'Setup & Serving', description: 'Help set up and serve the luncheon', slots: 5, signups: [] },
          { id: 'r12', name: 'Cleanup', description: 'Help clean up after the event (1–2 PM)', slots: 4, signups: [] }
        ]
      }
    ];
    Store.set('vol_events', volEvents);
    Store.set('vol_seeded', true);
  }
}

/* ============================================================
   EVENTS CALENDAR PAGE
   ============================================================ */
function initEventsPage() {
  if (!$('#calendar-grid')) return;

  const db          = firebase.firestore();
  let cachedEvents  = [];
  let currentDate   = new Date();
  currentDate.setDate(1);

  // ── admin helpers ─────────────────────────────────────────
  function isAdmin() {
    const user = firebase.auth().currentUser;
    return user && Array.isArray(adminEmails) && adminEmails.includes(user.email);
  }

  function updateAdminUI() {
    const btn = $('#admin-toggle');
    if (btn) btn.style.display = isAdmin() ? '' : 'none';
  }

  // ── real-time Firestore listener ──────────────────────────
  db.collection('events').onSnapshot(snapshot => {
    cachedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCalendar();
  }, err => {
    console.error('Firestore error:', err);
  });

  firebase.auth().onAuthStateChanged(() => {
    updateAdminUI();
    renderCalendar();
  });

  // ── render calendar grid ──────────────────────────────────
  function renderCalendar() {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();

    $('#cal-month-label').textContent = `${getMonthName(month)} ${year}`;

    const eventsByDate = {};
    cachedEvents.forEach(ev => {
      if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
      eventsByDate[ev.date].push(ev);
    });

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    let html = '';
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month"><span class="day-num">${daysInPrev - i}</span></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr   = `${year}-${pad(month+1)}-${pad(d)}`;
      const isToday   = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const dayEvents = eventsByDate[dateStr] || [];
      const cls = 'cal-day' + (isToday ? ' today' : '') + (dayEvents.length ? ' has-event' : '');
      const numEl = isToday ? `<span class="day-num flex-center">${d}</span>` : `<span class="day-num">${d}</span>`;
      const dots  = dayEvents.slice(0, 2).map(ev =>
        `<span class="cal-event-dot type-${ev.type}" title="${esc(ev.title)}">${esc(ev.title)}</span>`
      ).join('');
      const more  = dayEvents.length > 2 ? `<span class="cal-event-dot" style="background:#9ca3af">+${dayEvents.length - 2} more</span>` : '';
      html += `<div class="${cls}" data-date="${dateStr}">${numEl}${dots}${more}</div>`;
    }
    const remaining = 42 - (firstDay + daysInMonth);
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="cal-day other-month"><span class="day-num">${d}</span></div>`;
    }

    $('#calendar-grid').innerHTML = html;
    $$('.cal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => showDayEvents(el.dataset.date));
    });

    renderEventList();
    updateAdminUI();
  }

  // ── render event list sidebar ─────────────────────────────
  function renderEventList() {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthEvents = cachedEvents
      .filter(ev => {
        const d = new Date(ev.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const list = $('#event-list');
    if (!list) return;
    if (monthEvents.length === 0) {
      list.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:24px">No events this month.</p>';
      return;
    }
    list.innerHTML = monthEvents.map(ev => {
      const d         = new Date(ev.date + 'T00:00:00');
      const deleteBtn = isAdmin()
        ? `<button class="btn btn-sm btn-danger" onclick="deleteEvent('${ev.id}')">✕</button>`
        : '';
      return `<div class="event-list-item">
        <div class="event-date-badge">
          <span class="eday">${d.getDate()}</span>
          <span class="emonth">${getMonthName(d.getMonth()).slice(0,3)}</span>
        </div>
        <div class="event-info">
          <h4>${esc(ev.title)}</h4>
          <p>${esc(ev.description || '')}</p>
          <div class="event-meta">
            ${ev.time ? `<span>🕐 ${esc(ev.time)}</span>` : ''}
            ${ev.location ? `<span>📍 ${esc(ev.location)}</span>` : ''}
            <span><span class="badge badge-blue">${esc(ev.type)}</span></span>
          </div>
        </div>
        ${deleteBtn}
      </div>`;
    }).join('');
  }

  // ── day-click modal ───────────────────────────────────────
  function showDayEvents(dateStr) {
    const events = cachedEvents.filter(ev => ev.date === dateStr);
    const modal  = $('#day-modal');
    const body   = $('#day-modal-body');
    const d      = new Date(dateStr + 'T00:00:00');
    $('#day-modal-date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    body.innerHTML = events.length === 0
      ? '<p style="color:var(--text-light)">No events on this day.</p>'
      : events.map(ev => `
        <div style="margin-bottom:16px;padding:14px;background:var(--light-bg);border-radius:var(--radius)">
          <h4 style="margin-bottom:6px">${esc(ev.title)}</h4>
          ${ev.time     ? `<p style="font-size:13px;color:var(--text-light)">🕐 ${esc(ev.time)}</p>`        : ''}
          ${ev.location ? `<p style="font-size:13px;color:var(--text-light)">📍 ${esc(ev.location)}</p>`   : ''}
          ${ev.description ? `<p style="font-size:13px;margin-top:8px">${esc(ev.description)}</p>`         : ''}
        </div>`).join('');
    modal.classList.remove('hidden');
  }

  // ── delete event (admin only) ─────────────────────────────
  window.deleteEvent = async function(id) {
    if (!isAdmin()) return;
    if (!confirm('Delete this event?')) return;
    try {
      await db.collection('events').doc(id).delete();
    } catch (err) {
      alert('Could not delete event: ' + err.message);
    }
  };

  // ── month nav ─────────────────────────────────────────────
  $('#cal-prev').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  $('#cal-next').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  // ── day modal close ───────────────────────────────────────
  $('#day-modal-close')?.addEventListener('click', () => $('#day-modal').classList.add('hidden'));
  $('#day-modal')?.addEventListener('click', e => { if (e.target === $('#day-modal')) $('#day-modal').classList.add('hidden'); });

  // ── admin panel toggle ────────────────────────────────────
  $('#admin-toggle')?.addEventListener('click', () => {
    $('#admin-form-wrap').classList.toggle('hidden');
  });

  // ── add event form (admin only) ───────────────────────────
  $('#add-event-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!isAdmin()) return;
    const fd  = new FormData(e.target);
    const ev  = {
      title:       fd.get('title').trim(),
      date:        fd.get('date'),
      time:        fd.get('time'),
      location:    fd.get('location').trim(),
      type:        fd.get('type'),
      description: fd.get('description').trim()
    };
    if (!ev.title || !ev.date) {
      showAlert($('#add-event-alert'), 'Please fill in title and date.', 'error');
      return;
    }
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled    = true;
    btn.textContent = 'Saving…';
    try {
      await db.collection('events').add(ev);
      e.target.reset();
      showAlert($('#add-event-alert'), `"${ev.title}" has been added to the calendar!`, 'success');
      $('#admin-form-wrap').classList.add('hidden');
    } catch (err) {
      showAlert($('#add-event-alert'), 'Error saving event: ' + err.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Add to Calendar';
    }
  });

  updateAdminUI();
}

/* ============================================================
   DIRECTORY PAGE
   ============================================================ */
function initDirectoryPage() {
  if (!$('#directory-list')) return;

  const GRADES = ['Pre-K','Kindergarten','1st Grade','2nd Grade','3rd Grade','4th Grade',
                  '5th Grade','6th Grade','7th Grade','8th Grade','9th Grade','10th Grade',
                  '11th Grade','12th Grade'];

  // ── student row helpers ───────────────────────────────────
  window.addStudentRow = function(name = '', grade = '') {
    const rows = $('#student-rows');
    if (!rows) return;
    const div = document.createElement('div');
    div.className = 'student-input-row';
    div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
    div.innerHTML = `
      <input type="text" name="studentName" placeholder="Student name" value="${esc(name)}" style="flex:1;min-width:0">
      <select name="studentGrade" style="flex:1;min-width:0">
        <option value="">Grade…</option>
        ${GRADES.map(g => `<option value="${g}"${g === grade ? ' selected' : ''}>${g}</option>`).join('')}
      </select>
      <button type="button" onclick="removeStudentRow(this)" style="flex-shrink:0;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:none;cursor:pointer;color:var(--text-light);font-size:14px;line-height:1" aria-label="Remove">✕</button>
    `;
    rows.appendChild(div);
  };

  window.removeStudentRow = function(btn) {
    const rows = $('#student-rows');
    if (rows && rows.children.length > 1) btn.closest('.student-input-row').remove();
  };

  if ($('#student-rows')) {
    window.addStudentRow();
    $('#add-student-btn')?.addEventListener('click', () => window.addStudentRow());
  }

  // ── phone auto-format ─────────────────────────────────────
  $('#dir-phone')?.addEventListener('input', e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) { e.target.value = ''; return; }
    if (digits.length <= 3) {
      e.target.value = `(${digits}`;
    } else if (digits.length <= 6) {
      e.target.value = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    } else {
      e.target.value = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
  });

  // ── photo upload + preview ────────────────────────────────
  $('#dir-photo')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const preview  = $('#dir-photo-preview');
        const initials = $('#dir-photo-initials');
        preview.src = dataUrl;
        preview.style.display = 'block';
        initials.style.display = 'none';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // ── sort + render ─────────────────────────────────────────
  let sortMode = 'parent';

  function currentUserEmail() {
    try { return firebase.auth().currentUser?.email || ''; } catch { return ''; }
  }

  function renderDirectory(filter = '') {
    const members = Store.get('directory');
    const list = $('#directory-list');
    const lower = filter.toLowerCase();
    const myEmail = currentUserEmail();

    let filtered = members.filter(m => {
      const students = m.students || [];
      return `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
        students.some(s => s.name.toLowerCase().includes(lower) || s.grade.toLowerCase().includes(lower));
    });

    if (sortMode === 'student') {
      filtered.sort((a, b) => {
        const aName = (a.students && a.students[0]) ? a.students[0].name.toLowerCase() : '';
        const bName = (b.students && b.students[0]) ? b.students[0].name.toLowerCase() : '';
        return aName.localeCompare(bName);
      });
    } else {
      filtered.sort((a, b) =>
        `${a.lastName} ${a.firstName}`.toLowerCase().localeCompare(`${b.lastName} ${b.firstName}`.toLowerCase())
      );
    }

    if (filtered.length === 0) {
      list.innerHTML = '<p style="color:var(--text-light);text-align:center;grid-column:1/-1;padding:32px">No members found.</p>';
      return;
    }

    list.innerHTML = filtered.map(m => {
      const initials = `${m.firstName[0]}${m.lastName[0]}`;
      const students = m.students || [];
      const avatarContent = m.photo
        ? `<img src="${m.photo}" alt="${esc(m.firstName)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : esc(initials);
      const isOwner = myEmail && m.email === myEmail;
      return `<div class="member-card">
        <div class="member-avatar" style="${m.photo ? 'padding:0;overflow:hidden' : ''}">${avatarContent}</div>
        <div class="member-info">
          <h4>${esc(m.firstName)} ${esc(m.lastName)}</h4>
          ${m.showEmail && m.email ? `<p>✉ <a href="mailto:${esc(m.email)}" style="color:var(--primary);text-decoration:none">${esc(m.email)}</a></p>` : ''}
          ${m.showPhone && m.phone ? `<p>📞 ${esc(m.phone)}</p>` : ''}
          ${students.length > 0 ? `
            <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
              <p style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:0.05em;margin-bottom:5px;text-transform:uppercase">Students</p>
              ${students.map(s => `
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="font-size:13px;font-weight:500">${esc(s.name)}</span>
                  ${s.grade ? `<span class="badge badge-blue" style="font-size:11px;padding:2px 7px">${esc(s.grade)}</span>` : ''}
                </div>`).join('')}
            </div>` : ''}
          ${isOwner ? `<button class="btn btn-sm btn-blue" style="margin-top:10px;font-size:12px" onclick="openEditModal('${m.id}')">✏ Edit My Listing</button>` : ''}
        </div>
      </div>`;
    }).join('');

    $('#dir-count').textContent = `${filtered.length} member${filtered.length !== 1 ? 's' : ''}`;
  }

  $('#dir-search')?.addEventListener('input', e => renderDirectory(e.target.value));
  $('#dir-sort')?.addEventListener('change', e => {
    sortMode = e.target.value;
    renderDirectory($('#dir-search')?.value || '');
  });

  // ── edit listing modal ────────────────────────────────────
  function addEditStudentRow(name = '', grade = '') {
    const rows = $('#edit-student-rows');
    if (!rows) return;
    const div = document.createElement('div');
    div.className = 'student-input-row';
    div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
    div.innerHTML = `
      <input type="text" name="editStudentName" placeholder="Student name" value="${esc(name)}" style="flex:1;min-width:0">
      <select name="editStudentGrade" style="flex:1;min-width:0">
        <option value="">Grade…</option>
        ${GRADES.map(g => `<option value="${g}"${g === grade ? ' selected' : ''}>${g}</option>`).join('')}
      </select>
      <button type="button" onclick="this.closest('.student-input-row').previousElementSibling || this.closest('#edit-student-rows').children.length > 1 ? this.closest('.student-input-row').remove() : null" style="flex-shrink:0;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:none;cursor:pointer;color:var(--text-light);font-size:14px;line-height:1" aria-label="Remove" onclick="if($('#edit-student-rows').children.length>1)this.closest('.student-input-row').remove()">✕</button>
    `;
    rows.appendChild(div);
  }

  // Phone format for edit modal
  $('#edit-phone')?.addEventListener('input', e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) { e.target.value = ''; return; }
    if (digits.length <= 3)      e.target.value = `(${digits}`;
    else if (digits.length <= 6) e.target.value = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    else                         e.target.value = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  });

  // Photo upload for edit modal
  $('#edit-photo')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 160;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width-min)/2, (img.height-min)/2, min, min, 0, 0, 160, 160);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        $('#edit-photo-preview').src = dataUrl;
        $('#edit-photo-preview').style.display = 'block';
        $('#edit-photo-initials').style.display = 'none';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  $('#edit-add-student-btn')?.addEventListener('click', () => addEditStudentRow());

  window.openEditModal = function(memberId) {
    const members = Store.get('directory');
    const m = members.find(x => x.id === memberId);
    if (!m) return;

    $('#edit-member-id').value  = m.id;
    $('#edit-fname').value      = m.firstName;
    $('#edit-lname').value      = m.lastName;
    $('#edit-phone').value      = m.phone || '';
    $('#edit-show-email').checked = !!m.showEmail;
    $('#edit-show-phone').checked = !!m.showPhone;

    // Populate students
    $('#edit-student-rows').innerHTML = '';
    const students = m.students || [];
    if (students.length > 0) students.forEach(s => addEditStudentRow(s.name, s.grade));
    else addEditStudentRow();

    // Photo
    const preview  = $('#edit-photo-preview');
    const initials = $('#edit-photo-initials');
    if (m.photo) {
      preview.src = m.photo; preview.style.display = 'block'; initials.style.display = 'none';
    } else {
      preview.src = ''; preview.style.display = 'none'; initials.style.display = '';
    }
    if ($('#edit-photo')) $('#edit-photo').value = '';

    $('#edit-modal').classList.remove('hidden');
  };

  $('#edit-modal-close')?.addEventListener('click', () => $('#edit-modal').classList.add('hidden'));
  $('#edit-cancel-btn')?.addEventListener('click',  () => $('#edit-modal').classList.add('hidden'));
  $('#edit-modal')?.addEventListener('click', e => { if (e.target === $('#edit-modal')) $('#edit-modal').classList.add('hidden'); });

  $('#edit-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = $('#edit-member-id').value;
    const members = Store.get('directory');
    const idx = members.findIndex(m => m.id === id);
    if (idx === -1) return;

    const studentNames  = fd.getAll('editStudentName');
    const studentGrades = fd.getAll('editStudentGrade');
    const students = studentNames
      .map((name, i) => ({ name: name.trim(), grade: studentGrades[i] || '' }))
      .filter(s => s.name);

    const photoEl = $('#edit-photo-preview');
    const photo = (photoEl && photoEl.style.display !== 'none') ? photoEl.src : '';

    members[idx] = {
      ...members[idx],
      firstName: fd.get('firstName').trim(),
      lastName:  fd.get('lastName').trim(),
      phone:     fd.get('phone').trim(),
      students,
      photo,
      showEmail: fd.get('showEmail') === 'on',
      showPhone: fd.get('showPhone') === 'on'
    };
    Store.set('directory', members);
    $('#edit-modal').classList.add('hidden');
    showAlert($('#dir-alert'), 'Your listing has been updated!', 'success');
    renderDirectory($('#dir-search')?.value || '');
  });

  // ── add to directory form ─────────────────────────────────
  $('#dir-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const studentNames  = fd.getAll('studentName');
    const studentGrades = fd.getAll('studentGrade');
    const students = studentNames
      .map((name, i) => ({ name: name.trim(), grade: studentGrades[i] || '' }))
      .filter(s => s.name);
    const photoEl = $('#dir-photo-preview');
    const photo = (photoEl && photoEl.style.display !== 'none') ? photoEl.src : '';
    const member = {
      id: 'd' + Date.now(),
      firstName: fd.get('firstName').trim(),
      lastName:  fd.get('lastName').trim(),
      email:     fd.get('email').trim(),
      phone:     fd.get('phone').trim(),
      students,
      photo,
      showEmail: fd.get('showEmail') === 'on',
      showPhone: fd.get('showPhone') === 'on',
      joined:    new Date().toISOString().split('T')[0]
    };
    if (!member.firstName || !member.lastName || !member.email) {
      showAlert($('#dir-alert'), 'Please fill in first name, last name, and email.', 'error');
      return;
    }
    Store.push('directory', member);
    $('#student-rows').innerHTML = '';
    window.addStudentRow();
    // Reset photo preview
    if (photoEl) { photoEl.src = ''; photoEl.style.display = 'none'; }
    const initialsEl = $('#dir-photo-initials');
    if (initialsEl) initialsEl.style.display = '';
    if ($('#dir-photo')) $('#dir-photo').value = '';
    e.target.reset();
    showAlert($('#dir-alert'), `Welcome, ${member.firstName}! Your information has been added to the directory.`, 'success');
    renderDirectory($('#dir-search')?.value || '');
    $('#directory-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  renderDirectory();
}

/* ============================================================
   SHOP PAGE
   ============================================================ */
function initShopPage() {
  if (!$('#shop-grid')) return;

  const products = [
    { id: 'p1', name: 'Classic T-Shirt', price: 15, icon: '👕', desc: 'Comfortable 100% cotton tee in Schalmont Blue. Proudly sport the Sabres logo on the front.', sizes: ['Youth S','Youth M','Youth L','Adult S','Adult M','Adult L','Adult XL','Adult XXL'], badge: 'Best Seller' },
    { id: 'p2', name: 'Hooded Sweatshirt', price: 38, icon: '🧥', desc: 'Stay warm in this cozy pullover hoodie with the Schalmont Sabres logo and PTO crest.', sizes: ['Youth S','Youth M','Youth L','Adult S','Adult M','Adult L','Adult XL'], badge: 'Popular' },
    { id: 'p3', name: 'Baseball Cap', price: 20, icon: '🧢', desc: 'Adjustable snapback cap in school blue with gold embroidered Sabres logo.', sizes: ['One Size'], badge: null },
    { id: 'p4', name: 'Spirit Water Bottle', price: 14, icon: '🍶', desc: '20oz stainless steel insulated water bottle. Keeps drinks cold 24 hrs, hot 12 hrs.', sizes: ['One Size'], badge: 'New' },
    { id: 'p5', name: 'Tote Bag', price: 18, icon: '👜', desc: 'Reusable canvas tote bag — perfect for books, groceries, and more. Schalmont PTO logo.', sizes: ['One Size'], badge: null },
    { id: 'p6', name: 'Car Magnet', price: 8, icon: '🚗', desc: 'Show your school pride! 4" × 6" full-color Schalmont Sabres magnetic car sign.', sizes: ['One Size'], badge: null },
    { id: 'p7', name: 'Zip-Up Hoodie', price: 42, icon: '🧣', desc: 'Full-zip fleece hoodie with Schalmont emblem on left chest and Sabres on the back.', sizes: ['Youth S','Youth M','Adult S','Adult M','Adult L','Adult XL'], badge: null },
    { id: 'p8', name: 'Youth Jogger Pants', price: 28, icon: '👖', desc: 'Comfortable elastic-waist jogger pants for kids. School blue with gold stripe.', sizes: ['Youth XS','Youth S','Youth M','Youth L','Youth XL'], badge: null }
  ];

  let cart = Store.get('cart', []);

  function updateCartUI() {
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const badge = $('#cart-count');
    const totalEl = $('#cart-total-amount');
    if (badge) badge.textContent = count;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    const items = $('#cart-items');
    if (items) {
      if (cart.length === 0) {
        items.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:32px">Your cart is empty.</p>';
      } else {
        items.innerHTML = cart.map((item, idx) => `
          <div class="cart-item">
            <div style="font-size:28px">${item.icon}</div>
            <div class="cart-item-info">
              <h5>${esc(item.name)}</h5>
              <p>Size: ${esc(item.size)} &middot; Qty:
                <button onclick="changeQty(${idx}, -1)" style="border:none;background:none;cursor:pointer;font-size:16px">−</button>
                ${item.qty}
                <button onclick="changeQty(${idx},  1)" style="border:none;background:none;cursor:pointer;font-size:16px">+</button>
              </p>
            </div>
            <div>
              <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
              <button onclick="removeFromCart(${idx})" style="border:none;background:none;cursor:pointer;color:var(--error);font-size:13px;margin-top:4px">Remove</button>
            </div>
          </div>`).join('');
      }
    }
    Store.set('cart', cart);
  }

  window.changeQty = function(idx, delta) {
    cart[idx].qty = Math.max(1, cart[idx].qty + delta);
    updateCartUI();
  };
  window.removeFromCart = function(idx) {
    cart.splice(idx, 1);
    updateCartUI();
  };

  window.addToCart = function(productId) {
    const product = products.find(p => p.id === productId);
    const sizeEl  = $(`#size-${productId}`);
    const size    = sizeEl ? sizeEl.value : 'One Size';
    const existing = cart.find(i => i.id === productId && i.size === size);
    if (existing) { existing.qty++; }
    else { cart.push({ id: productId, name: product.name, price: product.price, size, qty: 1, icon: product.icon }); }
    updateCartUI();
    openCart();
  };

  function openCart() {
    $('#cart-sidebar').classList.add('open');
    $('#cart-overlay').classList.add('open');
  }
  function closeCart() {
    $('#cart-sidebar').classList.remove('open');
    $('#cart-overlay').classList.remove('open');
  }

  $('#cart-fab')?.addEventListener('click', openCart);
  $('#cart-close')?.addEventListener('click', closeCart);
  $('#cart-overlay')?.addEventListener('click', closeCart);

  $('#checkout-btn')?.addEventListener('click', () => {
    if (cart.length === 0) { showAlert($('#shop-alert'), 'Your cart is empty!', 'error'); return; }
    closeCart();
    const modal = $('#checkout-modal');
    modal.classList.remove('hidden');
  });

  $('#checkout-close')?.addEventListener('click', () => $('#checkout-modal').classList.add('hidden'));
  $('#checkout-modal')?.addEventListener('click', (e) => { if (e.target === $('#checkout-modal')) $('#checkout-modal').classList.add('hidden'); });

  $('#checkout-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd  = new FormData(e.target);
    const orderNum = 'SC' + Date.now().toString().slice(-6);
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    // Save order
    const order = {
      id: orderNum,
      name: fd.get('name'),
      email: fd.get('email'),
      items: [...cart],
      total,
      date: new Date().toISOString(),
      notes: fd.get('notes')
    };
    Store.push('orders', order);
    cart = [];
    Store.set('cart', cart);
    updateCartUI();
    $('#checkout-modal').classList.add('hidden');
    $('#order-success').classList.remove('hidden');
    $('#order-num').textContent = orderNum;
    showAlert($('#shop-alert'), `Order #${orderNum} submitted successfully! You'll receive a confirmation email.`, 'success');
  });

  // Render products
  $('#shop-grid').innerHTML = products.map(p => `
    <div class="shop-product-card">
      <div class="product-img-wrap">
        <span class="product-icon">${p.icon}</span>
        ${p.badge ? `<span class="badge badge-gold product-badge">${p.badge}</span>` : ''}
      </div>
      <div class="product-body">
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.desc)}</p>
        ${p.sizes.length > 1 ? `
          <div class="form-group">
            <label for="size-${p.id}">Size</label>
            <select id="size-${p.id}" class="size-select">
              ${p.sizes.map(s => `<option>${s}</option>`).join('')}
            </select>
          </div>` : `<input type="hidden" id="size-${p.id}" value="One Size">`}
        <div class="product-footer">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <button class="btn btn-primary btn-sm" onclick="addToCart('${p.id}')">Add to Cart</button>
        </div>
      </div>
    </div>`).join('');

  updateCartUI();
}

/* ============================================================
   VOLUNTEER PAGE
   ============================================================ */
function initVolunteerPage() {
  if (!$('#volunteer-events')) return;

  function renderEvents() {
    const events = Store.get('vol_events', []);
    const el = $('#volunteer-events');

    el.innerHTML = events.map(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      return `<div class="volunteer-event-card">
        <div class="volunteer-event-header">
          <div>
            <h3>${esc(ev.title)}</h3>
            <p style="opacity:0.85;font-size:14px">📅 ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <span class="badge badge-gold">${ev.roles.reduce((s,r) => s + (r.slots - r.signups.length), 0)} spots open</span>
        </div>
        <div class="volunteer-event-body">
          ${ev.roles.map(role => {
            const filled = role.signups.length;
            const open   = role.slots - filled;
            const chips  = Array.from({length: role.slots}, (_, i) =>
              `<div class="slot-chip ${i < filled ? 'filled' : 'open'}" title="${i < filled ? role.signups[i] : 'Open spot'}">${i < filled ? '✓' : ''}</div>`
            ).join('');
            return `<div class="volunteer-role">
              <div class="volunteer-role-info">
                <h5>${esc(role.name)}</h5>
                <p>${esc(role.description)}</p>
              </div>
              <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                <div class="slots-display">${chips}</div>
                <span style="font-size:13px;color:var(--text-light)">${open} of ${role.slots} open</span>
                ${open > 0 ? `<button class="btn btn-blue btn-sm" onclick="openVolSignup('${ev.id}','${role.id}','${esc(ev.title)}','${esc(role.name)}')">Sign Up</button>` : `<span class="badge badge-green">Full</span>`}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  }

  function renderMySignups() {
    const myName = localStorage.getItem('pto_myname') || '';
    const events = Store.get('vol_events', []);
    const rows   = [];
    events.forEach(ev => {
      ev.roles.forEach(role => {
        if (role.signups.includes(myName)) {
          rows.push({ event: ev.title, date: ev.date, role: role.name, desc: role.description });
        }
      });
    });
    const table = $('#my-signups-table');
    if (!table) return;
    if (rows.length === 0) {
      table.innerHTML = '<p style="color:var(--text-light);padding:16px">You have not signed up for any volunteer roles yet.</p>';
      return;
    }
    table.innerHTML = `<table class="my-signups-table">
      <thead><tr><th>Event</th><th>Date</th><th>Role</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${esc(r.event)}</strong></td>
        <td>${formatDate(r.date)}</td>
        <td>${esc(r.role)}<br><span style="color:var(--text-light);font-size:12px">${esc(r.desc)}</span></td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  window.openVolSignup = function(eventId, roleId, eventTitle, roleName) {
    $('#vol-modal-title').textContent  = eventTitle;
    $('#vol-modal-role').textContent   = roleName;
    $('#vol-form').dataset.eventId = eventId;
    $('#vol-form').dataset.roleId  = roleId;
    const savedName = localStorage.getItem('pto_myname') || '';
    const savedEmail = localStorage.getItem('pto_myemail') || '';
    if (savedName)  $('#vol-name').value  = savedName;
    if (savedEmail) $('#vol-email').value = savedEmail;
    $('#vol-modal').classList.remove('hidden');
  };

  $('#vol-modal-close')?.addEventListener('click', () => $('#vol-modal').classList.add('hidden'));
  $('#vol-modal')?.addEventListener('click', e => { if (e.target === $('#vol-modal')) $('#vol-modal').classList.add('hidden'); });

  $('#vol-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd      = new FormData(e.target);
    const name    = fd.get('name').trim();
    const email   = fd.get('email').trim();
    const eventId = e.target.dataset.eventId;
    const roleId  = e.target.dataset.roleId;

    if (!name || !email) { showAlert($('#vol-alert'), 'Please enter your name and email.', 'error'); return; }

    const events = Store.get('vol_events', []);
    const ev   = events.find(e => e.id === eventId);
    const role = ev?.roles.find(r => r.id === roleId);

    if (!role) { showAlert($('#vol-alert'), 'Role not found.', 'error'); return; }
    if (role.signups.includes(name)) { showAlert($('#vol-alert'), 'You are already signed up for this role!', 'error'); return; }
    if (role.signups.length >= role.slots) { showAlert($('#vol-alert'), 'Sorry, this role is now full.', 'error'); return; }

    role.signups.push(name);
    Store.set('vol_events', events);
    localStorage.setItem('pto_myname', name);
    localStorage.setItem('pto_myemail', email);

    $('#vol-modal').classList.add('hidden');
    e.target.reset();
    showAlert($('#vol-success'), `Thank you, ${name}! You're signed up to volunteer.`, 'success');
    renderEvents();
    renderMySignups();
  });

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#${btn.dataset.tab}`).classList.add('active');
    });
  });

  renderEvents();
  renderMySignups();
}

/* ============================================================
   CONTACT PAGE
   ============================================================ */
function initContactPage() {
  const form = $('#contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const msg = {
      id: 'm' + Date.now(),
      name: fd.get('name'),
      email: fd.get('email'),
      subject: fd.get('subject'),
      message: fd.get('message'),
      date: new Date().toISOString()
    };
    Store.push('messages', msg);
    form.reset();
    showAlert($('#contact-alert'), 'Thank you for your message! We\'ll get back to you within 2 business days.', 'success');
  });
}

/* ============================================================
   HERO SLIDER — homepage background image rotator (admin upload)
   ============================================================ */
function initHeroSlider() {
  const section = document.getElementById('hero-slider');
  if (!section) return;

  let slides    = Store.get('hero_slides', []);
  let current   = 0;
  let timer     = null;

  const slidesEl  = document.getElementById('hero-slides');
  const overlayEl = document.getElementById('hero-overlay');
  const dotsEl    = document.getElementById('hero-dots');
  const adminBar  = document.getElementById('hero-admin-bar');
  const removeBtn = document.getElementById('hero-remove-btn');

  function render() {
    if (!slidesEl) return;
    if (slides.length === 0) {
      slidesEl.innerHTML = '';
      dotsEl.innerHTML   = '';
      if (overlayEl) overlayEl.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'none';
      return;
    }
    if (current >= slides.length) current = slides.length - 1;

    slidesEl.innerHTML = slides.map((src, i) =>
      `<div style="position:absolute;inset:0;background:url('${src}') center/cover no-repeat;opacity:${i === current ? 1 : 0};transition:opacity 0.8s ease"></div>`
    ).join('');

    if (overlayEl) overlayEl.style.display = 'block';

    dotsEl.innerHTML = slides.length > 1 ? slides.map((_, i) =>
      `<button class="hero-dot${i === current ? ' active' : ''}" onclick="window.heroGoTo(${i})" aria-label="Go to slide ${i + 1}"></button>`
    ).join('') : '';

    if (removeBtn) removeBtn.style.display = 'inline-flex';
  }

  window.heroGoTo = function(idx) {
    current = ((idx % slides.length) + slides.length) % slides.length;
    render();
    resetTimer();
  };

  function advance() {
    if (slides.length > 1) { current = (current + 1) % slides.length; render(); }
  }

  function resetTimer() {
    clearInterval(timer);
    if (slides.length > 1) timer = setInterval(advance, 5000);
  }

  // Show admin controls only for admins
  if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged(user => {
      if (adminBar) {
        adminBar.style.display = (user && Array.isArray(adminEmails) && adminEmails.includes(user.email)) ? 'flex' : 'none';
      }
    });
  }

  // Image upload + canvas compress
  const fileInput = document.getElementById('hero-upload-input');
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        const img = new Image();
        img.onload = function() {
          const MAX = 1920;
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          slides.push(canvas.toDataURL('image/jpeg', 0.75));
          Store.set('hero_slides', slides);
          current = slides.length - 1;
          render();
          resetTimer();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }

  window.heroRemoveSlide = function() {
    if (slides.length === 0) return;
    if (!confirm('Remove this photo from the slider?')) return;
    slides.splice(current, 1);
    Store.set('hero_slides', slides);
    current = Math.max(0, Math.min(current, slides.length - 1));
    render();
    resetTimer();
  };

  render();
  resetTimer();
}

/* ============================================================
   CALENDAR TABS — homepage school calendar switcher
   ============================================================ */
window.showCalTab = function(id, btn) {
  document.querySelectorAll('.cal-panel').forEach(p => { p.style.display = 'none'; });
  document.querySelectorAll('.cal-tab-btn').forEach(b => { b.classList.remove('active'); });
  const panel = document.getElementById('cal-panel-' + id);
  if (panel) panel.style.display = 'block';
  if (btn) btn.classList.add('active');
};

/* ============================================================
   HOME PAGE — upcoming events preview
   ============================================================ */
function initHomePage() {
  const upcomingEl = $('#upcoming-events');
  if (!upcomingEl) return;
  const today = new Date().toISOString().split('T')[0];

  firebase.firestore()
    .collection('events')
    .where('date', '>=', today)
    .orderBy('date')
    .limit(3)
    .get()
    .then(snapshot => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (events.length === 0) {
        upcomingEl.innerHTML = '<p style="color:var(--text-light)">No upcoming events. Check back soon!</p>';
        return;
      }
      upcomingEl.innerHTML = events.map(ev => {
        const d = new Date(ev.date + 'T00:00:00');
        return `<div class="announcement-item">
          <div class="announcement-date">
            <div class="day">${d.getDate()}</div>
            <div class="month">${getMonthName(d.getMonth()).slice(0,3)}</div>
          </div>
          <div class="announcement-content">
            <h4><a href="events.html">${esc(ev.title)}</a></h4>
            <p>${ev.time ? ev.time + ' · ' : ''}${ev.location || ''}</p>
          </div>
        </div>`;
      }).join('');
    })
    .catch(() => {
      upcomingEl.innerHTML = '<p style="color:var(--text-light)">Check back soon for upcoming events!</p>';
    });
}

/* ============================================================
   NAV AUTH — swap Login button for user name/photo on all pages
   ============================================================ */
function initNavAuth() {
  if (typeof firebase === 'undefined') return;

  // Create dropdown (appended to body, positioned via JS)
  const dropdown = document.createElement('div');
  dropdown.id = 'nav-auth-dropdown';
  dropdown.style.cssText = 'display:none;position:fixed;z-index:9999;background:var(--white);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:0 8px 24px rgba(0,0,0,0.14);min-width:180px;overflow:hidden';
  dropdown.innerHTML = `
    <div id="nav-auth-email" style="padding:12px 16px;font-size:12px;color:var(--text-light);border-bottom:1px solid var(--border);word-break:break-all"></div>
    <a href="directory.html" style="display:block;padding:10px 16px;font-size:14px;color:var(--text);text-decoration:none;font-weight:600" onmouseover="this.style.background='var(--light-bg)'" onmouseout="this.style.background=''">My Directory Listing</a>
    <button onclick="signOut()" style="width:100%;text-align:left;padding:10px 16px;font-size:14px;color:var(--error);font-weight:600;border:none;background:none;cursor:pointer;font-family:inherit" onmouseover="this.style.background='var(--light-bg)'" onmouseout="this.style.background=''">Sign Out</button>
  `;
  document.body.appendChild(dropdown);

  let dropdownOpen = false;
  function closeDropdown() { dropdown.style.display = 'none'; dropdownOpen = false; }
  document.addEventListener('click', e => {
    if (dropdownOpen && !dropdown.contains(e.target) && e.target.id !== 'nav-login-btn') closeDropdown();
  });

  firebase.auth().onAuthStateChanged(user => {
    const btn = document.getElementById('nav-login-btn');
    if (!btn) return;

    if (user) {
      // Look up directory entry for name + photo
      const members = Store.get('directory', []);
      const entry = members.find(m => m.email === user.email);
      const firstName = entry ? entry.firstName : (user.displayName ? user.displayName.split(' ')[0] : '');
      const lastInitial = entry ? entry.lastName[0] : (user.displayName ? (user.displayName.split(' ')[1] || '')[0] : '');
      const photo = entry && entry.photo ? entry.photo : '';
      const label = firstName ? `${firstName} ${lastInitial}.` : user.email;

      const avatarHtml = photo
        ? `<img src="${photo}" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.5)">`
        : `<span style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${(firstName[0]||'?').toUpperCase()}</span>`;

      btn.style.cssText = 'display:inline-flex;align-items:center;gap:7px;padding:4px 12px 4px 4px;border-radius:99px;cursor:pointer;font-weight:700;font-size:14px;text-decoration:none';
      btn.innerHTML = `${avatarHtml}<span>${esc(label)}</span>`;
      btn.removeAttribute('href');
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        if (dropdownOpen) { closeDropdown(); return; }
        const rect = btn.getBoundingClientRect();
        dropdown.style.top  = (rect.bottom + 6) + 'px';
        dropdown.style.right = (window.innerWidth - rect.right) + 'px';
        dropdown.style.left = 'auto';
        dropdown.style.display = 'block';
        document.getElementById('nav-auth-email').textContent = user.email;
        dropdownOpen = true;
      };
    } else {
      btn.href = 'login.html';
      btn.innerHTML = 'Login';
      btn.onclick = null;
      btn.style.cssText = '';
      closeDropdown();
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  seedData();
  initNavToggle();
  setActiveNav();
  initNavAuth();
  initHeroSlider();
  initHomePage();
  initEventsPage();
  initDirectoryPage();
  initShopPage();
  initVolunteerPage();
  initContactPage();
});
