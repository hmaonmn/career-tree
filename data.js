/* ============================================================
   Career Tree — справочники и дефолты
   ============================================================ */

const ADMIN_CREDENTIALS = { login: 'admin', password: 'admin' };

const SKILL_CATALOG = {
  algorithms:       { name: 'Алгоритмы и структуры данных', group: 'Hard' },
  api_design:       { name: 'Проектирование API',           group: 'Hard' },
  databases:        { name: 'Базы данных',                  group: 'Hard' },
  architecture:     { name: 'Архитектура систем',           group: 'Hard' },
  backend_testing:  { name: 'Тестирование бэкенда',         group: 'Hard' },
  html_css:         { name: 'HTML / CSS',                   group: 'Hard' },
  js_ts:            { name: 'JavaScript / TypeScript',      group: 'Hard' },
  ui_ux:            { name: 'UI / UX',                      group: 'Hard' },
  frontend_perf:    { name: 'Производительность фронтенда', group: 'Hard' },
  accessibility:    { name: 'Доступность (a11y)',           group: 'Hard' },
  sql:              { name: 'SQL',                          group: 'Hard' },
  python:           { name: 'Python',                       group: 'Hard' },
  ml:               { name: 'Машинное обучение',            group: 'Hard' },
  statistics:       { name: 'Статистика',                   group: 'Hard' },
  visualization:    { name: 'Визуализация данных',          group: 'Hard' },
  discovery:        { name: 'Product Discovery',            group: 'Hard' },
  analytics:        { name: 'Продуктовая аналитика',        group: 'Hard' },
  roadmap:          { name: 'Roadmap-планирование',         group: 'Hard' },
  stakeholder:      { name: 'Работа со стейкхолдерами',     group: 'Hard' },
  metrics:          { name: 'Продуктовые метрики',          group: 'Hard' },
  test_design:      { name: 'Тест-дизайн',                  group: 'Hard' },
  automation:       { name: 'Автоматизация тестов',         group: 'Hard' },
  api_testing:      { name: 'API-тестирование',             group: 'Hard' },
  perf_testing:     { name: 'Нагрузочное тестирование',     group: 'Hard' },
  communication:    { name: 'Коммуникация',                 group: 'Soft' },
  ownership:        { name: 'Ownership',                    group: 'Soft' },
  mentoring:        { name: 'Менторство',                   group: 'Soft' },
  teamwork:         { name: 'Командная работа',             group: 'Soft' },
  systems_thinking: { name: 'Системное мышление',           group: 'Soft' },
  project_planning: { name: 'Планирование проектов',        group: 'Project' },
  estimation:       { name: 'Оценка задач и сроков',        group: 'Project' },
  risk_management:  { name: 'Управление рисками',           group: 'Project' },
  requirements:     { name: 'Работа с требованиями',        group: 'Project' },
  delivery:         { name: 'Управление поставкой',         group: 'Project' },
  quality:          { name: 'Контроль качества',            group: 'Project' },
  documentation:    { name: 'Документирование',             group: 'Project' },
};

const SKILL_SHORT_NAMES = {
  algorithms: 'Алгоритмы',     api_design: 'API-дизайн',    databases: 'БД',
  architecture: 'Архитектура', backend_testing: 'Тестирование',
  html_css: 'HTML/CSS',        js_ts: 'JS/TS',              ui_ux: 'UI/UX',
  frontend_perf: 'Performance', accessibility: 'A11y',
  sql: 'SQL',                  python: 'Python',            ml: 'ML',
  statistics: 'Статистика',    visualization: 'Визуализация',
  discovery: 'Discovery',      analytics: 'Аналитика',      roadmap: 'Roadmap',
  stakeholder: 'Стейкхолдеры', metrics: 'Метрики',
  test_design: 'Тест-дизайн',  automation: 'Автотесты',
  api_testing: 'API-тесты',    perf_testing: 'Нагрузка',
  communication: 'Коммуникация', ownership: 'Ownership',    mentoring: 'Менторство',
  teamwork: 'Командность',     systems_thinking: 'Сист. мышление',
  project_planning: 'Планирование', estimation: 'Оценка', risk_management: 'Риски',
  requirements: 'Требования', delivery: 'Delivery', quality: 'Качество',
  documentation: 'Документация',
};

const DEFAULT_ROLES = [
  { id: 'backend',  name: 'Backend',  icon: '⚙️', color: '#0057FF' },
  { id: 'frontend', name: 'Frontend', icon: '🎨', color: '#00C2FF' },
  { id: 'qa',       name: 'QA',       icon: '🔍', color: '#10B981' },
  { id: 'analytic', name: 'Analytic', icon: '📊', color: '#0EA5E9' },
];

const DEFAULT_GRADES = [
  { id: 'junior', name: 'Junior', level: 1 },
  { id: 'middle', name: 'Middle', level: 2 },
  { id: 'senior', name: 'Senior', level: 3 },
];

const ROLE_HARD_SKILLS = {
  backend:  ['algorithms','api_design','databases','architecture','backend_testing'],
  frontend: ['html_css','js_ts','ui_ux','frontend_perf','accessibility'],
  qa:       ['test_design','automation','api_testing','perf_testing'],
  analytic: ['sql','python','ml','statistics','visualization'],
};

const SOFT_SKILLS = ['communication','ownership','mentoring','teamwork','systems_thinking'];
const PROJECT_SKILLS = ['project_planning','estimation','risk_management','requirements','delivery','quality','documentation'];

function allHardSkills() {
  return Object.entries(SKILL_CATALOG).filter(([, v]) => v.group === 'Hard').map(([k]) => k);
}

function defaultLevelForGrade(group, gradeLevel) {
  const lvl = gradeLevel - 1;
  if (group === 'Hard') return Math.min(95, 30 + lvl * 22);
  if (group === 'Soft') return Math.min(92, 35 + lvl * 18);
  return Math.min(90, 30 + lvl * 20);
}

function buildDefaultRequirements(roleId, gradeLevel) {
  const req = {};
  const hard = ROLE_HARD_SKILLS[roleId] || allHardSkills();
  hard.forEach(id => req[id] = defaultLevelForGrade('Hard', gradeLevel));
  SOFT_SKILLS.forEach(id => req[id] = defaultLevelForGrade('Soft', gradeLevel));
  PROJECT_SKILLS.forEach(id => req[id] = defaultLevelForGrade('Project', gradeLevel));
  return req;
}
