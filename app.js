/* ============================================================
   Career Tree — приложение (auth + admin + employee)
   ============================================================ */
const DB_KEY = 'career_tree_db_v2';
const SESSION_KEY = 'career_tree_session_v2';
const AVATARS = ['🧑‍💻','👩‍💻','👨‍💼','👩‍💼','🦊','🐼','🦉','🚀','🐉','🦄','🧙‍♂️','🧑‍🔬'];

let db = null;
let session = null;
let activeTab = 'profile';
let adminTab = 'users';
let radarMode = 'hard';
let wizard = null;

/* ---------- Хеш пароля (простой, только для демо) ---------- */
function hashPassword(pwd) {
  let h = 0;
  for (let i = 0; i < pwd.length; i++) { h = ((h << 5) - h) + pwd.charCodeAt(i); h |= 0; }
  return 'h' + Math.abs(h).toString(36) + pwd.length.toString(36);
}

/* ---------- DB ---------- */
function createDefaultDb() {
  const config = {
    roles: DEFAULT_ROLES.map(r => ({ ...r })),
    grades: DEFAULT_GRADES.map(g => ({ ...g })),
    criteria: {},
  };
  config.roles.forEach(role => {
    config.criteria[role.id] = {};
    config.grades.forEach(grade => {
      config.criteria[role.id][grade.id] = buildDefaultRequirements(role.id, grade.level);
    });
  });
  return { users: {}, config };
}
function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.users && parsed.config) return parsed;
    }
  } catch {}
  return createDefaultDb();
}
function saveDb() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

