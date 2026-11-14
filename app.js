/* ============================================================
   Career Tree — приложение
   ============================================================ */

const STORAGE_KEY = 'career_tree_v1';
const AVATARS = ['🧑‍💻','👩‍💻','👨‍💼','👩‍💼','🦊','🐼','🦉','🚀','🐉','🦄','🧙‍♂️','🧑‍🔬'];

/* ---------- State ---------- */
let app = loadApp();
let wizard = null;
let radarMode = 'hard';
let activeTab = 'profile';

function loadApp() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hasProfile: false, user: null };
    const parsed = JSON.parse(raw);
    if (!parsed.hasProfile || !parsed.user) return { hasProfile: false, user: null };
    return parsed;
  } catch {
    return { hasProfile: false, user: null };
  }
}
function saveApp() { localStorage.setItem(STORAGE_KEY, JSON.stringify(app)); }

const state = () => app.user;
const currentPosition = () => POSITION_BY_ID[state().position];

/* ---------- Helpers ---------- */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function positionReadiness(pos, skills) {
  const entries = Object.entries(pos.requirements);
  if (!entries.length) return 1;
  let sum = 0;
  for (const [skill, req] of entries) sum += Math.min(1, (skills[skill] || 0) / req);
  return sum / entries.length;
}
const avatarLevel = xp => Math.floor(Math.sqrt(xp / 100)) + 1;
const xpForLevel  = lvl => Math.pow(lvl - 1, 2) * 100;

function addXp(amount) {
  const u = state();
  const before = avatarLevel(u.xp);
  u.xp += amount;
  const after = avatarLevel(u.xp);
  if (after > before) {
    toast(`🎉 Новый уровень аватара: ${after}`);
    logActivity(`Аватар достиг уровня ${after}`, '🎉');
  }
}
function logActivity(text, icon = '✨') {
  const u = state();
  u.activity.unshift({ icon, text, time: Date.now() });
  if (u.activity.length > 40) u.activity.length = 40;
}
function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}
let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ============================================================
   WIZARD
   ============================================================ */
function startWizard(edit = false) {
  if (edit && app.user) {
    wizard = {
      step: 1, editing: true,
      draft: {
        name: app.user.name, department: app.user.department,
        trackId: app.user.trackId, gradeId: app.user.gradeId,
        skills: { ...app.user.skills },
      },
    };
  } else {
    const defaultSkills = {};
    Object.keys(SKILL_CATALOG).forEach(id => defaultSkills[id] = 30);
    wizard = {
      step: 1, editing: false,
      draft: { name: '', department: '', trackId: 'backend', gradeId: 'middle', skills: defaultSkills },
    };
  }
  document.getElementById('tabs').style.display = 'none';
  document.getElementById('header-actions').style.display = 'none';
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('onboarding').classList.add('active');
  renderWizard();
}

function renderWizard() {
  const w = wizard;
  let content = '';
  if (w.step === 1) content = wizardStep1();
  else if (w.step === 2) content = wizardStep2();
  else content = wizardStep3();

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
  return `
    <div class="card">
      <h2>Расскажите о себе</h2>
      <p class="muted">Эти данные сформируют вашу базовую страницу.</p>
      <div class="form-grid">
        <label>
          <span>Имя и фамилия *</span>
          <input class="input" data-wizard="name" value="${escapeHtml(d.name)}" placeholder="Иван Петров">
        </label>
        <label>
          <span>Отдел / команда</span>
          <input class="input" data-wizard="department" value="${escapeHtml(d.department)}" placeholder="Платформа">
        </label>
      </div>
      <h3 style="color:var(--text);text-transform:none;letter-spacing:0;font-size:16px">Ваше направление</h3>
      <div class="track-grid">
        ${Object.entries(TRACKS).map(([id, t]) => `
          <button class="track-option ${d.trackId === id ? 'active' : ''}" data-wizard-track="${id}">
            <span class="track-option-icon">${t.icon}</span>
            <span class="track-option-name">${t.name}</span>
          </button>`).join('')}
      </div>
      <h3 style="color:var(--text);text-transform:none;letter-spacing:0;font-size:16px">Ваш грейд</h3>
      <div class="grade-grid">
        ${GRADES.map(g => `
          <button class="grade-option ${d.gradeId === g.id ? 'active' : ''}" data-wizard-grade="${g.id}">${g.name}</button>`).join('')}
      </div>
      <div class="wizard-footer">
        <span></span>
        <button class="btn btn-primary" id="wizard-next">Далее →</button>
      </div>
    </div>`;
}

function wizardStep2() {
  const d = wizard.draft;
  const track = TRACKS[d.trackId];
  const hardIds = Object.keys(track.skills);
  const softIds = Object.keys(SOFT_GRADE_REQUIREMENTS);
  const projectIds = Object.keys(PROJECT_GRADE_REQUIREMENTS);

  const section = (title, subtitle, ids) => `
    <div class="wizard-section">
      <div class="wizard-section-head">
        <div>
          <h3>${title}</h3>
          <p class="muted small" style="margin:0">${subtitle}</p>
        </div>
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
      <p class="muted">Приблизительно отметьте, насколько вы владеете каждым навыком. Значения можно уточнить позже через профиль.</p>
      ${section('Hard skills', `Профессиональные навыки · ${track.name}`, hardIds)}
      ${section('Soft skills', 'Универсальные навыки', softIds)}
      ${section('Проектные навыки', 'Опыт участия и ведения проектов', projectIds)}
      <div class="wizard-footer">
        <button class="btn" id="wizard-back">← Назад</button>
        <button class="btn btn-primary" id="wizard-next">Далее →</button>
      </div>
    </div>`;
}

function wizardStep3() {
  const d = wizard.draft;
  const track = TRACKS[d.trackId];
  const grade = GRADES.find(g => g.id === d.gradeId);
  const pos = POSITION_BY_ID[`${d.trackId}_${d.gradeId}`];
  const nextGrade = GRADES.find(g => g.level === grade.level + 1);
  const nextPos = nextGrade ? POSITION_BY_ID[`${d.trackId}_${nextGrade.id}`] : null;
  const nextReadiness = nextPos ? positionReadiness(nextPos, d.skills) : 0;

  return `
    <div class="card">
      <h2>Всё готово!</h2>
      <p class="muted">Проверьте данные и создайте профиль.</p>
      <div class="review-grid">
        <div class="review-item">
          <span class="muted small">Имя</span>
          <strong>${escapeHtml(d.name) || '—'}</strong>
        </div>
        <div class="review-item">
          <span class="muted small">Отдел</span>
          <strong>${escapeHtml(d.department) || '—'}</strong>
        </div>
        <div class="review-item">
          <span class="muted small">Направление</span>
          <strong>${track.icon} ${track.name}</strong>
        </div>
        <div class="review-item">
          <span class="muted small">Грейд</span>
          <strong>${grade.name}</strong>
        </div>
      </div>
      <div class="card-inner">
        <h3 style="color:var(--text);text-transform:none;letter-spacing:0;font-size:15px;margin-bottom:6px">Ваша стартовая позиция</h3>
        <div class="pos-big">${pos.title}</div>
        <p class="muted" style="margin:0">${pos.description}</p>
        ${nextPos ? `<p class="muted" style="margin-top:12px">Готовность к следующей ступени (${nextPos.title}): <strong style="color:var(--text)">${Math.round(nextReadiness * 100)}%</strong></p>` : ''}
      </div>
      <div class="wizard-footer">
        <button class="btn" id="wizard-back">← Назад</button>
        <button class="btn btn-primary" id="wizard-finish">${wizard.editing ? 'Сохранить' : 'Создать профиль'}</button>
      </div>
    </div>`;
}

function onWizardInput(e) {
  const nameInput = e.target.closest('[data-wizard]');
  if (nameInput) {
    wizard.draft[nameInput.dataset.wizard] = nameInput.value;
  }
  const slider = e.target.closest('[data-slider-skill]');
  if (slider) {
    const id = slider.dataset.sliderSkill;
    wizard.draft.skills[id] = +slider.value;
    const val = document.getElementById('val-' + id);
    if (val) val.textContent = slider.value;
  }
}

function onWizardClick(e) {
  const trackBtn = e.target.closest('[data-wizard-track]');
  if (trackBtn) {
    wizard.draft.trackId = trackBtn.dataset.wizardTrack;
    renderWizard();
    return;
  }
  const gradeBtn = e.target.closest('[data-wizard-grade]');
  if (gradeBtn) {
    wizard.draft.gradeId = gradeBtn.dataset.wizardGrade;
    renderWizard();
    return;
  }
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
    if (!wizard) { toast('Сессия истекла, начните заново'); return; }
    if (wizard.step === 1 && !wizard.draft.name.trim()) { toast('Введите имя'); return; }
    if (wizard.step < 3) { wizard.step++; renderWizard(); }
    return;
  }

  const backBtn = e.target.closest('#wizard-back');
  if (backBtn) {
    if (wizard && wizard.step > 1) { wizard.step--; renderWizard(); }
    return;
  }

  const finishBtn = e.target.closest('#wizard-finish');
  if (finishBtn) {
    if (!wizard) { toast('Сессия истекла, начните заново'); return; }
    finishBtn.disabled = true;
    finishBtn.textContent = 'Сохраняем…';
    try {
      finishWizard();
    } catch (err) {
      console.error('finishWizard error:', err);
      toast('Ошибка: ' + err.message);
      finishBtn.disabled = false;
      finishBtn.textContent = wizard.editing ? 'Сохранить' : 'Создать профиль';
    }
    return;
  }
}

function finishWizard() {
  const d = wizard.draft;
  const editing = wizard.editing;

  if (editing) {
    const u = app.user;
    u.name = d.name.trim();
    u.department = d.department.trim();
    u.trackId = d.trackId;
    u.gradeId = d.gradeId;
    u.position = `${d.trackId}_${d.gradeId}`;
    u.skills = { ...d.skills };
    logActivity('Профиль обновлён', '✎');
  } else {
    const pos = POSITION_BY_ID[`${d.trackId}_${d.gradeId}`];
    app = {
      hasProfile: true,
      user: {
        name: d.name.trim(),
        department: d.department.trim(),
        trackId: d.trackId,
        gradeId: d.gradeId,
        position: `${d.trackId}_${d.gradeId}`,
        role: pos.title,
        avatar: '🧑‍💻',
        xp: 100,
        skills: { ...d.skills },
        goals: [],
        targetPositionId: null,
        activity: [{ icon: '🏁', text: 'Профиль создан в Career Tree', time: Date.now() }],
      },
    };
  }
  saveApp();
  wizard = null;
  activeTab = 'profile';
  showMain();
  toast(editing ? 'Профиль обновлён' : 'Профиль создан!');
}

/* ============================================================
   MAIN APP
   ============================================================ */
function showMain() {
  document.getElementById('onboarding').classList.remove('active');
  document.getElementById('tabs').style.display = 'flex';
  document.getElementById('header-actions').style.display = 'flex';
  renderAll();
  switchTab(activeTab);
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tab));
}

function renderAll() {
  renderProfile();
  renderRadar();
  renderMap();
  renderPlan();
  renderFeed();
}

/* ---------- Profile ---------- */
function renderProfile() {
  const u = state();
  const pos = currentPosition();
  const track = TRACKS[pos.trackId];
  const grade = GRADES.find(g => g.id === pos.gradeId);
  const nextGrade = GRADES.find(g => g.level === grade.level + 1);
  const nextPos = nextGrade ? POSITION_BY_ID[`${pos.trackId}_${nextGrade.id}`] : null;
  const readiness = nextPos ? positionReadiness(nextPos, u.skills) : 1;
  const lvl = avatarLevel(u.xp);
  const curLvlXp = xpForLevel(lvl);
  const nxtXp = xpForLevel(lvl + 1);
  const levelPct = Math.round(((u.xp - curLvlXp) / (nxtXp - curLvlXp)) * 100);

  const skillRow = ([id, meta]) => {
    const val = u.skills[id] || 0;
    return `
      <div class="skill-row">
        <div>${meta.name}</div>
        <div class="skill-bar"><div class="skill-fill" style="width:${val}%"></div></div>
        <div class="skill-val">${val}</div>
        <button class="icon-btn" data-skill-up="${id}" title="+3">+</button>
      </div>`;
  };
  const hard = Object.entries(SKILL_CATALOG).filter(([, s]) => s.group === 'Hard');
  const soft = Object.entries(SKILL_CATALOG).filter(([, s]) => s.group === 'Soft');
  const project = Object.entries(SKILL_CATALOG).filter(([, s]) => s.group === 'Project');

  const targetPos = u.targetPositionId ? POSITION_BY_ID[u.targetPositionId] : null;

  document.getElementById('profile').innerHTML = `
    <div class="hero card">
      <div class="avatar-wrap">
        <div class="avatar" data-avatar title="Сменить аватар">${u.avatar}</div>
        <div class="level-badge">Ур. ${lvl}</div>
      </div>
      <div class="hero-info">
        <h2>${escapeHtml(u.name)}</h2>
        <p class="muted" style="margin:0">${escapeHtml(u.department) || '—'} · ${escapeHtml(u.role)}</p>
        <div class="chips">
          <span class="chip chip-grade">${grade.name} · ${track.name}</span>
          <span class="chip">${u.xp} XP</span>
          ${targetPos ? `<span class="chip chip-target">🎯 ${targetPos.title}</span>` : ''}
        </div>
        <div class="skill-bar" style="height:8px;margin-top:12px;background:var(--bg-2)">
          <div style="height:100%;width:${levelPct}%;background:linear-gradient(90deg,var(--biv-blue),var(--biv-cyan));border-radius:999px"></div>
        </div>
        <p class="muted small" style="margin:6px 0 0">${u.xp - curLvlXp} / ${nxtXp - curLvlXp} XP до уровня ${lvl + 1}</p>
      </div>
    </div>

    <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px">
      <div class="card">
        <h3>Текущая позиция</h3>
        <div class="pos-big" style="font-size:20px;font-weight:800;margin:4px 0 10px">${pos.title}</div>
        <p class="muted">${pos.description}</p>
      </div>
      <div class="card">
        <h3>Следующая ступень</h3>
        <div class="pos-big" style="font-size:20px;font-weight:800;margin:4px 0 10px">${nextPos ? nextPos.title : 'Максимальный грейд'}</div>
        <div class="progress-big"><div style="width:${Math.round(readiness * 100)}%"></div></div>
        <p class="muted">Готовность: <strong style="color:var(--text)">${Math.round(readiness * 100)}%</strong></p>
        <button class="btn" data-goto="map">Открыть карту →</button>
      </div>
    </div>

    <div class="card">
      <h2>Навыки</h2>
      <p class="muted small">Нажмите «+», чтобы отметить прогресс (+3 к навыку, +15 XP).</p>
      <div class="skills-cols">
        <div><h3>Hard</h3>${hard.map(skillRow).join('')}</div>
        <div><h3>Soft</h3>${soft.map(skillRow).join('')}</div>
        <div><h3>Проектные</h3>${project.map(skillRow).join('')}</div>
      </div>
    </div>`;
}

