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

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px">
      <div class="card">
        <h3>Текущая позиция</h3>
        <div style="font-size:20px;font-weight:800;margin:4px 0 10px">${positionTitle(u.roleId, u.gradeId)}</div>
        <p class="muted">Позиция определяется ролью и текущим грейдом сотрудника.</p>
      </div>
      <div class="card">
        <h3>Следующая ступень</h3>
        <div style="font-size:20px;font-weight:800;margin:4px 0 10px">${nextGrade ? positionTitle(u.roleId, nextGrade.id) : 'Максимальный грейд'}</div>
        <div class="progress-big"><div style="width:${Math.round(readiness * 100)}%"></div></div>
        <p class="muted">Готовность: <strong style="color:var(--text)">${Math.round(readiness * 100)}%</strong></p>
        <button class="btn" data-goto="map">Открыть карту →</button>
      </div>
    </div>

    <div class="card">
      <h2>Навыки</h2>
      <p class="muted small">Нажмите «+», чтобы отметить прогресс (+3 к навыку, +15 XP).</p>
      <div class="skills-cols">
        <div><h3>Hard</h3>${hardIds.map(skillRow).join('') || '<p class="muted small">Не заданы в критериях</p>'}</div>
        <div><h3>Soft</h3>${softIds.map(skillRow).join('') || '<p class="muted small">Не заданы</p>'}</div>
        <div><h3>Проектные</h3>${projIds.map(skillRow).join('') || '<p class="muted small">Не заданы</p>'}</div>
      </div>
    </div>`;
}

/* ---------- Radar ---------- */
function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildRadarSVG(skillIds, requirementsPerGrade, userSkills, currentGradeId) {
  const N = skillIds.length;
  const size = 560, cx = size/2, cy = size/2;
  const R = 140, labelR = 195;
  const angles = Array.from({ length: N }, (_, i) => (360 / N) * i);

  const rings = [25, 50, 75, 100];
  const ringPolygons = rings.map(pct => {
    const pts = angles.map(a => {
      const p = polarPoint(cx, cy, R * pct / 100, a);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(0,87,255,0.1)"/>`;
  }).join('');
  const axes = angles.map(a => {
    const p = polarPoint(cx, cy, R, a);
    return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(0,87,255,0.12)"/>`;
  }).join('');
  const pctLabels = rings.map(pct => {
    const p = polarPoint(cx, cy, R * pct / 100, 0);
    return `<text x="${(p.x - 6).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" fill="#9CA3AF" font-size="10" text-anchor="end" font-family="Inter,sans-serif">${pct}</text>`;
  }).join('');

  // Показываем максимум 3 первых грейда как ориентиры
  const gradeColors = ['#94A3B8', '#F59E0B', '#10B981'];
  const gradePolygons = requirementsPerGrade.slice(0, 3).map((entry, idx) => {
    const { gradeId, requirements } = entry;
    const values = skillIds.map(id => requirements[id] || 0);
    const pts = values.map((v, i) => {
      const p = polarPoint(cx, cy, R * v / 100, angles[i]);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    const color = gradeColors[idx] || '#64748B';
    const isCurrent = gradeId === currentGradeId;
    return `<polygon points="${pts}" fill="${color}" fill-opacity="${isCurrent ? 0.12 : 0.05}" stroke="${color}" stroke-width="${isCurrent ? 2 : 1.2}" stroke-opacity="${isCurrent ? 0.9 : 0.6}" ${isCurrent ? '' : 'stroke-dasharray="4 3"'}/>`;
  }).join('');

  const userValues = skillIds.map(id => userSkills[id] || 0);
  const userPts = userValues.map((v, i) => {
    const p = polarPoint(cx, cy, R * v / 100, angles[i]);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
  const userDots = userValues.map((v, i) => {
    const p = polarPoint(cx, cy, R * v / 100, angles[i]);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#0057FF" stroke="#FFFFFF" stroke-width="1.5"/>`;
  }).join('');
  const axisLabels = skillIds.map((id, i) => {
    const p = polarPoint(cx, cy, labelR, angles[i]);
    const v = userSkills[id] || 0;
    const name = SKILL_SHORT_NAMES[id] || SKILL_CATALOG[id]?.name || id;
    return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif">
      <tspan x="${p.x.toFixed(1)}" dy="-2" fill="#0057FF" font-size="11" font-weight="700">${name}</tspan>
      <tspan x="${p.x.toFixed(1)}" dy="14" fill="#6B7280" font-size="10">${v}%</tspan>
    </text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" class="radar-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="avatarRadarGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00C2FF"/>
          <stop offset="100%" stop-color="#0057FF"/>
        </radialGradient>
      </defs>
      ${ringPolygons}${axes}${pctLabels}${gradePolygons}
      <polygon points="${userPts}" fill="url(#avatarRadarGrad)" fill-opacity="0.25" stroke="#0057FF" stroke-width="2.5" stroke-linejoin="round"/>
      ${userDots}${axisLabels}
    </svg>`;
}

function renderRadar() {
  const u = getCurrentUser();
  const req = getRequirements(u.roleId, u.gradeId);
  const skillIds = Object.keys(req).filter(id => {
    const g = SKILL_CATALOG[id]?.group;
    return g === (radarMode === 'hard' ? 'Hard' : radarMode === 'soft' ? 'Soft' : 'Project');
  });

  if (!skillIds.length) {
    document.getElementById('radar').innerHTML = `
      <div class="card">
        <div class="panel-head">
          <h2 style="margin:0">Роза навыков</h2>
          <div class="radar-toggle">
            <button class="toggle-btn ${radarMode==='hard'?'active':''}" data-radar-mode="hard">Hard</button>
            <button class="toggle-btn ${radarMode==='soft'?'active':''}" data-radar-mode="soft">Soft</button>
            <button class="toggle-btn ${radarMode==='project'?'active':''}" data-radar-mode="project">Проектные</button>
          </div>
        </div>
        <p class="muted">Критерии для этой группы ещё не заданы администратором.</p>
      </div>`;
    return;
  }

  const sortedGrades = getSortedGrades();
  const requirementsPerGrade = sortedGrades.map(g => ({
    gradeId: g.id,
    gradeName: g.name,
    requirements: getRequirements(u.roleId, g.id),
  }));
  const svg = buildRadarSVG(skillIds, requirementsPerGrade, u.skills, u.gradeId);

  const refGrades = requirementsPerGrade.slice(0, 3);
  const tableRows = skillIds.map(id => {
    const cur = u.skills[id] || 0;
    const name = SKILL_SHORT_NAMES[id] || SKILL_CATALOG[id]?.name || id;
    const cells = refGrades.map(entry => {
      const r = entry.requirements[id] || 0;
      const cls = cur >= r ? 'ok' : 'gap';
      return `<td class="num ${cls}">${r}</td>`;
    }).join('');
    return `<tr><td>${name}</td><td class="num you">${cur}</td>${cells}</tr>`;
  }).join('');

  document.getElementById('radar').innerHTML = `
    <div class="card">
      <div class="panel-head">
        <h2 style="margin:0">Роза навыков</h2>
        <div class="radar-toggle">
          <button class="toggle-btn ${radarMode==='hard'?'active':''}" data-radar-mode="hard">Hard</button>
          <button class="toggle-btn ${radarMode==='soft'?'active':''}" data-radar-mode="soft">Soft</button>
          <button class="toggle-btn ${radarMode==='project'?'active':''}" data-radar-mode="project">Проектные</button>
        </div>
      </div>
      <p class="muted">Ваши навыки и границы грейдов. Позиция: <strong>${positionTitle(u.roleId, u.gradeId)}</strong>.</p>
      <div class="radar-layout">
        <div class="radar-wrap">${svg}</div>
        <div>
          <div class="legend legend-v">
            <span><i class="dot radar-user"></i>Вы</span>
            ${refGrades.map((entry, i) => `<span><i class="dot" style="background:${['#94A3B8','#F59E0B','#10B981'][i] || '#64748B'}"></i>${entry.gradeName}</span>`).join('')}
          </div>
          <table class="radar-table">
            <thead><tr><th>Навык</th><th class="num">Вы</th>${refGrades.map(g => `<th class="num">${g.gradeName.slice(0,1)}</th>`).join('')}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

/* ---------- Map / Career Tree ---------- */
function buildCareerTreeSVG() {
  const u = getCurrentUser();
  const role = getRoleById(u.roleId);
  const grade = getGradeById(u.gradeId);
  const W = 1200, H = 680;
  const NODE_W = 240, NODE_H = 76;
  const centerX = 600, centerY = 420;
  const nodes = [], edges = [];

  const uid = (r, g) => `${r}_${g}`;

  nodes.push({ id: uid(role.id, grade.id), roleId: role.id, gradeId: grade.id, x: centerX, y: centerY, type: 'current', label: 'Вы здесь' });

  const nextGrade = getNextGrade(grade.id);
  if (nextGrade) {
    nodes.push({ id: uid(role.id, nextGrade.id), roleId: role.id, gradeId: nextGrade.id, x: centerX, y: centerY - 140, type: 'next', label: 'Следующий шаг' });
    edges.push({ from: uid(role.id, grade.id), to: uid(role.id, nextGrade.id), type: 'vertical' });
    const nextGrade2 = getNextGrade(nextGrade.id);
    if (nextGrade2) {
      nodes.push({ id: uid(role.id, nextGrade2.id), roleId: role.id, gradeId: nextGrade2.id, x: centerX, y: centerY - 280, type: 'future', label: 'Перспектива' });
      edges.push({ from: uid(role.id, nextGrade.id), to: uid(role.id, nextGrade2.id), type: 'future' });
    }
  }
  const prevGrade = getPrevGrade(grade.id);
  if (prevGrade) {
    nodes.push({ id: uid(role.id, prevGrade.id), roleId: role.id, gradeId: prevGrade.id, x: centerX, y: centerY + 140, type: 'prev', label: 'Пройдено' });
    edges.push({ from: uid(role.id, grade.id), to: uid(role.id, prevGrade.id), type: 'prev' });
  }

  const otherRoles = db.config.roles.filter(r => r.id !== role.id);
  const leftCount = Math.floor(otherRoles.length / 2);
  const sideYs = (count) => {
    if (count === 0) return [];
    if (count === 1) return [centerY];
    const spacing = Math.min(140, 300 / (count - 1));
    const start = centerY - (count - 1) * spacing / 2;
    return Array.from({ length: count }, (_, i) => start + i * spacing);
  };
  const leftYs = sideYs(leftCount);
  const rightYs = sideYs(otherRoles.length - leftCount);
  otherRoles.forEach((r, i) => {
    let x, y;
    if (i < leftCount) { x = 200; y = leftYs[i]; }
    else { x = 1000; y = rightYs[i - leftCount]; }
    nodes.push({ id: uid(r.id, grade.id), roleId: r.id, gradeId: grade.id, x, y, type: 'horiz', label: 'Альтернатива' });
    edges.push({ from: uid(role.id, grade.id), to: uid(r.id, grade.id), type: 'horiz' });
  });

  function edgePoint(cx, cy, w, h, tx, ty) {
    const dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const angle = Math.atan2(dy, dx);
    const tanA = Math.abs(Math.tan(angle));
    let x, y;
    if (tanA <= h / w) { x = cx + Math.sign(dx) * (w/2); y = cy + Math.sign(dx) * (w/2) * Math.tan(angle); }
    else { const cotA = 1 / (tanA || Infinity); x = cx + Math.sign(dy) * (h/2) * cotA; y = cy + Math.sign(dy) * (h/2); }
    return { x, y };
  }

  const edgeSvg = edges.map(e => {
    const fromNode = nodes.find(n => n.id === e.from);
    const toNode = nodes.find(n => n.id === e.to);
    if (!fromNode || !toNode) return '';
    const start = edgePoint(fromNode.x, fromNode.y, NODE_W, NODE_H, toNode.x, toNode.y);
    const end = edgePoint(toNode.x, toNode.y, NODE_W, NODE_H, fromNode.x, fromNode.y);
    let stroke, dash = '', marker;
    if (e.type === 'vertical') { stroke = '#10B981'; marker = 'arrow-green'; }
    else if (e.type === 'horiz') { stroke = '#00C2FF'; marker = 'arrow-blue'; }
    else if (e.type === 'future') { stroke = 'rgba(16,185,129,0.5)'; marker = 'arrow-green-faded'; dash = 'stroke-dasharray="6 4"'; }
    else { stroke = '#9CA3AF'; marker = 'arrow-gray'; }
    return `<line x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" stroke="${stroke}" stroke-width="2" ${dash} marker-end="url(#${marker})"/>`;
  }).join('');

  const nodeSvg = nodes.map(n => {
    const nx = n.x - NODE_W / 2, ny = n.y - NODE_H / 2;
    const r = getRoleById(n.roleId), g = getGradeById(n.gradeId);
    const isTarget = u.targetPositionId === n.id;
    let pctText = n.type === 'current' ? '100%' : n.type === 'prev' ? '' : Math.round(positionReadiness(n.roleId, n.gradeId, u.skills) * 100) + '%';
    const cls = `tree-node ${n.type}${isTarget ? ' target' : ''}`;
    return `
      <g class="${cls}" data-pos="${n.id}" style="cursor:pointer">
        <rect class="tree-node-box" x="${nx}" y="${ny}" width="${NODE_W}" height="${NODE_H}" rx="12"/>
        <text x="${n.x}" y="${n.y - 14}" text-anchor="middle" class="tree-node-title">${r.icon} ${g.name} ${r.name}${isTarget ? ' 🎯' : ''}</text>
        <text x="${n.x}" y="${n.y + 6}" text-anchor="middle" class="tree-node-pct">${pctText}</text>
        <text x="${n.x}" y="${n.y + 24}" text-anchor="middle" class="tree-node-label">${n.label}</text>
      </g>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" class="career-tree-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#10B981"/></marker>
        <marker id="arrow-green-faded" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="rgba(16,185,129,0.5)"/></marker>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#00C2FF"/></marker>
        <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#9CA3AF"/></marker>
      </defs>
      ${edgeSvg}${nodeSvg}
    </svg>`;
}

function renderMap() {
  const u = getCurrentUser();
  const roles = db.config.roles;
  const grades = getSortedGrades().slice().reverse();

  const headCells = roles.map(r => `<div class="cell cell-head">${r.icon} ${escapeHtml(r.name)}</div>`).join('');
  const rows = grades.map(grade => {
    const gradeCell = `<div class="cell cell-grade">${escapeHtml(grade.name)}</div>`;
    const cells = roles.map(role => {
      const readiness = positionReadiness(role.id, grade.id, u.skills);
      const posId = `${role.id}_${grade.id}`;
      const isCurrent = role.id === u.roleId && grade.id === u.gradeId;
      const isTarget = u.targetPositionId === posId;
      const isVertical = role.id === u.roleId && grade.id === getNextGrade(u.gradeId)?.id;
      const isHoriz = role.id !== u.roleId && grade.id === u.gradeId;
      let cls = 'cell cell-pos', label = '';
      if (isCurrent) { cls += ' current'; label = 'Вы здесь'; }
      else if (isVertical) { cls += ' vertical'; label = 'Вертикальный рост'; }
      else if (isHoriz) { cls += ' horizontal'; label = 'Горизонтально'; }
      if (isTarget) { cls += ' target'; label = '🎯 Цель'; }
      return `<div class="${cls}" data-pos="${posId}">
        <div class="pos-pct">${Math.round(readiness * 100)}%</div>
        ${label ? `<div class="pos-label">${label}</div>` : ''}
      </div>`;
    }).join('');
    return gradeCell + cells;
  }).join('');

  document.getElementById('map').innerHTML = `
    <div class="card">
      <div class="panel-head">
        <h2 style="margin:0">Карта движения</h2>
        <div class="legend">
          <span><i class="dot current"></i>Вы</span>
          <span><i class="dot target-dot"></i>Цель</span>
          <span><i class="dot vertical"></i>Вертикальный рост</span>
          <span><i class="dot horizontal"></i>Горизонтальный переход</span>
        </div>
      </div>
      <p class="muted">Кликните на ячейку, чтобы увидеть требования, разрыв в навыках и выбрать цель.</p>
      <div class="map-scroll">
        <div class="map-grid" style="grid-template-columns:110px repeat(${roles.length}, minmax(130px,1fr));">
          <div class="cell cell-head">Грейд</div>
          ${headCells}
          ${rows}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h2 style="margin:0">Дерево переходов</h2>
        <div class="legend">
          <span><i class="dot edge-vertical"></i>Вертикальный рост</span>
          <span><i class="dot edge-horiz"></i>Горизонтальный переход</span>
          <span><i class="dot edge-future"></i>Перспектива</span>
        </div>
      </div>
      <p class="muted">Возможные пути от вашей позиции. Клик на узел — детали.</p>
      <div class="career-tree-wrap">${buildCareerTreeSVG()}</div>
    </div>`;
}

/* ---------- Plan / Scenario ---------- */
const RECOMMENDATION_ICONS = { course: '📚', practice: '🔧', mentor: '🧑‍🏫', feedback: '💬', challenge: '🎤', ownership: '🚀', retro: '🔄' };

function getRecommendationsForGap(gap, group) {
  const list = [];
  if (group === 'Hard') {
    list.push({ type: 'course', text: 'Пройти профильный курс или воркшоп по теме' });
    list.push({ type: gap >= 15 ? 'practice' : 'practice', text: gap >= 15 ? 'Взять 2-3 задачи по теме в ближайших спринтах' : 'Применить навык в текущем проекте' });
    if (gap >= 20) list.push({ type: 'mentor', text: 'Найти ментора или наставника в команде' });
  } else if (group === 'Soft') {
    list.push({ type: 'practice', text: 'Волонтёрить в кросс-командных встречах и митапах' });
    list.push({ type: 'feedback', text: 'Запросить регулярную обратную связь у руководителя' });
    if (gap >= 15) list.push({ type: 'challenge', text: 'Взять роль ведущего на встрече или выступление' });
  } else {
    list.push({ type: 'ownership', text: 'Возглавить небольшую инициативу или проект' });
    list.push({ type: 'retro', text: 'Разбирать ретроспективы проектов с руководителем' });
    if (gap >= 15) list.push({ type: 'practice', text: 'Вести проект под наставничеством опытного коллеги' });
  }
  return list;
}

function generateScenario(currentSkills, roleId, gradeId) {
  const req = getRequirements(roleId, gradeId);
  return Object.entries(req)
    .map(([skillId, required]) => ({
      skillId, name: SKILL_CATALOG[skillId]?.name || skillId,
      group: SKILL_CATALOG[skillId]?.group || 'Hard',
      current: currentSkills[skillId] || 0, required,
      gap: Math.max(0, required - (currentSkills[skillId] || 0)),
    }))
    .filter(g => g.gap > 0)
    .sort((a, b) => b.gap - a.gap);
}

function estimateWeeks(gaps) {
  const totalGap = gaps.reduce((s, g) => s + g.gap, 0);
  return Math.max(2, Math.ceil(totalGap / 15));
}

function getRecommendedTargets() {
  const u = getCurrentUser();
  const candidates = [];
  const nextGrade = getNextGrade(u.gradeId);
  if (nextGrade) candidates.push({ roleId: u.roleId, gradeId: nextGrade.id });
  db.config.roles.forEach(r => {
    if (r.id !== u.roleId) candidates.push({ roleId: r.id, gradeId: u.gradeId });
  });
  return candidates
    .map(c => ({ ...c, readiness: positionReadiness(c.roleId, c.gradeId, u.skills) }))
    .sort((a, b) => b.readiness - a.readiness)
    .slice(0, 3);
}

function renderPlan() {
  const u = getCurrentUser();
  const targetId = u.targetPositionId;
  let target = null;
  if (targetId) {
    const [roleId, gradeId] = targetId.split('_');
    if (getRoleById(roleId) && getGradeById(gradeId)) target = { roleId, gradeId };
  }

  let main;
  if (!target) {
    const recs = getRecommendedTargets();
    main = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">🎯</div>
          <h3>Выберите цель развития</h3>
          <p class="muted">Откройте «Карту роста», кликните на интересующую позицию и выберите её целью. Или выберите из рекомендованных ниже.</p>
        </div>
        <h3 style="margin-top:24px">Рекомендуемые цели</h3>
        <div class="recommend-grid">
          ${recs.map(r => {
            const role = getRoleById(r.roleId);
            return `
              <div class="recommend-card" data-set-target="${r.roleId}_${r.gradeId}">
                <div class="pos-name">${role.icon} ${positionTitle(r.roleId, r.gradeId)}</div>
                <div class="pos-readiness">Готовность: <strong style="color:var(--text)">${Math.round(r.readiness * 100)}%</strong></div>
                <button class="btn btn-primary btn-sm" style="width:100%">Выбрать целью →</button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  } else {
    const readiness = positionReadiness(target.roleId, target.gradeId, u.skills);
    const gaps = generateScenario(u.skills, target.roleId, target.gradeId);
    const weeks = estimateWeeks(gaps);
    const achieved = readiness >= 1;

    const gapsBlock = gaps.length === 0 ? `
      <div class="note-ok">🎉 У вас нет пробелов — вы готовы к переходу!</div>` : `
      <h3 style="margin-top:24px">Что подтянуть</h3>
      ${gaps.slice(0, 10).map((g, i) => {
        const priority = i < 2 ? 1 : i < 4 ? 2 : 3;
        const badgeCls = priority === 1 ? '' : priority === 2 ? 'med' : 'low';
        const recs = getRecommendationsForGap(g.gap, g.group);
        return `
          <div class="gap-card priority-${priority}">
            <div class="gap-card-head">
              <div>
                <div class="gap-card-title">${g.name}</div>
                <div class="gap-card-group">${g.group} · ${g.current} → ${g.required}</div>
              </div>
              <div class="gap-badge ${badgeCls}">-${g.gap} очков</div>
            </div>
            ${recs.map(r => {
              const goalExists = u.goals.some(goal => goal.skill === g.skillId && goal.title.includes(r.text.slice(0, 20)));
              return `
                <div class="action-item">
                  <span class="action-item-icon">${RECOMMENDATION_ICONS[r.type] || '•'}</span>
                  <div class="action-item-content"><div class="action-item-text">${r.text}</div></div>
                  <button class="action-add ${goalExists ? 'added' : ''}" data-add-goal="${g.skillId}" data-goal-title="${escapeHtml(r.text)}">
                    ${goalExists ? '✓ В плане' : '+ В план'}
                  </button>
                </div>`;
            }).join('')}
          </div>`;
      }).join('')}`;

    main = `
      <div class="card">
        <div class="panel-head">
          <div>
            <h2 style="margin:0">Сценарий развития</h2>
            <p class="muted" style="margin:6px 0 0">Цель: <strong style="color:var(--text)">${getRoleById(target.roleId).icon} ${positionTitle(target.roleId, target.gradeId)}</strong></p>
          </div>
          <button class="btn btn-ghost btn-sm" data-clear-target>Сменить цель</button>
        </div>
        <div class="summary-grid">
          <div class="summary-item"><span>Текущая готовность</span><strong>${Math.round(readiness * 100)}%</strong></div>
          <div class="summary-item"><span>Навыков подтянуть</span><strong>${gaps.length}</strong></div>
          <div class="summary-item"><span>Оценка срока</span><strong>${weeks} нед.</strong></div>
        </div>
        ${achieved ? `<div class="note-ok" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <span>🏆 <strong>Цель достигнута!</strong></span>
          <button class="btn btn-primary btn-sm" data-move="${target.roleId}_${target.gradeId}">Перейти на позицию →</button>
        </div>` : ''}
        ${gapsBlock}
      </div>

      <div class="card">
        <h2>Мои цели</h2>
        <p class="muted">Закрытие цели = +XP и +5 к навыку.</p>
        <div class="goals">
          ${u.goals.length === 0 ? '<p class="muted">Пока нет целей. Добавьте из сценария выше.</p>' :
            u.goals.map(g => `
              <div class="goal ${g.completed ? 'done' : ''}">
                <div class="goal-head">
                  <div>
                    <div class="goal-title">${escapeHtml(g.title)}</div>
                    <div class="muted small">Навык: ${SKILL_CATALOG[g.skill]?.name || g.skill} · +${g.xp} XP</div>
                  </div>
                  ${g.completed ? '<span class="badge-done">✓ Готово</span>' : ''}
                </div>
                <div class="goal-progress"><div style="width:${g.progress}%"></div></div>
                ${g.completed ? '' : `<div class="goal-actions">
                  <span class="muted small">${g.progress}%</span>
                  <button class="btn btn-sm" data-goal-add="${g.id}">+25%</button>
                </div>`}
              </div>`).join('')}
        </div>
      </div>`;
  }
  document.getElementById('plan').innerHTML = main;
}

/* ---------- Feed ---------- */
function renderFeed() {
  const u = getCurrentUser();
  document.getElementById('feed').innerHTML = `
    <div class="card">
      <h2>Активность</h2>
      <ul class="feed">
        ${u.activity.length === 0 ? '<li class="muted">Пока нет событий</li>' :
          u.activity.map(a => `<li>
            <span class="feed-icon">${a.icon}</span>
            <div><div>${escapeHtml(a.text)}</div><div class="muted small">${timeAgo(a.time)}</div></div>
          </li>`).join('')}
      </ul>
    </div>`;
}

/* ============================================================
   MODAL + ACTIONS
   ============================================================ */
function openPositionModal(posId) {
  const u = getCurrentUser();
  const [roleId, gradeId] = posId.split('_');
  const role = getRoleById(roleId), grade = getGradeById(gradeId);
  if (!role || !grade) return;
  const readiness = positionReadiness(roleId, gradeId, u.skills);
  const isCurrent = roleId === u.roleId && gradeId === u.gradeId;
  const isTarget = u.targetPositionId === posId;
  const achieved = readiness >= 1;

  const req = getRequirements(roleId, gradeId);
  const gaps = Object.entries(req).map(([skillId, req]) => ({
    name: SKILL_CATALOG[skillId]?.name || skillId,
    req, cur: u.skills[skillId] || 0,
  })).sort((a, b) => (b.req - b.cur) - (a.req - a.cur));

  let actions = '';
  if (isCurrent) actions = `<p class="note">Это ваша текущая позиция.</p>`;
  else if (achieved) actions = `<div class="modal-actions"><button class="btn btn-primary" data-move="${posId}">Перейти на позицию →</button></div>`;
  else if (isTarget) actions = `<p class="note">🎯 Уже выбрана целью.</p><div class="modal-actions"><button class="btn btn-primary" data-goto-plan>Открыть сценарий →</button></div>`;
  else actions = `<div class="modal-actions"><button class="btn btn-primary" data-set-target="${posId}">Выбрать целью развития 🎯</button></div>`;

  document.querySelector('#modal .modal-content').innerHTML = `
    <button class="modal-close">✕</button>
    <div class="modal-head">
      <div class="modal-icon" style="background:${role.color}22;color:${role.color}">${role.icon}</div>
      <div>
        <h3>${escapeHtml(grade.name)} ${escapeHtml(role.name)}</h3>
        <p class="muted small" style="margin:2px 0 0">${role.name} · ${grade.name} (уровень ${grade.level})</p>
      </div>
    </div>
    <div class="readiness-row">
      <div class="progress-big"><div style="width:${Math.round(readiness * 100)}%"></div></div>
      <strong>${Math.round(readiness * 100)}%</strong>
    </div>
    <h3 style="margin-top:18px">Требования и ваши навыки</h3>
    <div class="gap-list">
      ${gaps.length === 0 ? '<p class="muted">Требования для этой позиции ещё не заданы администратором.</p>' :
        gaps.map(g => `
          <div class="gap-row">
            <div>${g.name}</div>
            <div class="gap-bar">
              <div class="gap-cur" style="width:${Math.min(100, g.cur)}%"></div>
              <div class="gap-req" style="left:${g.req}%"></div>
            </div>
            <div class="gap-vals ${g.cur >= g.req ? 'ok' : ''}">${g.cur} / ${g.req}</div>
          </div>`).join('')}
    </div>
    ${actions}`;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

function setTarget(posId) {
  const u = getCurrentUser();
  if (!u) return;
  const [roleId, gradeId] = posId.split('_');
  if (!getRoleById(roleId) || !getGradeById(gradeId)) return;
  if (roleId === u.roleId && gradeId === u.gradeId) return;
  u.targetPositionId = posId;
  u.activity.unshift({ icon: '🎯', text: `Выбрана цель: ${positionTitle(roleId, gradeId)}`, time: Date.now() });
  saveDb();
  closeModal();
  activeTab = 'plan';
  switchTab('plan');
  renderAll();
  toast(`Цель: ${positionTitle(roleId, gradeId)}`);
}

function clearTarget() {
  const u = getCurrentUser();
  if (!u) return;
  u.targetPositionId = null;
  saveDb();
  renderAll();
  toast('Цель сброшена');
}

function moveToPosition(posId) {
  const u = getCurrentUser();
  if (!u) return;
  const [roleId, gradeId] = posId.split('_');
  if (!getRoleById(roleId) || !getGradeById(gradeId)) return;
  u.roleId = roleId;
  u.gradeId = gradeId;
  u.targetPositionId = null;
  u.xp = (u.xp || 0) + 300;
  u.updatedAt = Date.now();
  u.activity.unshift({ icon: '🚀', text: `Переход на позицию: ${positionTitle(roleId, gradeId)}`, time: Date.now() });
  saveDb();
  closeModal();
  renderAll();
  toast(`Поздравляем! Новая позиция: ${positionTitle(roleId, gradeId)}`);
}

function addGoalFromAction(skillId, title) {
  const u = getCurrentUser();
  if (!u) return;
  if (u.goals.some(g => g.skill === skillId && g.title === title)) { toast('Уже в плане'); return; }
  u.goals.push({ id: 'g' + Date.now(), title, skill: skillId, xp: 200, progress: 0, completed: false });
  u.activity.unshift({ icon: '📋', text: `В план: «${title}»`, time: Date.now() });
  saveDb();
  renderAll();
  toast('Добавлено в план');
}

function addGoalProgress(id, amount) {
  const u = getCurrentUser();
  if (!u) return;
  const goal = u.goals.find(g => g.id === id);
  if (!goal || goal.completed) return;
  goal.progress = Math.min(100, goal.progress + amount);
  if (goal.progress >= 100) {
    goal.completed = true;
    u.xp = (u.xp || 0) + goal.xp;
    u.skills[goal.skill] = Math.min(100, (u.skills[goal.skill] || 0) + 5);
    u.activity.unshift({ icon: '✅', text: `Цель достигнута: «${goal.title}» (+${goal.xp} XP)`, time: Date.now() });
    toast(`Цель выполнена! +${goal.xp} XP`);
  }
  saveDb();
  renderAll();
}

function onProfileClick(e) {
  const u = getCurrentUser();
  if (!u) return;
  const skillBtn = e.target.closest('[data-skill-up]');
  if (skillBtn) {
    const id = skillBtn.dataset.skillUp;
    u.skills[id] = Math.min(100, (u.skills[id] || 0) + 3);
    u.xp = (u.xp || 0) + 15;
    u.activity.unshift({ icon: '📈', text: `+3 к навыку: ${SKILL_CATALOG[id].name}`, time: Date.now() });
    saveDb();
    renderAll();
    return;
  }
  const goBtn = e.target.closest('[data-goto]');
  if (goBtn) { activeTab = goBtn.dataset.goto; switchTab(activeTab); return; }
  if (e.target.closest('[data-avatar]')) {
    const idx = AVATARS.indexOf(u.avatar);
    u.avatar = AVATARS[(idx + 1) % AVATARS.length];
    saveDb();
    renderProfile();
  }
}

function onPlanClick(e) {
  const setBtn = e.target.closest('[data-set-target]');
  if (setBtn) { setTarget(setBtn.dataset.setTarget); return; }
  if (e.target.closest('[data-clear-target]')) { clearTarget(); return; }
  const addBtn = e.target.closest('[data-add-goal]');
  if (addBtn) { if (addBtn.classList.contains('added')) return; addGoalFromAction(addBtn.dataset.addGoal, addBtn.dataset.goalTitle); return; }
  const progBtn = e.target.closest('[data-goal-add]');
  if (progBtn) { addGoalProgress(progBtn.dataset.goalAdd, 25); return; }
  const moveBtn = e.target.closest('[data-move]');
  if (moveBtn) { moveToPosition(moveBtn.dataset.move); return; }
}

function onRadarClick(e) {
  const btn = e.target.closest('[data-radar-mode]');
  if (btn) { radarMode = btn.dataset.radarMode; renderRadar(); }
}

function onModalClick(e) {
  if (e.target.id === 'modal' || e.target.closest('.modal-close')) { closeModal(); return; }
  const setBtn = e.target.closest('[data-set-target]');
  if (setBtn) { setTarget(setBtn.dataset.setTarget); return; }
  const moveBtn = e.target.closest('[data-move]');
  if (moveBtn) { moveToPosition(moveBtn.dataset.move); return; }
  if (e.target.closest('[data-goto-plan]')) { closeModal(); activeTab = 'plan'; switchTab('plan'); return; }
}

/* ============================================================
   ROUTER + INIT
   ============================================================ */
function route() {
  const mode = getMode();
  if (mode === 'auth') return showAuth('login');
  if (mode === 'admin') return showAdmin();
  const user = getCurrentUser();
  if (!user) { logout(); return; }
  if (!user.roleId || !user.gradeId) return startWizard(user.id, false);
  showUserApp();
}

function init() {
  db = loadDb();
  session = loadSession();

  // Header
  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Выйти из системы?')) logout();
  });
  document.getElementById('edit-profile-btn').addEventListener('click', () => {
    const uid = getCurrentUserId();
    if (uid) startWizard(uid, true);
  });
  document.querySelectorAll('.tab').forEach(btn =>
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; switchTab(activeTab); })
  );

  // Auth form handlers (делегирование)
  document.getElementById('auth').addEventListener('submit', onAuthSubmit);
  document.getElementById('auth').addEventListener('click', e => {
    const switchBtn = e.target.closest('[data-auth-mode]');
    if (switchBtn) showAuth(switchBtn.dataset.authMode);
  });

  // Wizard
  document.getElementById('onboarding').addEventListener('click', onWizardClick);
  document.getElementById('onboarding').addEventListener('input', onWizardInput);

  // Admin
  document.getElementById('admin').addEventListener('click', onAdminClick);
  document.getElementById('admin').addEventListener('change', onAdminChange);

  // Employee views
  document.getElementById('profile').addEventListener('click', onProfileClick);
  document.getElementById('plan').addEventListener('click', onPlanClick);
  document.getElementById('radar').addEventListener('click', onRadarClick);
  document.getElementById('map').addEventListener('click', e => {
    const cell = e.target.closest('[data-pos]');
    if (cell) openPositionModal(cell.dataset.pos);
  });

  // Modal
  document.getElementById('modal').addEventListener('click', onModalClick);

  // View as exit
  document.addEventListener('click', e => {
    if (e.target.closest('#exit-view-as')) exitViewAs();
  });

  // Esc
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  route();
}

init();