/* ---------- Session ---------- */
function loadSession() {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function saveSession() {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}
function getMode() {
  if (!session) return 'auth';
  if (session.role === 'admin') return session.viewAs ? 'viewAs' : 'admin';
  return 'user';
}
function getCurrentUserId() {
  if (!session) return null;
  if (session.role === 'admin' && session.viewAs) return session.viewAs;
  if (session.role === 'user') return session.userId;
  return null;
}
function getCurrentUser() {
  const id = getCurrentUserId();
  return id ? db.users[id] : null;
}

/* ---------- Config helpers ---------- */
const getRoles = () => db.config.roles;
const getGrades = () => db.config.grades;
const getRoleById = (id) => db.config.roles.find(r => r.id === id);
const getGradeById = (id) => db.config.grades.find(g => g.id === id);
const getRequirements = (roleId, gradeId) => db.config.criteria[roleId]?.[gradeId] || {};

function getSortedGrades() {
  return [...db.config.grades].sort((a, b) => a.level - b.level);
}
function getNextGrade(gradeId) {
  const g = getGradeById(gradeId);
  if (!g) return null;
  const sorted = getSortedGrades();
  const idx = sorted.findIndex(x => x.id === g.id);
  return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
}
function getPrevGrade(gradeId) {
  const g = getGradeById(gradeId);
  if (!g) return null;
  const sorted = getSortedGrades();
  const idx = sorted.findIndex(x => x.id === g.id);
  return idx > 0 ? sorted[idx - 1] : null;
}
function positionReadiness(roleId, gradeId, skills) {
  const req = getRequirements(roleId, gradeId);
  const entries = Object.entries(req).filter(([, v]) => v > 0);
  if (!entries.length) return 1;
  let sum = 0;
  for (const [s, r] of entries) sum += Math.min(1, (skills[s] || 0) / r);
  return sum / entries.length;
}
function positionTitle(roleId, gradeId) {
  const role = getRoleById(roleId), grade = getGradeById(gradeId);
  return role && grade ? `${grade.name} ${role.name}` : '—';
}

/* ---------- UI ---------- */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const avatarLevel = xp => Math.floor(Math.sqrt(xp / 100)) + 1;
const xpForLevel  = lvl => Math.pow(lvl - 1, 2) * 100;
let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

/* ============================================================
   AUTH
   ============================================================ */
function showAuth(mode = 'login', error = null) {
  document.getElementById('app-header').style.display = 'none';
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('auth').classList.add('active');

  document.getElementById('auth').innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo">◈</div>
        <h1 class="auth-title">Career Tree</h1>
        <p class="auth-sub">Система карьерного развития</p>
        ${error ? `<div class="note-error">${escapeHtml(error)}</div>` : ''}
        ${mode === 'login' ? renderLoginForm() : renderRegisterForm()}
        <div class="auth-hint">Вход для администратора: <strong>admin / admin</strong></div>
      </div>
    </div>`;
}

function renderLoginForm() {
  return `
    <form id="login-form" autocomplete="on">
      <div class="auth-field">
        <label>Корпоративная почта</label>
        <input type="text" name="email" placeholder="ivan.petrov@biv.ru" required autocomplete="username">
      </div>
      <div class="auth-field">
        <label>Пароль</label>
        <input type="password" name="password" placeholder="••••••••" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn btn-primary auth-submit">Войти</button>
    </form>
    <div class="auth-switch">Нет аккаунта? <a data-auth-mode="register">Зарегистрироваться</a></div>`;
}
function renderRegisterForm() {
  return `
    <form id="register-form" autocomplete="on">
      <div class="auth-field">
        <label>Имя и фамилия</label>
        <input type="text" name="name" placeholder="Иван Петров" required autocomplete="name">
      </div>
      <div class="auth-field">
        <label>Корпоративная почта</label>
        <input type="email" name="email" placeholder="ivan.petrov@biv.ru" required autocomplete="email">
      </div>
      <div class="auth-field">
        <label>Пароль (мин. 6 символов)</label>
        <input type="password" name="password" placeholder="••••••••" required minlength="6" autocomplete="new-password">
      </div>
      <div class="auth-field">
        <label>Повторите пароль</label>
        <input type="password" name="password2" placeholder="••••••••" required minlength="6">
      </div>
      <button type="submit" class="btn btn-primary auth-submit">Создать аккаунт</button>
    </form>
    <div class="auth-switch">Уже есть аккаунт? <a data-auth-mode="login">Войти</a></div>`;
}

function onAuthSubmit(e) {
  e.preventDefault();
  const isLogin = e.target.id === 'login-form';
  const fd = new FormData(e.target);

  if (isLogin) {
    const login = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');

    if (login === ADMIN_CREDENTIALS.login && password === ADMIN_CREDENTIALS.password) {
      session = { role: 'admin' };
      saveSession();
      route();
      return;
    }
    const found = Object.values(db.users).find(u => u.email === login);
    if (!found) return showAuth('login', 'Пользователь с такой почтой не найден');
    if (found.password !== hashPassword(password)) return showAuth('login', 'Неверный пароль');
    session = { role: 'user', userId: found.id };
    saveSession();
    route();
  } else {
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const password2 = String(fd.get('password2') || '');

    if (!name) return showAuth('register', 'Укажите имя');
    if (!email.includes('@')) return showAuth('register', 'Укажите корректный email');
    if (password.length < 6) return showAuth('register', 'Пароль должен содержать минимум 6 символов');
    if (password !== password2) return showAuth('register', 'Пароли не совпадают');
    if (Object.values(db.users).some(u => u.email === email)) return showAuth('register', 'Пользователь с такой почтой уже существует');

    const id = 'u' + Date.now() + Math.random().toString(36).slice(2, 6);
    db.users[id] = {
      id, email, password: hashPassword(password), name,
      department: '', roleId: null, gradeId: null,
      avatar: '🧑‍💻', xp: 100, skills: {}, goals: [],
      targetPositionId: null, activity: [{ icon: '🏁', text: 'Регистрация в Career Tree', time: Date.now() }],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    saveDb();
    session = { role: 'user', userId: id };
    saveSession();
    route();
  }
}

function logout() {
  session = null;
  saveSession();
  wizard = null;
  route();
}

/* ============================================================
   ADMIN PANEL
   ============================================================ */
function showAdmin() {
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('tabs').style.display = 'none';
  document.getElementById('header-actions').style.display = 'flex';
  document.getElementById('header-subtitle').textContent = 'Админ-панель · BIV';
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admin').classList.add('active');
  renderAdmin();
}

function renderAdmin() {
  const users = Object.values(db.users);
  let content = '';

  if (adminTab === 'users') {
    content = `
      <div class="card">
        <div class="panel-head">
          <h2 style="margin:0">Сотрудники (${users.length})</h2>
        </div>
        ${users.length === 0
          ? `<div class="empty-list"><div class="empty-list-icon">👥</div><p>Пока нет зарегистрированных сотрудников.<br>Предложите сотрудникам зарегистрироваться по корпоративной почте.</p></div>`
          : users.map(u => {
              const role = u.roleId ? getRoleById(u.roleId) : null;
              const grade = u.gradeId ? getGradeById(u.gradeId) : null;
              const sub = !role
                ? 'Профиль не заполнен (ожидает онбординга)'
                : `${role.icon} ${role.name} · ${grade?.name || '—'} · ${u.department || '—'}`;
              return `
                <div class="list-item">
                  <div class="list-item-info">
                    <div class="list-item-name">${escapeHtml(u.name)} · <span class="muted small">${escapeHtml(u.email)}</span></div>
                    <div class="list-item-sub">${sub}</div>
                  </div>
                  <div class="list-item-actions">
                    <button class="btn btn-sm" data-view-user="${u.id}">Открыть профиль →</button>
                    <button class="btn btn-ghost btn-sm" data-delete-user="${u.id}">Удалить</button>
                  </div>
                </div>`;
            }).join('')}
      </div>`;
  }

  else if (adminTab === 'roles') {
    content = `
      <div class="card">
        <h2>Роли</h2>
        <p class="muted">Список должностей в системе. Каждая роль участвует в карте роста.</p>
        <div class="inline-form">
          <input id="new-role-name" placeholder="Название новой роли, например: Designer">
          <input id="new-role-icon" placeholder="Иконка (эмодзи)" value="🆕" style="max-width:100px;flex:0 0 auto">
          <button class="btn btn-primary" data-add-role>+ Добавить</button>
        </div>
        ${db.config.roles.map(r => `
          <div class="list-item">
            <div class="list-item-info">
              <div class="list-item-name">${r.icon} ${escapeHtml(r.name)}</div>
              <div class="list-item-sub">ID: ${r.id}</div>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-sm" data-edit-role="${r.id}">Переименовать</button>
              <button class="btn btn-ghost btn-sm" data-delete-role="${r.id}">Удалить</button>
            </div>
          </div>`).join('')}
      </div>`;
  }

  else if (adminTab === 'grades') {
    content = `
      <div class="card">
        <h2>Грейды</h2>
        <p class="muted">Уровни развития. Порядок соответствует уровню (level).</p>
        <div class="inline-form">
          <input id="new-grade-name" placeholder="Название грейда, например: Junior+">
          <button class="btn btn-primary" data-add-grade>+ Добавить</button>
        </div>
        ${getSortedGrades().map(g => `
          <div class="list-item">
            <div class="list-item-info">
              <div class="list-item-name">${escapeHtml(g.name)}</div>
              <div class="list-item-sub">Уровень ${g.level} · ID: ${g.id}</div>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-sm" data-edit-grade="${g.id}">Переименовать</button>
              <button class="btn btn-ghost btn-sm" data-delete-grade="${g.id}">Удалить</button>
            </div>
          </div>`).join('')}
      </div>`;
  }

  else if (adminTab === 'criteria') {
    content = renderCriteriaEditor();
  }

  document.getElementById('admin').innerHTML = `
    <div class="admin-nav">
      <button class="admin-nav-btn ${adminTab === 'users' ? 'active' : ''}" data-admin-tab="users">👥 Сотрудники</button>
      <button class="admin-nav-btn ${adminTab === 'roles' ? 'active' : ''}" data-admin-tab="roles">🎭 Роли</button>
      <button class="admin-nav-btn ${adminTab === 'grades' ? 'active' : ''}" data-admin-tab="grades">📊 Грейды</button>
      <button class="admin-nav-btn ${adminTab === 'criteria' ? 'active' : ''}" data-admin-tab="criteria">🎯 Критерии</button>
    </div>
    ${content}`;
}

let criteriaRoleId = null;
function renderCriteriaEditor() {
  const roles = db.config.roles;
  if (!roles.length) return `<div class="card"><p class="muted">Сначала добавьте хотя бы одну роль.</p></div>`;
  if (!criteriaRoleId || !getRoleById(criteriaRoleId)) criteriaRoleId = roles[0].id;

  const role = getRoleById(criteriaRoleId);
  const grades = getSortedGrades();
  const req = db.config.criteria[role.id] || {};

  const hardSkills = Object.keys(SKILL_CATALOG).filter(id => SKILL_CATALOG[id].group === 'Hard');
  const softSkills = Object.keys(SKILL_CATALOG).filter(id => SKILL_CATALOG[id].group === 'Soft');
  const projSkills = Object.keys(SKILL_CATALOG).filter(id => SKILL_CATALOG[id].group === 'Project');

  const rowFor = (skillId) => {
    const cells = grades.map(g => {
      const val = req[g.id]?.[skillId] ?? 0;
      return `<td class="num"><input type="number" min="0" max="100" value="${val}" data-criteria="${g.id}" data-skill="${skillId}"></td>`;
    }).join('');
    return `<tr><td>${SKILL_CATALOG[skillId].name}</td>${cells}</tr>`;
  };

  return `
    <div class="card">
      <h2>Критерии по ролям и грейдам</h2>
      <p class="muted">Укажите требуемый уровень каждого навыка (0–100) для каждой роли и грейда. 0 = навык не требуется.</p>
      <div class="admin-selector">
        <label>Роль:</label>
        <select id="criteria-role-select">
          ${roles.map(r => `<option value="${r.id}" ${r.id === role.id ? 'selected' : ''}>${r.icon} ${r.name}</option>`).join('')}
        </select>
      </div>
      <div style="overflow-x:auto">
        <table class="criteria-table">
          <thead>
            <tr>
              <th>Навык</th>
              ${grades.map(g => `<th class="num">${escapeHtml(g.name)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="group-row"><td colspan="${grades.length + 1}">Hard skills</td></tr>
            ${hardSkills.map(rowFor).join('')}
            <tr class="group-row"><td colspan="${grades.length + 1}">Soft skills</td></tr>
            ${softSkills.map(rowFor).join('')}
            <tr class="group-row"><td colspan="${grades.length + 1}">Проектные навыки</td></tr>
            ${projSkills.map(rowFor).join('')}
          </tbody>
        </table>
      </div>
      <div class="save-bar">
        <button class="btn btn-ghost" data-reset-criteria>Сбросить к дефолту</button>
        <button class="btn btn-primary" data-save-criteria>💾 Сохранить критерии</button>
      </div>
    </div>`;
}

function saveCriteria() {
  const roleId = criteriaRoleId;
  const role = getRoleById(roleId);
  if (!role) return;
  const inputs = document.querySelectorAll('[data-criteria]');
  const newReq = {};
  inputs.forEach(input => {
    const gradeId = input.dataset.criteria;
    const skillId = input.dataset.skill;
    const val = Math.max(0, Math.min(100, parseInt(input.value) || 0));
    if (!newReq[gradeId]) newReq[gradeId] = {};
    if (val > 0) newReq[gradeId][skillId] = val;
  });
  db.config.criteria[roleId] = newReq;
  saveDb();
  toast(`Критерии для роли «${role.name}» сохранены`);
  renderAdmin();
}

function resetCriteriaForRole() {
  const roleId = criteriaRoleId;
  const role = getRoleById(roleId);
  if (!role) return;
  if (!confirm(`Сбросить критерии для роли «${role.name}» к дефолтным?`)) return;
  db.config.criteria[roleId] = {};
  db.config.grades.forEach(g => {
    db.config.criteria[roleId][g.id] = buildDefaultRequirements(roleId, g.level);
  });
  saveDb();
  toast('Критерии сброшены к дефолту');
  renderAdmin();
}

/* ---------- Admin actions ---------- */
function addRole() {
  const nameInput = document.getElementById('new-role-name');
  const iconInput = document.getElementById('new-role-icon');
  const name = (nameInput?.value || '').trim();
  const icon = (iconInput?.value || '🆕').trim() || '🆕';
  if (!name) { toast('Введите название'); return; }
  const id = 'role_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
  db.config.roles.push({ id, name, icon, color: '#0057FF' });
  db.config.criteria[id] = {};
  db.config.grades.forEach(g => {
    db.config.criteria[id][g.id] = buildDefaultRequirements(id, g.level);
  });
  saveDb();
  toast(`Роль «${name}» добавлена`);
  renderAdmin();
}

function deleteRole(roleId) {
  const role = getRoleById(roleId);
  if (!role) return;
  if (!confirm(`Удалить роль «${role.name}»? Критерии и привязки сотрудников будут сброшены.`)) return;
  db.config.roles = db.config.roles.filter(r => r.id !== roleId);
  delete db.config.criteria[roleId];
  Object.values(db.users).forEach(u => { if (u.roleId === roleId) u.roleId = null; });
  if (criteriaRoleId === roleId) criteriaRoleId = null;
  saveDb();
  toast(`Роль «${role.name}» удалена`);
  renderAdmin();
}

function editRole(roleId) {
  const role = getRoleById(roleId);
  if (!role) return;
  const newName = prompt('Новое название роли:', role.name);
  if (!newName || !newName.trim()) return;
  role.name = newName.trim();
  saveDb();
  renderAdmin();
}

function addGrade() {
  const input = document.getElementById('new-grade-name');
  const name = (input?.value || '').trim();
  if (!name) { toast('Введите название грейда'); return; }
  const sorted = getSortedGrades();
  const maxLevel = sorted.length ? sorted[sorted.length - 1].level : 0;
  const id = 'grade_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
  db.config.grades.push({ id, name, level: maxLevel + 1 });
  db.config.roles.forEach(r => {
    if (!db.config.criteria[r.id]) db.config.criteria[r.id] = {};
    db.config.criteria[r.id][id] = buildDefaultRequirements(r.id, maxLevel + 1);
  });
  saveDb();
  toast(`Грейд «${name}» добавлен`);
  renderAdmin();
}

function deleteGrade(gradeId) {
  const grade = getGradeById(gradeId);
  if (!grade) return;
  if (!confirm(`Удалить грейд «${grade.name}»?`)) return;
  db.config.grades = db.config.grades.filter(g => g.id !== gradeId);
  db.config.roles.forEach(r => {
    if (db.config.criteria[r.id]) delete db.config.criteria[r.id][gradeId];
  });
  Object.values(db.users).forEach(u => { if (u.gradeId === gradeId) u.gradeId = null; });
  saveDb();
  toast(`Грейд «${grade.name}» удалён`);
  renderAdmin();
}

function editGrade(gradeId) {
  const grade = getGradeById(gradeId);
  if (!grade) return;
  const newName = prompt('Новое название грейда:', grade.name);
  if (!newName || !newName.trim()) return;
  grade.name = newName.trim();
  saveDb();
  renderAdmin();
}

function deleteUser(userId) {
  const u = db.users[userId];
  if (!u) return;
  if (!confirm(`Удалить сотрудника «${u.name}»?`)) return;
  delete db.users[userId];
  saveDb();
  toast('Сотрудник удалён');
  renderAdmin();
}

function viewAsUser(userId) {
  if (!db.users[userId]) return;
  session.viewAs = userId;
  saveSession();
  route();
}

function exitViewAs() {
  if (session) { delete session.viewAs; saveSession(); }
  route();
}

function onAdminClick(e) {
  const navBtn = e.target.closest('[data-admin-tab]');
  if (navBtn) { adminTab = navBtn.dataset.adminTab; renderAdmin(); return; }

  const viewUser = e.target.closest('[data-view-user]');
  if (viewUser) { viewAsUser(viewUser.dataset.viewUser); return; }

  const delUser = e.target.closest('[data-delete-user]');
  if (delUser) { deleteUser(delUser.dataset.deleteUser); return; }

  if (e.target.closest('[data-add-role]')) { addRole(); return; }
  const delRole = e.target.closest('[data-delete-role]');
  if (delRole) { deleteRole(delRole.dataset.deleteRole); return; }
  const editRoleBtn = e.target.closest('[data-edit-role]');
  if (editRoleBtn) { editRole(editRoleBtn.dataset.editRole); return; }

  if (e.target.closest('[data-add-grade]')) { addGrade(); return; }
  const delGrade = e.target.closest('[data-delete-grade]');
  if (delGrade) { deleteGrade(delGrade.dataset.deleteGrade); return; }
  const editGradeBtn = e.target.closest('[data-edit-grade]');
  if (editGradeBtn) { editGrade(editGradeBtn.dataset.editGrade); return; }

  if (e.target.closest('[data-save-criteria]')) { saveCriteria(); return; }
  if (e.target.closest('[data-reset-criteria]')) { resetCriteriaForRole(); return; }
}

function onAdminChange(e) {
  if (e.target.id === 'criteria-role-select') {
    criteriaRoleId = e.target.value;
    renderAdmin();
  }
}
/* ============================================================
   WIZARD
   ============================================================ */
function startWizard(targetUserId, edit = false) {
  const user = db.users[targetUserId];
  if (!user) return;
  const defaultSkills = {};
  Object.keys(SKILL_CATALOG).forEach(id => defaultSkills[id] = 30);

  if (edit) {
    wizard = {
      targetUserId, step: 1, editing: true,
      draft: {
        name: user.name, department: user.department,
        roleId: user.roleId || db.config.roles[0]?.id,
        gradeId: user.gradeId || getSortedGrades()[0]?.id,
        skills: { ...defaultSkills, ...(user.skills || {}) },
      },
    };
  } else {
    wizard = {
      targetUserId, step: 1, editing: false,
      draft: {
        name: user.name, department: user.department || '',
        roleId: db.config.roles[0]?.id,
        gradeId: getSortedGrades()[0]?.id,
        skills: { ...defaultSkills, ...(user.skills || {}) },
      },
    };
  }
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('tabs').style.display = 'none';
  document.getElementById('header-actions').style.display = 'none';
  document.getElementById('header-subtitle').textContent = edit ? 'Редактирование профиля' : 'Создание профиля';
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('onboarding').classList.add('active');
  renderWizard();
}

function renderWizard() {
  const w = wizard;
  let content = w.step === 1 ? wizardStep1() : w.step === 2 ? wizardStep2() : wizardStep3();
  document.getElementById('onboarding').innerHTML = `
    <div class="wizard">
      <div class="wizard-steps">
        ${[1,2,3].map(n => `
          <div class="wizard-step ${n === w.step ? 'active' : ''} ${n < w.step ? 'done' : ''}">
            <span class="wizard-step-num">${n < w.step ? '✓' : n}</span>
            <span class="wizard-step-label">${['Профиль','Навыки','Готово'][n-1]}</span>
          </div>`).join('')}
      </div>
      ${content}
    </div>`;
}

function wizardStep1() {
  const d = wizard.draft;
  const roles = db.config.roles;
  const grades = getSortedGrades();
  return `
    <div class="card">
      <h2>Расскажите о себе</h2>
      <p class="muted">Заполните данные и выберите направление развития.</p>
      <div class="form-grid">
        <label><span>Имя и фамилия *</span>
          <input class="input" data-wizard="name" value="${escapeHtml(d.name)}" placeholder="Иван Петров"></label>
        <label><span>Отдел / команда</span>
          <input class="input" data-wizard="department" value="${escapeHtml(d.department)}" placeholder="Платформа"></label>
      </div>
      <h3 style="color:var(--text);text-transform:none;letter-spacing:0;font-size:16px">Ваша роль</h3>
      <div class="track-grid">
        ${roles.map(r => `
          <button class="track-option ${d.roleId === r.id ? 'active' : ''}" data-wizard-role="${r.id}">
            <span class="track-option-icon">${r.icon}</span>
            <span>${escapeHtml(r.name)}</span>
          </button>`).join('')}
      </div>
      <h3 style="color:var(--text);text-transform:none;letter-spacing:0;font-size:16px">Ваш грейд</h3>
      <div class="grade-grid">
        ${grades.map(g => `
          <button class="grade-option ${d.gradeId === g.id ? 'active' : ''}" data-wizard-grade="${g.id}">${escapeHtml(g.name)}</button>`).join('')}
      </div>
      <div class="wizard-footer">
        <span></span>
        <button class="btn btn-primary" id="wizard-next">Далее →</button>
      </div>
    </div>`;
}

function wizardStep2() {
  const d = wizard.draft;
  const req = getRequirements(d.roleId, d.gradeId);
  const hardIds = Object.entries(req).filter(([id]) => SKILL_CATALOG[id]?.group === 'Hard').map(([id]) => id);
  const softIds = Object.entries(req).filter(([id]) => SKILL_CATALOG[id]?.group === 'Soft').map(([id]) => id);
  const projIds = Object.entries(req).filter(([id]) => SKILL_CATALOG[id]?.group === 'Project').map(([id]) => id);

  const section = (title, subtitle, ids) => !ids.length ? '' : `
    <div class="wizard-section">
      <div class="wizard-section-head">
        <div><h3>${title}</h3><p class="muted small" style="margin:0">${subtitle}</p></div>
        <div class="quick-fill">
          <button class="btn btn-ghost btn-sm" data-quick-fill="${ids.join(',')}" data-quick-val="20">Новичок</button>
          <button class="btn btn-ghost btn-sm" data-quick-fill="${ids.join(',')}" data-quick-val="50">Средне</button>
          <button class="btn btn-ghost btn-sm" data-quick-fill="${ids.join(',')}" data-quick-val="75">Уверенно</button>
        </div>
      </div>
      <div class="slider-list">
        ${ids.map(id => `
          <div class="slider-row">
            <label>${SKILL_CATALOG[id].name}</label>
            <input type="range" min="0" max="100" value="${d.skills[id] ?? 30}" data-slider-skill="${id}">
            <span class="slider-val" id="val-${id}">${d.skills[id] ?? 30}</span>
          </div>`).join('')}
      </div>
    </div>`;

  return `
    <div class="card">
      <h2>Оцените свои навыки</h2>
      <p class="muted">Приблизительно отметьте уровень владения. Значения можно уточнить позже.</p>
      ${section('Hard skills', `Профессиональные навыки`, hardIds)}
      ${section('Soft skills', 'Универсальные навыки', softIds)}
      ${section('Проектные навыки', 'Опыт участия и ведения проектов', projIds)}
      <div class="wizard-footer">
        <button class="btn" id="wizard-back">← Назад</button>
        <button class="btn btn-primary" id="wizard-next">Далее →</button>
      </div>
    </div>`;
}

function wizardStep3() {
  const d = wizard.draft;
  const role = getRoleById(d.roleId);
  const grade = getGradeById(d.gradeId);
  const nextGrade = getNextGrade(d.gradeId);
  const nextReadiness = nextGrade ? positionReadiness(d.roleId, nextGrade.id, d.skills) : 0;

  return `
    <div class="card">
      <h2>Всё готово!</h2>
      <p class="muted">Проверьте данные и сохраните профиль.</p>
      <div class="review-grid">
        <div class="review-item"><span class="muted small">Имя</span><strong>${escapeHtml(d.name) || '—'}</strong></div>
        <div class="review-item"><span class="muted small">Отдел</span><strong>${escapeHtml(d.department) || '—'}</strong></div>
        <div class="review-item"><span class="muted small">Роль</span><strong>${role.icon} ${escapeHtml(role.name)}</strong></div>
        <div class="review-item"><span class="muted small">Грейд</span><strong>${escapeHtml(grade.name)}</strong></div>
      </div>
      <div class="card-inner">
        <h3 style="color:var(--text);text-transform:none;letter-spacing:0;font-size:15px;margin-bottom:6px">Ваша стартовая позиция</h3>
        <div style="font-size:20px;font-weight:800;margin:4px 0 10px">${positionTitle(d.roleId, d.gradeId)}</div>
        ${nextGrade ? `<p class="muted">Готовность к следующей ступени (${positionTitle(d.roleId, nextGrade.id)}): <strong style="color:var(--text)">${Math.round(nextReadiness * 100)}%</strong></p>` : ''}
      </div>
      <div class="wizard-footer">
        <button class="btn" id="wizard-back">← Назад</button>
        <button class="btn btn-primary" id="wizard-finish">${wizard.editing ? 'Сохранить' : 'Создать профиль'}</button>
      </div>
    </div>`;
}

function onWizardInput(e) {
  const nameInput = e.target.closest('[data-wizard]');
  if (nameInput) wizard.draft[nameInput.dataset.wizard] = nameInput.value;
  const slider = e.target.closest('[data-slider-skill]');
  if (slider) {
    const id = slider.dataset.sliderSkill;
    wizard.draft.skills[id] = +slider.value;
    const val = document.getElementById('val-' + id);
    if (val) val.textContent = slider.value;
  }
}

function onWizardClick(e) {
  const roleBtn = e.target.closest('[data-wizard-role]');
  if (roleBtn) { wizard.draft.roleId = roleBtn.dataset.wizardRole; renderWizard(); return; }
  const gradeBtn = e.target.closest('[data-wizard-grade]');
  if (gradeBtn) { wizard.draft.gradeId = gradeBtn.dataset.wizardGrade; renderWizard(); return; }
  const quickFill = e.target.closest('[data-quick-fill]');
  if (quickFill) {
    const ids = quickFill.dataset.quickFill.split(',');
    const val = +quickFill.dataset.quickVal;
    ids.forEach(id => wizard.draft.skills[id] = val);
    renderWizard();
    return;
  }
  const nextBtn = e.target.closest('#wizard-next');
  if (nextBtn) {
    if (wizard.step === 1) {
      if (!wizard.draft.name.trim()) { toast('Введите имя'); return; }
      if (!wizard.draft.roleId) { toast('Выберите роль'); return; }
      if (!wizard.draft.gradeId) { toast('Выберите грейд'); return; }
    }
    if (wizard.step < 3) { wizard.step++; renderWizard(); }
    return;
  }
  const backBtn = e.target.closest('#wizard-back');
  if (backBtn) { if (wizard.step > 1) { wizard.step--; renderWizard(); } return; }
  const finishBtn = e.target.closest('#wizard-finish');
  if (finishBtn) { finishBtn.disabled = true; finishBtn.textContent = 'Сохраняем…'; finishWizard(); }
}

function finishWizard() {
  const d = wizard.draft;
  const u = db.users[wizard.targetUserId];
  if (!u) { toast('Пользователь не найден'); return; }
  u.name = d.name.trim();
  u.department = d.department.trim();
  u.roleId = d.roleId;
  u.gradeId = d.gradeId;
  u.skills = { ...d.skills };
  u.updatedAt = Date.now();
  u.activity.unshift({ icon: wizard.editing ? '✎' : '🏁', text: wizard.editing ? 'Профиль обновлён' : 'Профиль создан', time: Date.now() });
  if (!u.avatar) u.avatar = '🧑‍💻';
  if (!u.xp) u.xp = 100;
  saveDb();
  const wasEditing = wizard.editing;
  wizard = null;
  activeTab = 'profile';
  toast(wasEditing ? 'Профиль обновлён' : 'Профиль создан!');
  route();
}

/* ============================================================
   EMPLOYEE VIEWS
   ============================================================ */
function showUserApp() {
  const u = getCurrentUser();
  if (!u) { logout(); return; }
  const mode = getMode();

  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('tabs').style.display = 'flex';
  document.getElementById('header-actions').style.display = 'flex';
  document.getElementById('header-subtitle').textContent = mode === 'viewAs'
    ? `Просмотр как: ${u.name}`
    : `${u.name} · ${u.email}`;

  const banner = mode === 'viewAs' ? `
    <div class="view-as-banner">
      <span>👀 Режим просмотра: <strong>${escapeHtml(u.name)}</strong> — вы видите страницу сотрудника как администратор</span>
      <button id="exit-view-as">← К админ-панели</button>
    </div>` : '';

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('profile').classList.add('active');
  switchTab(activeTab);
  renderAll();

  // Вставляем баннер
  const existingBanner = document.querySelector('.view-as-banner');
  if (existingBanner) existingBanner.remove();
  if (banner) {
    const main = document.querySelector('main');
    main.insertAdjacentHTML('afterbegin', banner);
  }
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tab && (tab === 'profile' || tab === 'radar' || tab === 'map' || tab === 'plan' || tab === 'feed')));
}

function renderAll() {
  const u = getCurrentUser();
  if (!u || !u.roleId || !u.gradeId) return;
  renderProfile();
  renderRadar();
  renderMap();
  renderPlan();
  renderFeed();
}

/* ---------- Profile ---------- */
function renderProfile() {
  const u = getCurrentUser();
  const role = getRoleById(u.roleId);
  const grade = getGradeById(u.gradeId);
  const nextGrade = getNextGrade(u.gradeId);
  const readiness = nextGrade ? positionReadiness(u.roleId, nextGrade.id, u.skills) : 1;
  const lvl = avatarLevel(u.xp || 100);
  const curLvlXp = xpForLevel(lvl);
  const nxtXp = xpForLevel(lvl + 1);
  const levelPct = Math.round(((u.xp - curLvlXp) / (nxtXp - curLvlXp)) * 100);

  const skillRow = (id) => {
    const val = u.skills[id] || 0;
    return `
      <div class="skill-row">
        <div>${SKILL_CATALOG[id].name}</div>
        <div class="skill-bar"><div class="skill-fill" style="width:${val}%"></div></div>
        <div class="skill-val">${val}</div>
        <button class="icon-btn" data-skill-up="${id}" title="+3">+</button>
      </div>`;
  };

  const req = getRequirements(u.roleId, u.gradeId);
  const hardIds = Object.keys(req).filter(id => SKILL_CATALOG[id]?.group === 'Hard');
  const softIds = Object.keys(req).filter(id => SKILL_CATALOG[id]?.group === 'Soft');
  const projIds = Object.keys(req).filter(id => SKILL_CATALOG[id]?.group === 'Project');
  const targetPos = u.targetPositionId ? { roleId: u.targetPositionId.split('_')[0], gradeId: u.targetPositionId.split('_')[1] } : null;

  document.getElementById('profile').innerHTML = `
    <div class="hero card">
      <div class="avatar-wrap">
        <div class="avatar" data-avatar title="Сменить аватар">${u.avatar || '🧑‍💻'}</div>
        <div class="level-badge">Ур. ${lvl}</div>
      </div>
      <div class="hero-info">
        <h2>${escapeHtml(u.name)}</h2>
        <p class="muted" style="margin:0">${escapeHtml(u.department) || '—'} · ${escapeHtml(u.email)}</p>
        <div class="chips">
          <span class="chip chip-grade">${role.icon} ${grade.name} · ${role.name}</span>
          <span class="chip">${u.xp} XP</span>
          ${targetPos ? `<span class="chip chip-target">🎯 ${positionTitle(targetPos.roleId, targetPos.gradeId)}</span>` : ''}
        </div>
        <div class="skill-bar" style="height:8px;margin-top:12px;background:var(--bg-2)">
          <div style="height:100%;width:${levelPct}%;background:linear-gradient(90deg,var(--biv-blue),var(--biv-cyan));border-radius:999px"></div>
        </div>
        <p class="muted small" style="margin:6px 0 0">${u.xp - curLvlXp} / ${nxtXp - curLvlXp} XP до уровня ${lvl + 1}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:
