'use strict';

let SQL = null;
let db = null;

const SC = {
  Abjuration: 'sc-Abjuration',
  Conjuration: 'sc-Conjuration',
  Divination: 'sc-Divination',
  Enchantment: 'sc-Enchantment',
  Evocation: 'sc-Evocation',
  Illusion: 'sc-Illusion',
  Necromancy: 'sc-Necromancy',
  Transmutation: 'sc-Transmutation',
  Universal: 'sc-Universal'
};

const SCHOOL_LABELS = {
  it: {
    Abjuration: 'Abiurazione',
    Conjuration: 'Evocazione',
    Divination: 'Divinazione',
    Enchantment: 'Ammaliamento',
    Evocation: 'Invocazione',
    Illusion: 'Illusione',
    Necromancy: 'Necromanzia',
    Transmutation: 'Trasmutazione',
    Universal: 'Universale'
  },
  en: {
    Abjuration: 'Abjuration',
    Conjuration: 'Conjuration',
    Divination: 'Divination',
    Enchantment: 'Enchantment',
    Evocation: 'Evocation',
    Illusion: 'Illusion',
    Necromancy: 'Necromancy',
    Transmutation: 'Transmutation',
    Universal: 'Universal'
  }
};

const CLASS_LABELS = {
  it: {
    Wizard: 'Mago',
    Sorcerer: 'Stregone',
    Cleric: 'Chierico',
    Druid: 'Druido',
    Paladin: 'Paladino',
    Ranger: 'Ranger',
    Warlock: 'Warlock',
    Bard: 'Bardo'
  },
  en: {}
};

const DRAWER_LABELS = {
  it: {
    manuals: 'Manuali',
    level: 'Livello',
    components: 'Componenti',
    castingTime: 'Tempo di Lancio',
    range: 'Gittata',
    target: 'Bersaglio',
    effect: 'Effetto',
    area: 'Area',
    duration: 'Durata',
    savingThrow: 'Tiro Salvezza',
    spellResistance: 'Resistenza Magia',
    description: 'Descrizione',
    noDescription: 'Nessuna descrizione disponibile.',
    sourceLink: 'Vedi su dndtools.net'
  },
  en: {
    manuals: 'Sources',
    level: 'Level',
    components: 'Components',
    castingTime: 'Casting Time',
    range: 'Range',
    target: 'Target',
    effect: 'Effect',
    area: 'Area',
    duration: 'Duration',
    savingThrow: 'Saving Throw',
    spellResistance: 'Spell Resistance',
    description: 'Description',
    noDescription: 'No description available.',
    sourceLink: 'View on dndtools.net'
  }
};

const meta = {
  schools: [],
  rulebooks: [],
  classes: [],
  total: 0
};

const state = {
  lang: 'en',
  drawerLang: 'en',
  page: 1,
  perPage: 25,
  sort: 'name',
  order: 'asc',
  total: 0,
  pages: 1,
  selectedId: null,
  timer: null,
  cardView: 'mini',
  f: { name: '', school: '', class_name: '', level_min: '', level_max: '', rulebook: '', comps: [] }
};

const SORT_COLS = {
  name: 's.name',
  school: 's.school',
  rulebook_full: 's.rulebook_full',
  casting_time: 's.casting_time'
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isMobile() {
  return window.matchMedia('(max-width:768px)').matches;
}

function dbQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbScalar(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const val = stmt.step() ? stmt.get()[0] : 0;
  stmt.free();
  return val;
}

function tSchool(school, lang = state.lang) {
  if (!school) return '';
  return (SCHOOL_LABELS[lang] && SCHOOL_LABELS[lang][school]) || school;
}

function tClass(name, lang = state.lang) {
  return (CLASS_LABELS[lang] && CLASS_LABELS[lang][name]) || name;
}

const TERM_FIXES = [
  [/\bgir[oi]\b/gi, 'round'],
];
function normalizeTerm(str) {
  if (!str) return str;
  let s = str;
  for (const [re, rep] of TERM_FIXES) s = s.replace(re, rep);
  return s;
}

function drawerLabels(lang = state.drawerLang || state.lang) {
  return DRAWER_LABELS[lang] || DRAWER_LABELS.it;
}

function badge(school, lang = state.lang) {
  if (!school) return '<span style="color:var(--text-d)">—</span>';
  return `<span class="badge ${SC[school] || ''}">${esc(tSchool(school, lang))}</span>`;
}

function formatLevelSummary(level) {
  if (!level) return '—';
  return level.split(',').slice(0, 2).map(part => part.trim()).filter(Boolean).join(', ');
}

function setButtonGroupActive(selector, lang) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function renderLanguageControls() {
  setButtonGroupActive('#lang-switch .lang-btn', state.lang);
  setButtonGroupActive('#drawer-lang-switch .lang-btn', state.drawerLang);
}

function renderMetaOptions() {
  const fill = (id, items, formatter, emptyLabel) => {
    const sel = document.getElementById(id);
    const current = sel.value;
    sel.innerHTML = `<option value="">${emptyLabel}</option>`;
    items.forEach(value => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = formatter(value);
      sel.appendChild(opt);
    });
    sel.value = current;
  };

  fill('f-school', meta.schools, value => tSchool(value), state.lang === 'it' ? '— Tutte le Scuole —' : '— All Schools —');
  fill('f-rulebook', meta.rulebooks, value => value, state.lang === 'it' ? '— Tutti i Manuali —' : '— All Sources —');
  fill('f-class', meta.classes, value => tClass(value), state.lang === 'it' ? '— Tutte le Classi —' : '— All Classes —');

  document.getElementById('hdr-stats').innerHTML =
    state.lang === 'it'
      ? `<strong>${meta.total}</strong> incantesimi &nbsp;·&nbsp; <strong>${meta.schools.length}</strong> scuole &nbsp;·&nbsp; <strong>${meta.rulebooks.length}</strong> manuali &nbsp;·&nbsp; <strong>${meta.classes.length}</strong> classi`
      : `<strong>${meta.total}</strong> spells &nbsp;·&nbsp; <strong>${meta.schools.length}</strong> schools &nbsp;·&nbsp; <strong>${meta.rulebooks.length}</strong> sources &nbsp;·&nbsp; <strong>${meta.classes.length}</strong> classes`;
  renderChips();
}

function buildWhere() {
  const conds = ['s.lang = ?'];
  const params = [state.lang];
  const { f } = state;
  let useClassJoin = false;
  let useRulebookJoin = false;

  if (f.name) {
    conds.push('s.name LIKE ?');
    params.push(`%${f.name}%`);
  }
  if (f.school) {
    conds.push('s.school = ?');
    params.push(f.school);
  }
  for (const comp of f.comps) {
    conds.push('s.components LIKE ?');
    params.push(`%${comp}%`);
  }
  if (f.class_name || f.level_min !== '' || f.level_max !== '') {
    useClassJoin = true;
    if (f.class_name) {
      conds.push('sc.class_name = ?');
      params.push(f.class_name);
    }
    if (f.level_min !== '') {
      conds.push('sc.level >= ?');
      params.push(+f.level_min);
    }
    if (f.level_max !== '') {
      conds.push('sc.level <= ?');
      params.push(+f.level_max);
    }
  }
  if (f.rulebook) {
    useRulebookJoin = true;
    conds.push('sr.rulebook_full = ?');
    params.push(f.rulebook);
  }

  const join = [
    useClassJoin ? 'JOIN spell_classes sc ON sc.spell_id = s.id' : '',
    useRulebookJoin ? 'JOIN spell_rulebooks sr ON sr.spell_id = s.id' : ''
  ].filter(Boolean).join(' ');
  const dist = useClassJoin || useRulebookJoin ? 'DISTINCT' : '';
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return { join, where, params, dist };
}

function fetchSpells() {
  if (!db) return;
  document.getElementById('loading').classList.add('show');
  document.getElementById('empty').classList.remove('show');

  setTimeout(() => {
    try {
      const { join, where, params, dist } = buildWhere();
      const sortCol = SORT_COLS[state.sort] || 's.name';
      const orderSql = state.order === 'desc' ? 'DESC' : 'ASC';
      const countSql = dist
        ? `SELECT COUNT(*) FROM (SELECT DISTINCT s.id FROM spells s ${join} ${where})`
        : `SELECT COUNT(*) FROM spells s ${join} ${where}`;

      state.total = dbScalar(countSql, params);
      state.pages = Math.max(1, Math.ceil(state.total / state.perPage));
      if (state.page > state.pages) state.page = state.pages;
      const offset = (state.page - 1) * state.perPage;

      const rows = dbQuery(`
        SELECT ${dist} s.id, s.lang, s.name, s.school,
               s.rulebook, s.rulebooks, s.rulebooks_full,
               s.level, s.components, s.casting_time, s.saving_throw
        FROM spells s ${join} ${where}
        ORDER BY ${sortCol} COLLATE NOCASE ${orderSql}
        LIMIT ? OFFSET ?
      `, [...params, state.perPage, offset]);

      if (isMobile()) renderCards(rows);
      else renderTable(rows);
      renderControls();
      renderChips();
    } finally {
      document.getElementById('loading').classList.remove('show');
    }
  }, 10);
}

function debounce(fn, delay = 300) {
  clearTimeout(state.timer);
  state.timer = setTimeout(fn, delay);
}

function setFilter(key, val, immediate = false) {
  state.f[key] = val;
  state.page = 1;
  if (immediate) fetchSpells();
  else debounce(fetchSpells);
}

function renderCards(rows) {
  const container = document.getElementById('cards');
  const empty = document.getElementById('empty');
  if (!rows.length) {
    container.innerHTML = '';
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');
  const isExpanded = state.cardView === 'expanded';
  container.innerHTML = rows.map(spell => {
    const expandedGrid = isExpanded ? `
      <div class="card-grid">
        <span class="cg-l">${state.lang === 'it' ? 'Scuola' : 'School'}</span><span class="cg-v">${esc(tSchool(spell.school)) || '—'}</span>
        <span class="cg-l">${state.lang === 'it' ? 'Componenti' : 'Components'}</span><span class="cg-v">${esc(spell.components || '—')}</span>
        <span class="cg-l">${state.lang === 'it' ? 'Tempo Lancio' : 'Casting Time'}</span><span class="cg-v">${esc(normalizeTerm(spell.casting_time) || '—')}</span>
        <span class="cg-l">${state.lang === 'it' ? 'Tiro Salvezza' : 'Saving Throw'}</span><span class="cg-v">${esc(spell.saving_throw || '—')}</span>
        <span class="cg-l">${state.lang === 'it' ? 'Manuale' : 'Source'}</span><span class="cg-v">${esc(spell.rulebooks || spell.rulebook || '—')}</span>
      </div>` : '';
    return `<div class="spell-card${isExpanded ? ' expanded' : ''}${spell.id === state.selectedId ? ' sel' : ''}" data-id="${spell.id}">
      <div class="card-top">
        <span class="card-title">${esc(spell.name)}</span>
        ${badge(spell.school)}
      </div>
      <div class="card-meta">${esc(formatLevelSummary(spell.level))}</div>
      ${expandedGrid}
    </div>`;
  }).join('');
  container.querySelectorAll('.spell-card').forEach(card => {
    card.addEventListener('click', () => openDrawer(+card.dataset.id));
  });
}

function renderTable(rows) {
  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  if (!rows.length) {
    tbody.innerHTML = '';
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  tbody.innerHTML = rows.map(spell => `
    <tr data-id="${spell.id}"${spell.id === state.selectedId ? ' class="sel"' : ''}>
      <td class="c-name" title="${esc(spell.name)}">${esc(spell.name)}</td>
      <td>${badge(spell.school)}</td>
      <td class="c-rb" title="${esc(spell.rulebooks_full || spell.rulebook || '')}">${esc(spell.rulebooks || spell.rulebook || '—')}</td>
      <td class="c-mono">${esc(formatLevelSummary(spell.level))}</td>
      <td class="c-mono">${esc(spell.components || '—')}</td>
      <td class="c-mono">${esc(normalizeTerm(spell.casting_time) || '—')}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => openDrawer(+tr.dataset.id));
  });
  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    const active = th.dataset.sort === state.sort;
    th.classList.toggle('active-sort', active);
    th.querySelector('.sort-ic').textContent = active ? (state.order === 'asc' ? '↑' : '↓') : '↕';
  });
}

function renderControls() {
  const from = state.total ? (state.page - 1) * state.perPage + 1 : 0;
  const to = Math.min(state.page * state.perPage, state.total);
  document.getElementById('result-count').innerHTML = state.total
    ? (state.lang === 'it'
        ? `Visualizzati <strong>${from}–${to}</strong> di <strong>${state.total}</strong> incantesimi`
        : `Showing <strong>${from}–${to}</strong> of <strong>${state.total}</strong> spells`)
    : (state.lang === 'it'
        ? '<strong>0</strong> incantesimi trovati'
        : '<strong>0</strong> spells found');

  document.getElementById('btn-prev').disabled = state.page <= 1;
  document.getElementById('btn-next').disabled = state.page >= state.pages;
  document.getElementById('pg-info').textContent =
    state.lang === 'it' ? `Pagina ${state.page} / ${state.pages}` : `Page ${state.page} / ${state.pages}`;

  const container = document.getElementById('pg-btns');
  container.innerHTML = pageNums().map(page =>
    page === '…'
      ? '<span class="pg-gap">…</span>'
      : `<button class="pg-btn${page === state.page ? ' cur' : ''}" data-p="${page}">${page}</button>`
  ).join('');
  container.querySelectorAll('[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = +btn.dataset.p;
      fetchSpells();
    });
  });
}

function pageNums() {
  const { page, pages } = state;
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, page - 1, page, page + 1, pages - 1, pages]);
  const out = [];
  let prev = 0;
  for (const value of [...set].filter(x => x >= 1 && x <= pages).sort((a, b) => a - b)) {
    if (prev && value - prev > 1) out.push('…');
    out.push(value);
    prev = value;
  }
  return out;
}

function renderChips() {
  const bar = document.getElementById('chips');
  const chips = [];
  const { f } = state;
  if (f.name) chips.push({ t: `${state.lang === 'it' ? 'Nome' : 'Name'}: ${f.name}`, k: 'name' });
  if (f.school) chips.push({ t: `${state.lang === 'it' ? 'Scuola' : 'School'}: ${tSchool(f.school)}`, k: 'school' });
  if (f.class_name) chips.push({ t: `${state.lang === 'it' ? 'Classe' : 'Class'}: ${tClass(f.class_name)}`, k: 'class_name' });
  if (f.level_min !== '') chips.push({ t: `${state.lang === 'it' ? 'Livello' : 'Level'} ≥ ${f.level_min}`, k: 'level_min' });
  if (f.level_max !== '') chips.push({ t: `${state.lang === 'it' ? 'Livello' : 'Level'} ≤ ${f.level_max}`, k: 'level_max' });
  if (f.rulebook) chips.push({ t: f.rulebook.length > 24 ? `${f.rulebook.slice(0, 22)}…` : f.rulebook, k: 'rulebook' });
  f.comps.forEach(comp => chips.push({ t: `Comp: ${comp}`, k: `comp:${comp}` }));

  if (!chips.length) {
    bar.innerHTML = '';
    bar.classList.remove('show');
    return;
  }

  bar.classList.add('show');
  bar.innerHTML = chips.map(chip =>
    `<span class="chip" data-k="${chip.k}">${esc(chip.t)} <span class="chip-x">×</span></span>`
  ).join('');
  bar.querySelectorAll('.chip').forEach(node => {
    node.addEventListener('click', () => removeFilter(node.dataset.k));
  });
}

function removeFilter(key) {
  if (key.startsWith('comp:')) {
    const comp = key.slice(5);
    state.f.comps = state.f.comps.filter(value => value !== comp);
    document.querySelectorAll(`.comp-btn[data-c="${comp}"]`).forEach(btn => btn.classList.remove('on'));
  } else {
    state.f[key] = '';
    const ids = {
      name: 'f-name',
      school: 'f-school',
      class_name: 'f-class',
      level_min: 'f-lmin',
      level_max: 'f-lmax',
      rulebook: 'f-rulebook'
    };
    const el = document.getElementById(ids[key]);
    if (el) el.value = '';
  }
  state.page = 1;
  fetchSpells();
}

function renderDrawerLangButtons() {
  setButtonGroupActive('#drawer-lang-switch .lang-btn', state.drawerLang);
}

function loadDrawerSpell() {
  const id = state.selectedId;
  if (!id) return;
  const spell = dbQuery('SELECT * FROM spells WHERE id = ? AND lang = ?', [id, state.drawerLang])[0]
    || dbQuery('SELECT * FROM spells WHERE id = ?', [id])[0];
  if (!spell) return;
  spell.class_levels = dbQuery(
    'SELECT class_name, level FROM spell_classes WHERE spell_id = ? ORDER BY class_name, level',
    [id]
  );
  renderDrawer(spell);
}

function openDrawer(id, lang = state.lang) {
  state.selectedId = id;
  state.drawerLang = lang;
  renderDrawerLangButtons();
  document.querySelectorAll('tbody tr').forEach(tr => {
    tr.classList.toggle('sel', +tr.dataset.id === id);
  });
  document.querySelectorAll('.spell-card').forEach(card => {
    card.classList.toggle('sel', +card.dataset.id === id);
  });
  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.getElementById('d-name').textContent = state.lang === 'it' ? 'Caricamento…' : 'Loading…';
  document.getElementById('d-book').textContent = '';
  document.getElementById('d-body').innerHTML =
    '<div style="padding:2.5rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>';
  setTimeout(loadDrawerSpell, 5);
}

function renderDrawer(spell) {
  const labels = drawerLabels(state.drawerLang);
  document.getElementById('d-name').textContent = spell.name || '';
  document.getElementById('d-book').textContent =
    (spell.rulebooks_full || spell.rulebook_full || spell.rulebook || '').split(' | ')[0];

  const schoolBadge = spell.school
    ? `<span class="badge ${SC[spell.school] || ''}" style="font-size:.72rem;padding:.12rem .55rem">${esc(tSchool(spell.school, state.drawerLang))}</span>`
    : '';

  const classChips = (spell.class_levels || []).map(cl => {
    return `<span class="cls-chip">${esc(tClass(cl.class_name, state.drawerLang))} <span class="lvl">${cl.level}</span></span>`;
  }).join('');

  const books = (spell.rulebooks_full || spell.rulebook_full || spell.rulebook || '').split(' | ').filter(Boolean);
  const booksHtml = books.length
    ? `<div class="cls-chips">${books.map(book => `<span class="cls-chip" style="color:var(--gold);border-color:rgba(201,168,76,.3)">${esc(book)}</span>`).join('')}</div>`
    : '—';

  const rows = [
    [labels.manuals, booksHtml],
    [labels.level, classChips ? `<div class="cls-chips">${classChips}</div>` : esc(spell.level || '—')],
    [labels.components, `<span class="mono">${esc(spell.components || '—')}</span>`],
    [labels.castingTime, `<span class="mono">${esc(normalizeTerm(spell.casting_time) || '—')}</span>`],
    [labels.range, esc(spell.range_txt || '—')],
    spell.target ? [labels.target, esc(spell.target)] : null,
    spell.effect ? [labels.effect, esc(spell.effect)] : null,
    spell.area ? [labels.area, esc(spell.area)] : null,
    [labels.duration, esc(spell.duration || '—')],
    [labels.savingThrow, `<span class="mono">${esc(spell.saving_throw || '—')}</span>`],
    [labels.spellResistance, `<span class="mono">${esc(spell.spell_resistance || '—')}</span>`]
  ].filter(Boolean);

  const descHtml = spell.description
    ? spell.description.split('\n').filter(Boolean).map(paragraph => `<p>${esc(paragraph)}</p>`).join('')
    : `<p style="color:var(--text-m);font-style:italic">${esc(labels.noDescription)}</p>`;

  const extLink = document.getElementById('d-ext-link');
  if (spell.url) {
    extLink.href = spell.url;
    extLink.classList.add('visible');
  } else {
    extLink.removeAttribute('href');
    extLink.classList.remove('visible');
  }

  document.getElementById('d-body').innerHTML = `
    <div class="d-school">${schoolBadge}</div>
    <div class="stat-grid">${rows.map(([label, value]) => `<div class="sl">${label}</div><div class="sv">${value}</div>`).join('')}</div>
    <div class="orn">✦</div>
    <div class="d-desc-lbl">${esc(labels.description)}</div>
    <div class="d-desc">${descHtml}</div>
  `;
}

function closeDrawer() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  document.querySelectorAll('tbody tr.sel, .spell-card.sel').forEach(node => node.classList.remove('sel'));
  state.selectedId = null;
  state.drawerLang = state.lang;
  renderDrawerLangButtons();
}

async function loadMeta() {
  meta.schools = dbQuery(`
    SELECT DISTINCT school FROM spells
    WHERE lang = 'en' AND school IS NOT NULL AND school != ''
    ORDER BY school
  `).map(row => row.school);
  meta.rulebooks = dbQuery(`
    SELECT DISTINCT rulebook_full FROM spell_rulebooks
    WHERE rulebook_full IS NOT NULL AND rulebook_full != ''
    ORDER BY rulebook_full
  `).map(row => row.rulebook_full);
  meta.classes = dbQuery('SELECT DISTINCT class_name FROM spell_classes ORDER BY class_name').map(row => row.class_name);
  meta.total = dbScalar("SELECT COUNT(*) FROM spells WHERE lang = 'en'");
  renderMetaOptions();
}

function setLanguage(lang) {
  if (state.lang === lang) return;
  state.lang = lang;
  state.drawerLang = lang;
  renderLanguageControls();
  renderMetaOptions();
  fetchSpells();
  if (document.getElementById('drawer').classList.contains('open') && state.selectedId) {
    loadDrawerSpell();
  }
}

function bindEvents() {
  document.getElementById('f-name').addEventListener('input', event => setFilter('name', event.target.value));
  document.getElementById('f-school').addEventListener('change', event => setFilter('school', event.target.value, true));
  document.getElementById('f-rulebook').addEventListener('change', event => setFilter('rulebook', event.target.value, true));
  document.getElementById('f-class').addEventListener('change', event => setFilter('class_name', event.target.value, true));
  document.getElementById('f-lmin').addEventListener('input', event => setFilter('level_min', event.target.value));
  document.getElementById('f-lmax').addEventListener('input', event => setFilter('level_max', event.target.value));

  document.querySelectorAll('#lang-switch .lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });
  document.querySelectorAll('#drawer-lang-switch .lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.selectedId) return;
      state.drawerLang = btn.dataset.lang;
      renderDrawerLangButtons();
      loadDrawerSpell();
    });
  });

  document.querySelectorAll('.comp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const comp = btn.dataset.c;
      const index = state.f.comps.indexOf(comp);
      if (index >= 0) {
        state.f.comps.splice(index, 1);
        btn.classList.remove('on');
      } else {
        state.f.comps.push(comp);
        btn.classList.add('on');
      }
      state.page = 1;
      fetchSpells();
    });
  });

  document.getElementById('f-pp').addEventListener('change', event => {
    state.perPage = +event.target.value;
    state.page = 1;
    fetchSpells();
  });

  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sort === col) state.order = state.order === 'asc' ? 'desc' : 'asc';
      else {
        state.sort = col;
        state.order = 'asc';
      }
      fetchSpells();
    });
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      fetchSpells();
    }
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (state.page < state.pages) {
      state.page += 1;
      fetchSpells();
    }
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    state.f = { name: '', school: '', class_name: '', level_min: '', level_max: '', rulebook: '', comps: [] };
    ['f-name', 'f-school', 'f-rulebook', 'f-class', 'f-lmin', 'f-lmax'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('f-name-mob').value = '';
    document.querySelectorAll('.comp-btn').forEach(btn => btn.classList.remove('on'));
    state.page = 1;
    fetchSpells();
  });

  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay-sidebar').classList.add('show');
    document.getElementById('btn-filters').classList.add('active');
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay-sidebar').classList.remove('show');
    document.getElementById('btn-filters').classList.remove('active');
  }

  document.getElementById('overlay').addEventListener('click', closeDrawer);
  document.getElementById('d-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeDrawer();
      closeSidebar();
    }
  });

  document.getElementById('btn-filters').addEventListener('click', openSidebar);
  document.getElementById('overlay-sidebar').addEventListener('click', closeSidebar);
  document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);

  document.getElementById('f-name-mob').addEventListener('input', event => {
    document.getElementById('f-name').value = event.target.value;
    setFilter('name', event.target.value);
  });
  document.getElementById('f-name').addEventListener('input', event => {
    document.getElementById('f-name-mob').value = event.target.value;
  });

  document.getElementById('btn-view-mini').addEventListener('click', () => {
    state.cardView = 'mini';
    document.getElementById('btn-view-mini').classList.add('active');
    document.getElementById('btn-view-full').classList.remove('active');
    fetchSpells();
  });
  document.getElementById('btn-view-full').addEventListener('click', () => {
    state.cardView = 'expanded';
    document.getElementById('btn-view-full').classList.add('active');
    document.getElementById('btn-view-mini').classList.remove('active');
    fetchSpells();
  });

  let lastMobile = isMobile();
  window.addEventListener('resize', debounce.bind(null, () => {
    const currentMobile = isMobile();
    if (currentMobile !== lastMobile) {
      lastMobile = currentMobile;
      fetchSpells();
    }
  }, 200));
}

async function init() {
  const msg = document.getElementById('splash-msg');
  msg.textContent = 'Caricamento motore SQL…';
  SQL = await initSqlJs({
    locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/${file}`
  });

  msg.textContent = 'Apertura database…';
  const binary = atob(window.DB_DATA);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  db = new SQL.Database(bytes);

  msg.textContent = 'Inizializzazione…';
  await loadMeta();
  renderLanguageControls();

  document.getElementById('splash').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  fetchSpells();
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  init();
});