/* ---------- Radar ---------- */
function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildRadarSVG(skillIds, requirements, userSkills, currentGradeLevel) {
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
    return `<polygon points="${pts}" fill="none" stroke="rgba(0,87,255,0.1)" stroke-width="1"/>`;
  }).join('');

  const axes = angles.map(a => {
    const p = polarPoint(cx, cy, R, a);
    return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(0,87,255,0.12)"/>`;
  }).join('');

  const pctLabels = rings.map(pct => {
    const p = polarPoint(cx, cy, R * pct / 100, 0);
    return `<text x="${(p.x - 6).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" fill="#9CA3AF" font-size="10" text-anchor="end" font-family="Inter,sans-serif">${pct}</text>`;
  }).join('');

  const gradeMeta = [
    { level: 1, color: '#94A3B8' },
    { level: 2, color: '#F59E0B' },
    { level: 3, color: '#10B981' },
  ];
  const gradePolygons = gradeMeta.map(({ level, color }) => {
    const values = skillIds.map(id => requirements[id]?.[level - 1] || 0);
    const pts = values.map((v, i) => {
      const p = polarPoint(cx, cy, R * v / 100, angles[i]);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    const isCurrent = level === currentGradeLevel;
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
  const u = state();
  const pos = currentPosition();
  const track = TRACKS[pos.trackId];
  const isHard = radarMode === 'hard', isSoft = radarMode === 'soft', isProj = radarMode === 'project';
  const skillIds = isHard ? Object.keys(track.skills) : isSoft ? Object.keys(SOFT_GRADE_REQUIREMENTS) : Object.keys(PROJECT_GRADE_REQUIREMENTS);
  const requirements = isHard ? track.skills : isSoft ? SOFT_GRADE_REQUIREMENTS : PROJECT_GRADE_REQUIREMENTS;

  const svg = buildRadarSVG(skillIds, requirements, u.skills, pos.gradeLevel);

  const labels = ['Junior', 'Middle', 'Senior'];
  const tableRows = skillIds.map(id => {
    const cur = u.skills[id] || 0;
    const name = SKILL_SHORT_NAMES[id] || SKILL_CATALOG[id]?.name || id;
    const cells = labels.map((_, i) => {
      const req = requirements[id]?.[i] || 0;
      const cls = cur >= req ? 'ok' : 'gap';
      return `<td class="num ${cls}">${req}</td>`;
    }).join('');
    return `<tr><td>${name}</td><td class="num you">${cur}</td>${cells}</tr>`;
  }).join('');

  document.getElementById('radar').innerHTML = `
    <div class="card">
      <div class="panel-head">
        <h2 style="margin:0">Роза навыков</h2>
        <div class="radar-toggle">
          <button class="toggle-btn ${isHard ? 'active' : ''}" data-radar-mode="hard">Hard</button>
          <button class="toggle-btn ${isSoft ? 'active' : ''}" data-radar-mode="soft">Soft</button>
          <button class="toggle-btn ${isProj ? 'active' : ''}" data-radar-mode="project">Проектные</button>
        </div>
      </div>
      <p class="muted">Ваши навыки${isHard ? ` (${track.name})` : isSoft ? ' (универсальные)' : ' (проектные)'} и границы грейдов. Позиция: <strong style="color:var(--text)">${pos.title}</strong>.</p>
      <div class="radar-layout">
        <div class="radar-wrap">${svg}</div>
        <div>
          <div class="legend legend-v">
            <span><i class="dot radar-user"></i>Вы</span>
            <span><i class="dot radar-junior"></i>Junior</span>
            <span><i class="dot radar-middle"></i>Middle</span>
            <span><i class="dot radar-senior"></i>Senior</span>
          </div>
          <table class="radar-table">
            <thead><tr><th>Навык</th><th class="num">Вы</th><th class="num">J</th><th class="num">M</th><th class="num">S</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

/* ---------- Map ---------- */
function buildCareerTreeSVG() {
  const u = state();
  const pos = currentPosition();
  const grade = GRADES.find(g => g.id === pos.gradeId);

  const W = 1200, H = 680;
  const NODE_W = 240, NODE_H = 76;
  const centerX = 600, centerY = 420;

  const nodes = [];
  const edges = [];
  nodes.push({ id: pos.id, pos, x: centerX, y: centerY, type: 'current', label: 'Вы здесь' });

  const nextGrade = GRADES.find(g => g.level === grade.level + 1);
  const nextPos = nextGrade ? POSITION_BY_ID[`${pos.trackId}_${nextGrade.id}`] : null;
  if (nextPos) {
    nodes.push({ id: nextPos.id, pos: nextPos, x: centerX, y: centerY - 140, type: 'next', label: 'Следующий шаг' });
    edges.push({ from: pos.id, to: nextPos.id, type: 'vertical' });
  }
  const nextGrade2 = GRADES.find(g => g.level === grade.level + 2);
  const nextPos2 = nextGrade2 ? POSITION_BY_ID[`${pos.trackId}_${nextGrade2.id}`] : null;
  if (nextPos2 && nextPos) {
    nodes.push({ id: nextPos2.id, pos: nextPos2, x: centerX, y: centerY - 280, type: 'future', label: 'Перспектива' });
    edges.push({ from: nextPos.id, to: nextPos2.id, type: 'future' });
  }
  const prevGrade = GRADES.find(g => g.level === grade.level - 1);
  const prevPos = prevGrade ? POSITION_BY_ID[`${pos.trackId}_${prevGrade.id}`] : null;
  if (prevPos) {
    nodes.push({ id: prevPos.id, pos: prevPos, x: centerX, y: centerY + 140, type: 'prev', label: 'Пройдено' });
    edges.push({ from: pos.id, to: prevPos.id, type: 'prev' });
  }

  const otherTracks = Object.entries(TRACKS).filter(([id]) => id !== pos.trackId);
  const leftCount = Math.floor(otherTracks.length / 2);
  const rightCount = otherTracks.length - leftCount;
  const sideYs = (count) => {
    if (count === 0) return [];
    if (count === 1) return [centerY];
    const spacing = Math.min(140, 300 / (count - 1));
    const total = (count - 1) * spacing;
    const start = centerY - total / 2;
    return Array.from({ length: count }, (_, i) => start + i * spacing);
  };
  const leftYs = sideYs(leftCount);
  const rightYs = sideYs(rightCount);
  otherTracks.forEach(([trackId], i) => {
    const horizPos = POSITION_BY_ID[`${trackId}_${grade.id}`];
    let x, y;
    if (i < leftCount) { x = 200; y = leftYs[i]; }
    else { x = 1000; y = rightYs[i - leftCount]; }
    nodes.push({ id: horizPos.id, pos: horizPos, x, y, type: 'horiz', label: 'Альтернатива' });
    edges.push({ from: pos.id, to: horizPos.id, type: 'horiz' });
  });

  function edgePoint(cx, cy, w, h, tx, ty) {
    const dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const angle = Math.atan2(dy, dx);
    const tanA = Math.abs(Math.tan(angle));
    let x, y;
    if (tanA <= h / w) {
      x = cx + Math.sign(dx) * (w / 2);
      y = cy + Math.sign(dx) * (w / 2) * Math.tan(angle);
    } else {
      const cotA = 1 / (tanA || Infinity);
      x = cx + Math.sign(dy) * (h / 2) * cotA;
      y = cy + Math.sign(dy) * (h / 2);
    }
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
    const t = TRACKS[n.pos.trackId];
    const g = GRADES.find(gr => gr.id === n.pos.gradeId);
    const isTarget = u.targetPositionId === n.id;
    let pctText = '';
    if (n.type === 'current') pctText = '100%';
    else if (n.type !== 'prev') pctText = Math.round(positionReadiness(n.pos, u.skills) * 100) + '%';
    const cls = `tree-node ${n.type}${isTarget ? ' target' : ''}`;
    return `
      <g class="${cls}" data-pos="${n.id}" style="cursor:pointer">
        <rect class="tree-node-box" x="${nx}" y="${ny}" width="${NODE_W}" height="${NODE_H}" rx="12"/>
        <text x="${n.x}" y="${n.y - 14}" text-anchor="middle" class="tree-node-title">${t.icon} ${g.name} ${t.name}${isTarget ? ' 🎯' : ''}</text>
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
  const u = state();
  const curPos = currentPosition();
  const tracks = Object.entries(TRACKS);

  const headCells = tracks.map(([, t]) => `<div class="cell cell-head">${t.icon} ${t.name}</div>`).join('');

  const rows = [...GRADES].reverse().map(grade => {
    const gradeCell = `<div class="cell cell-grade">${grade.name}</div>`;
    const cells = tracks.map(([trackId]) => {
      const pos = POSITION_BY_ID[`${trackId}_${grade.id}`];
      const readiness = positionReadiness(pos, u.skills);
      const isCurrent = pos.id === u.position;
      const isTarget = u.targetPositionId === pos.id;
      const isVertical = trackId === curPos.trackId && grade.level === curPos.gradeLevel + 1;
      const isHoriz = trackId !== curPos.trackId && grade.level === curPos.gradeLevel;

      let cls = 'cell cell-pos';
      let label = '';
      if (isCurrent) { cls += ' current'; label = 'Вы здесь'; }
      else if (isVertical) { cls += ' vertical'; label = 'Вертикальный рост'; }
      else if (isHoriz) { cls += ' horizontal'; label = 'Горизонтально'; }
      if (isTarget) { cls += ' target'; label = '🎯 Цель'; }

      return `<div class="${cls}" data-pos="${pos.id}">
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
      <p class="muted">Кликните на ячейку, чтобы увидеть требования, разрыв в навыках и выбрать цель развития.</p>
      <div class="map-scroll">
        <div class="map-grid" style="grid-template-columns:110px repeat(${tracks.length}, minmax(130px,1fr));">
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
    if (gap >= 15) list.push({ type: 'practice', text: 'Взять 2-3 задачи по теме в ближайших спринтах' });
    else list.push({ type: 'practice', text: 'Применить навык в текущем проекте' });
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

function generateScenario(currentSkills, targetPos) {
  return Object.entries(targetPos.requirements)
    .map(([skillId, req]) => ({
      skillId,
      name: SKILL_CATALOG[skillId]?.name || skillId,
      group: SKILL_CATALOG[skillId]?.group || 'Hard',
      current: currentSkills[skillId] || 0,
      required: req,
      gap: Math.max(0, req - (currentSkills[skillId] || 0)),
    }))
    .filter(g => g.gap > 0)
    .sort((a, b) => b.gap - a.gap);
}

function estimateWeeks(gaps) {
  const totalGap = gaps.reduce((s, g) => s + g.gap, 0);
  return Math.max(2, Math.ceil(totalGap / 15));
}

function getRecommendedTargets() {
  const u = state();
  const pos = currentPosition();
  const grade = GRADES.find(g => g.id === pos.gradeId);
  const candidates = [];
  const nextGrade = GRADES.find(g => g.level === grade.level + 1);
  if (nextGrade) candidates.push(POSITION_BY_ID[`${pos.trackId}_${nextGrade.id}`]);
  Object.keys(TRACKS).forEach(tid => {
    if (tid !== pos.trackId) candidates.push(POSITION_BY_ID[`${tid}_${pos.gradeId}`]);
  });
  return candidates
    .filter(Boolean)
    .map(p => ({ pos: p, readiness: positionReadiness(p, u.skills) }))
    .sort((a, b) => b.readiness - a.readiness)
    .slice(0, 3);
}

function renderPlan() {
  const u = state();
  const targetId = u.targetPositionId;
  const target = targetId ? POSITION_BY_ID[targetId] : null;

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
          ${recs.map(r => `
            <div class="recommend-card" data-set-target="${r.pos.id}">
              <div class="pos-name">${TRACKS[r.pos.trackId].icon} ${r.pos.title}</div>
              <div class="pos-readiness">Готовность: <strong style="color:var(--text)">${Math.round(r.readiness * 100)}%</strong></div>
              <button class="btn btn-primary btn-sm" style="width:100%">Выбрать целью →</button>
            </div>`).join('')}
        </div>
      </div>`;
  } else {
    const readiness = positionReadiness(target, u.skills);
    const gaps = generateScenario(u.skills, target);
    const weeks = estimateWeeks(gaps);
    const achieved = readiness >= 1;

    const summary = `
      <div class="summary-grid">
        <div class="summary-item">
          <span>Текущая готовность</span>
          <strong>${Math.round(readiness * 100)}%</strong>
        </div>
        <div class="summary-item">
          <span>Навыков подтянуть</span>
          <strong>${gaps.length}</strong>
        </div>
        <div class="summary-item">
          <span>Оценка срока</span>
          <strong>${weeks} нед.</strong>
        </div>
      </div>`;

    const achievedBlock = achieved ? `
      <div class="note-ok" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <span>🏆 <strong>Цель достигнута!</strong> Все требования выполнены.</span>
        <button class="btn btn-primary btn-sm" data-move="${target.id}">Перейти на позицию →</button>
      </div>` : '';

    const gapsBlock = gaps.length === 0 ? `
      <div class="note-ok">🎉 У вас нет пробелов по требуемым навыкам — вы готовы к переходу!</div>` : `
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
              const goalExists = u.goals.some(goal => goal.skill === g.skillId && goal.title.includes(r.text.split(' ').slice(0, 3).join(' ')));
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
            <p class="muted" style="margin:6px 0 0">Цель: <strong style="color:var(--text)">${TRACKS[target.trackId].icon} ${target.title}</strong></p>
          </div>
          <button class="btn btn-ghost btn-sm" data-clear-target>Сменить цель</button>
        </div>
        ${summary}
        ${achievedBlock}
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
                ${g.completed ? '' : `
                  <div class="goal-actions">
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
  const u = state();
  document.getElementById('feed').innerHTML = `
    <div class="card">
      <h2>Активность</h2>
      <ul class="feed">
        ${u.activity.length === 0 ? '<li class="muted">Пока нет событий</li>' :
          u.activity.map(a => `
            <li>
              <span class="feed-icon">${a.icon}</span>
              <div>
                <div>${escapeHtml(a.text)}</div>
                <div class="muted small">${timeAgo(a.time)}</div>
              </div>
            </li>`).join('')}
      </ul>
    </div>`;
}

/* ============================================================
   MODAL
   ============================================================ */
function openPositionModal(posId) {
  const u = state();
  const pos = POSITION_BY_ID[posId];
  if (!pos) return;
  const track = TRACKS[pos.trackId];
  const grade = GRADES.find(g => g.id === pos.gradeId);
  const readiness = positionReadiness(pos, u.skills);
  const isCurrent = pos.id === u.position;
  const isTarget = u.targetPositionId === pos.id;
  const achieved = readiness >= 1;

  const gaps = Object.entries(pos.requirements)
    .map(([skillId, req]) => ({
      name: SKILL_CATALOG[skillId].name,
      req, cur: u.skills[skillId] || 0,
    }))
    .sort((a, b) => (b.req - b.cur) - (a.req - a.cur));

  let actions = '';
  if (isCurrent) {
    actions = `<p class="note">Это ваша текущая позиция.</p>`;
  } else if (achieved) {
    actions = `<div class="modal-actions"><button class="btn btn-primary" data-move="${pos.id}">Перейти на позицию →</button></div>`;
  } else if (isTarget) {
    actions = `
      <p class="note">🎯 Эта позиция уже выбрана целью развития.</p>
      <div class="modal-actions"><button class="btn btn-primary" data-goto-plan>Открыть сценарий →</button></div>`;
  } else {
    actions = `<div class="modal-actions"><button class="btn btn-primary" data-set-target="${pos.id}">Выбрать целью развития 🎯</button></div>`;
  }

  document.querySelector('#modal .modal-content').innerHTML = `
    <button class="modal-close">✕</button>
    <div class="modal-head">
      <div class="modal-icon" style="background:${track.color}22;color:${track.color}">${track.icon}</div>
      <div>
        <h3>${pos.title}</h3>
        <p class="muted small" style="margin:2px 0 0">${track.name} · ${grade.name}</p>
      </div>
    </div>
    <p class="muted">${pos.description}</p>
    <div class="readiness-row">
      <div class="progress-big"><div style="width:${Math.round(readiness * 100)}%"></div></div>
      <strong>${Math.round(readiness * 100)}%</strong>
    </div>
    <h3 style="margin-top:18px">Требования и ваши навыки</h3>
    <div class="gap-list">
      ${gaps.map(g => `
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

/* ============================================================
   ACTIONS
   ============================================================ */
function setTarget(posId) {
  const u = state();
  const pos = POSITION_BY_ID[posId];
  if (!pos || posId === u.position) return;
  u.targetPositionId = posId;
  logActivity(`Выбрана цель развития: ${pos.title}`, '🎯');
  saveApp();
  closeModal();
  activeTab = 'plan';
  switchTab('plan');
  renderAll();
  toast(`Цель: ${pos.title}`);
}

function clearTarget() {
  const u = state();
  u.targetPositionId = null;
  saveApp();
  renderAll();
  toast('Цель сброшена');
}

function moveToPosition(posId) {
  const u = state();
  const pos = POSITION_BY_ID[posId];
  if (!pos) return;
  u.position = posId;
  u.trackId = pos.trackId;
  u.gradeId = pos.gradeId;
  u.role = pos.title;
  u.targetPositionId = null;
  addXp(300);
  logActivity(`Переход на позицию: ${pos.title}`, '🚀');
  saveApp();
  closeModal();
  renderAll();
  toast(`Поздравляем! Новая позиция: ${pos.title}`);
}

function addGoalFromAction(skillId, title) {
  const u = state();
  const exists = u.goals.some(g => g.skill === skillId && g.title === title);
  if (exists) { toast('Уже в плане'); return; }
  u.goals.push({ id: 'g' + Date.now(), title, skill: skillId, xp: 200, progress: 0, completed: false });
  logActivity(`В план добавлено: «${title}»`, '📋');
  saveApp();
  renderAll();
  toast('Добавлено в план развития');
}

function addGoalProgress(id, amount) {
  const u = state();
  const goal = u.goals.find(g => g.id === id);
  if (!goal || goal.completed) return;
  goal.progress = Math.min(100, goal.progress + amount);
  if (goal.progress >= 100) {
    goal.completed = true;
    addXp(goal.xp);
    u.skills[goal.skill] = Math.min(100, (u.skills[goal.skill] || 0) + 5);
    logActivity(`Цель достигнута: «${goal.title}» (+${goal.xp} XP)`, '✅');
    toast(`Цель выполнена! +${goal.xp} XP`);
  }
  saveApp();
  renderAll();
}

/* ============================================================
   HANDLERS
   ============================================================ */
function onProfileClick(e) {
  const u = state();
  const skillBtn = e.target.closest('[data-skill-up]');
  if (skillBtn) {
    const id = skillBtn.dataset.skillUp;
    u.skills[id] = Math.min(100, (u.skills[id] || 0) + 3);
    addXp(15);
    logActivity(`+3 к навыку: ${SKILL_CATALOG[id].name}`, '📈');
    saveApp();
    renderAll();
    return;
  }
  const goBtn = e.target.closest('[data-goto]');
  if (goBtn) { activeTab = goBtn.dataset.goto; switchTab(activeTab); return; }
  if (e.target.closest('[data-avatar]')) {
    const u2 = state();
    const idx = AVATARS.indexOf(u2.avatar);
    u2.avatar = AVATARS[(idx + 1) % AVATARS.length];
    saveApp();
    renderProfile();
  }
}

function onPlanClick(e) {
  const setBtn = e.target.closest('[data-set-target]');
  if (setBtn) { setTarget(setBtn.dataset.setTarget); return; }
  if (e.target.closest('[data-clear-target]')) { clearTarget(); return; }
  const addBtn = e.target.closest('[data-add-goal]');
  if (addBtn) {
    if (addBtn.classList.contains('added')) return;
    addGoalFromAction(addBtn.dataset.addGoal, addBtn.dataset.goalTitle);
    return;
  }
  const progBtn = e.target.closest('[data-goal-add]');
  if (progBtn) { addGoalProgress(progBtn.dataset.goalAdd, 25); return; }
  const moveBtn = e.target.closest('[data-move]');
  if (moveBtn) { moveToPosition(moveBtn.dataset.move); return; }
}

function onRadarClick(e) {
  const btn = e.target.closest('[data-radar-mode]');
  if (btn) {
    radarMode = btn.dataset.radarMode;
    renderRadar();
  }
}

function onModalClick(e) {
  if (e.target.id === 'modal' || e.target.closest('.modal-close')) { closeModal(); return; }
  const setBtn = e.target.closest('[data-set-target]');
  if (setBtn) { setTarget(setBtn.dataset.setTarget); return; }
  const moveBtn = e.target.closest('[data-move]');
  if (moveBtn) { moveToPosition(moveBtn.dataset.move); return; }
  if (e.target.closest('[data-goto-plan]')) {
    closeModal();
    activeTab = 'plan';
    switchTab('plan');
    return;
  }
}

function resetAll() {
  if (!confirm('Сбросить профиль? Все данные будут удалены.')) return;
  localStorage.removeItem(STORAGE_KEY);
  app = { hasProfile: false, user: null };
  wizard = null;
  activeTab = 'profile';
  startWizard();
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  document.querySelectorAll('.tab').forEach(btn =>
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; switchTab(activeTab); })
  );
  document.getElementById('edit-profile-btn').addEventListener('click', () => startWizard(true));
  document.getElementById('reset-btn').addEventListener('click', resetAll);

  document.getElementById('onboarding').addEventListener('click', onWizardClick);
  document.getElementById('onboarding').addEventListener('input', onWizardInput);
  document.getElementById('profile').addEventListener('click', onProfileClick);
  document.getElementById('plan').addEventListener('click', onPlanClick);
  document.getElementById('radar').addEventListener('click', onRadarClick);
  document.getElementById('map').addEventListener('click', e => {
    const cell = e.target.closest('[data-pos]');
    if (cell) openPositionModal(cell.dataset.pos);
  });
  document.getElementById('modal').addEventListener('click', onModalClick);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  if (app.hasProfile && app.user) {
    showMain();
  } else {
    startWizard();
  }
}

init();
