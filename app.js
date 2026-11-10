/* Світло · черга — графік погодинних відключень (Полтаваобленерго)
 * Дані: github.com/yaroslav2901/OE_OUTAGE_DATA (оновлюються ~кожні 5 хв)
 */
(function (root) {
  'use strict';

  // ---------- налаштування ----------
  // Версія застосунку: показується внизу екрана. Піднімайте разом з CACHE у sw.js.
  const VERSION = 4;
  const DEFAULT_GROUP = '2.2';
  const GROUPS = ['1.1','1.2','2.1','2.2','3.1','3.2','4.1','4.2','5.1','5.2','6.1','6.2'];
  const FILES = ['Poltavaoblenergo.json', 'Poltavaoblenerho.json'];
  const BASES = [
    'https://raw.githubusercontent.com/yaroslav2901/OE_OUTAGE_DATA/main/data/',
    'https://cdn.jsdelivr.net/gh/yaroslav2901/OE_OUTAGE_DATA@main/data/'
  ];
  const REFRESH_MS = 5 * 60 * 1000;

  // ---------- час за Києвом (незалежно від часового поясу телефона) ----------
  function makeFmt() {
    const opts = { year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
    for (const tz of ['Europe/Kyiv', 'Europe/Kiev']) {
      try { return new Intl.DateTimeFormat('en-CA', Object.assign({ timeZone: tz }, opts)); } catch (e) {}
    }
    return new Intl.DateTimeFormat('en-CA', opts);
  }
  const FMT = makeFmt();

  function kyiv(d) {
    const p = {};
    for (const x of FMT.formatToParts(d)) p[x.type] = x.value;
    const h = +p.hour % 24;
    return { date: `${p.year}-${p.month}-${p.day}`, h, m: +p.minute, s: +p.second,
      minutes: h * 60 + +p.minute + (+p.second) / 60 };
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // ---------- розбір JSON ----------
  // Кожна година "1".."24" -> два півгодинні слоти: 'on' | 'off' | 'maybe'
  const SLOT_MAP = {
    yes: ['on', 'on'], no: ['off', 'off'],
    first: ['off', 'on'], second: ['on', 'off'],
    mfirst: ['maybe', 'on'], msecond: ['on', 'maybe'],
    maybe: ['maybe', 'maybe']
  };

  // "msecond" у даних Полтаваобленерго стоїть у кінці блоку відключення
  // (no, no, msecond, yes): перша половина години продовжує попередній стан,
  // друга — можливе відключення. prevSlot — останній слот попереднього дня.
  function slotsFromHours(hours, prevSlot) {
    const out = [];
    for (let h = 1; h <= 24; h++) {
      const v = String((hours && hours[String(h)]) || 'yes').toLowerCase();
      if (v === 'msecond') {
        const prev = out.length ? out[out.length - 1] : (prevSlot || 'maybe');
        out.push(prev, 'maybe');
      } else {
        out.push(...(SLOT_MAP[v] || ['on', 'on']));
      }
    }
    return out;
  }

  function daysContainer(json) {
    if (!json || typeof json !== 'object') return null;
    return (json.fact && json.fact.data) ||
           (json.data && json.data.fact && json.data.fact.data) ||
           json.data || null;
  }

  // -> { 'YYYY-MM-DD': [48 слотів] } для обраної черги
  function buildDays(json, group) {
    const days = daysContainer(json);
    const res = {};
    if (!days) return res;
    const keys = ['GPV' + group, 'GPV' + group.replace('.', '_'), group];
    const stamps = Object.keys(days).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    let prevDate = null, prevLast = null;
    for (const n of stamps) {
      const day = days[String(n)] || {};
      const k = keys.find(k => k in day);
      if (!k) { prevDate = null; continue; }
      const date = kyiv(new Date(n * 1000)).date;
      const carry = prevDate && addDays(prevDate, 1) === date ? prevLast : null;
      const slots = slotsFromHours(day[k], carry);
      res[date] = slots;
      prevDate = date; prevLast = slots[47];
    }
    return res;
  }

  // У застосунку «можливе відключення» показуємо як «світло є».
  function maybeAsOn(daysMap) {
    const res = {};
    for (const d in daysMap) res[d] = daysMap[d].map(s => s === 'maybe' ? 'on' : s);
    return res;
  }

  // Послідовні інтервали без світла / з можливим відключенням
  function intervals(slots) {
    const out = [];
    let cur = null;
    slots.forEach((s, i) => {
      if (s === 'on') { cur = null; return; }
      if (cur && cur.state === s) cur.end = i + 1;
      else { cur = { state: s, start: i, end: i + 1 }; out.push(cur); }
    });
    return out;
  }

  // Періоди для списку: mode 'off' — без світла і можливі відключення,
  // mode 'on' — тільки періоди, коли світло точно є.
  const LIST_MODES = ['off', 'on'];
  function periods(slots, mode) {
    if (mode !== 'on') return intervals(slots);
    const out = [];
    let cur = null;
    slots.forEach((s, i) => {
      if (s !== 'on') { cur = null; return; }
      if (cur) cur.end = i + 1;
      else { cur = { state: 'on', start: i, end: i + 1 }; out.push(cur); }
    });
    return out;
  }

  // Поточний стан і найближча зміна
  function status(daysMap, now) {
    const k = kyiv(now);
    const today = daysMap[k.date];
    if (!today) return { known: false };
    const tomorrow = daysMap[addDays(k.date, 1)];
    const seq = tomorrow ? today.concat(tomorrow) : today;
    const idx = Math.min(47, Math.floor(k.minutes / 30));
    const state = today[idx];
    let j = idx + 1;
    while (j < seq.length && seq[j] === state) j++;
    if (j >= seq.length) return { known: true, state, idx, change: null, nowMin: k.minutes };
    const atMin = j * 30;                       // хвилини від півночі сьогодні
    return { known: true, state, idx, nowMin: k.minutes,
      change: { atMin, next: seq[j], tomorrow: atMin >= 1440,
        remaining: Math.max(0, atMin - k.minutes) } };
  }

  function hhmm(min) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    if (Math.round(min) === 1440) return '24:00';
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  function duration(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m} хв`;
    if (!m) return `${h} год`;
    return `${h} год ${m} хв`;
  }

  const api = { VERSION, GROUPS, DEFAULT_GROUP, kyiv, addDays, slotsFromHours, buildDays,
    maybeAsOn, intervals, periods, LIST_MODES, status, hhmm, duration };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // =====================================================================
  //                               ІНТЕРФЕЙС
  // =====================================================================
  const $ = s => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  let group = store.get('group') || DEFAULT_GROUP;
  if (!GROUPS.includes(group)) group = DEFAULT_GROUP;
  let listMode = store.get('listMode');
  if (!LIST_MODES.includes(listMode)) listMode = 'off';
  let json = null;
  try { json = JSON.parse(store.get('cache') || 'null'); } catch (e) {}
  let fetchedAt = Number(store.get('fetchedAt')) || 0;
  let lastError = null;

  async function load() {
    const prefer = store.get('file');
    const files = prefer ? [prefer].concat(FILES.filter(f => f !== prefer)) : FILES;
    const bust = Math.floor(Date.now() / 60000);
    for (const base of BASES) {
      for (const f of files) {
        try {
          const r = await fetch(base + f + '?t=' + bust, { cache: 'no-store' });
          if (!r.ok) continue;
          const data = await r.json();
          if (!daysContainer(data)) continue;
          json = data; fetchedAt = Date.now(); lastError = null;
          store.set('cache', JSON.stringify(data));
          store.set('fetchedAt', String(fetchedAt));
          store.set('file', f);
          render();
          return;
        } catch (e) { /* пробуємо наступне джерело */ }
      }
    }
    lastError = navigator.onLine === false ? 'offline' : 'fail';
    render();
  }

  // ---------- циферблат ----------
  const CX = 160, CY = 160, R_OUT = 150, R_IN = 124;
  function polar(r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  }
  function segPath(i) {
    const gap = 0.7, a0 = i * 7.5 + gap / 2, a1 = (i + 1) * 7.5 - gap / 2;
    const [x0, y0] = polar(R_OUT, a0), [x1, y1] = polar(R_OUT, a1);
    const [x2, y2] = polar(R_IN, a1), [x3, y3] = polar(R_IN, a0);
    const f = n => n.toFixed(2);
    return `M${f(x0)} ${f(y0)}A${R_OUT} ${R_OUT} 0 0 1 ${f(x1)} ${f(y1)}` +
           `L${f(x2)} ${f(y2)}A${R_IN} ${R_IN} 0 0 0 ${f(x3)} ${f(y3)}Z`;
  }

  function renderDial(slots, nowMin) {
    const svg = $('#dial');
    let html = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--seg-off)"/><rect width="3" height="6" fill="var(--lamp)"/></pattern></defs>`;
    for (let i = 0; i < 48; i++) {
      const s = slots ? slots[i] : 'none';
      const cls = s === 'off' ? 'seg off' : s === 'maybe' ? 'seg maybe' : s === 'on' ? 'seg on' : 'seg none';
      html += `<path class="${cls}" d="${segPath(i)}"/>`;
    }
    // Позначки годин: кожна година біля внутрішнього краю кільця, 0/6/12/18 — виразніше
    for (let h = 0; h < 24; h++) {
      const [x, y] = polar(111, h * 15);
      const major = h % 6 === 0;
      html += `<text class="tick${major ? '' : ' minor'}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${h}</text>`;
    }
    if (nowMin != null) {
      const deg = nowMin / 1440 * 360;
      const [x0, y0] = polar(R_IN - 3, deg), [x1, y1] = polar(R_OUT + 8, deg);
      const [xd, yd] = polar(R_OUT + 8, deg);
      html += `<line class="hand" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
      html += `<circle class="hand-dot" cx="${xd.toFixed(1)}" cy="${yd.toFixed(1)}" r="4.5"/>`;
    }
    svg.innerHTML = html;
  }

  // ---------- текст ----------
  const MONTHS = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  function humanDate(dateStr) {
    const [, m, d] = dateStr.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]}`;
  }

  function headline(st) {
    if (!st.known) return { title: 'Графіка ще немає', sub: 'На сьогодні дані не опубліковані', when: '' };
    const c = st.change;
    const at = c ? (c.tomorrow ? `завтра о ${hhmm(c.atMin)}` : `о ${hhmm(c.atMin)}`) : '';
    const left = c ? `ще ${duration(c.remaining)}` : '';
    if (st.state === 'off') {
      return { title: 'Світла немає', sub: c ? `Увімкнуть ${at}` : 'До кінця графіка без змін', when: left };
    }
    if (st.state === 'maybe') {
      return { title: 'Можливе відключення',
        sub: c ? (c.next === 'off' ? `Вимкнуть ${at}` : `Триватиме до ${hhmm(c.atMin)}`) : 'До кінця графіка',
        when: left };
    }
    if (!c) return { title: 'Світло є', sub: 'Відключень до кінця графіка немає', when: '' };
    return { title: 'Світло є',
      sub: c.next === 'maybe' ? `Можливе вимкнення ${at}` : `Вимкнуть ${at}`, when: left };
  }

  // nowIdx — номер поточного півгодинного слота (тільки для сьогодні), щоб підсвітити проміжок
  function dayList(title, slots, nowIdx) {
    if (!slots) {
      return `<section class="day"><h2>${title}</h2><p class="muted">Графік ще не опубліковано</p></section>`;
    }
    const onMode = listMode === 'on';
    const list = periods(slots, listMode);
    if (!list.length) {
      const msg = onMode ? '<p class="muted">Світла за графіком не буде</p>' : '<p class="free">Без відключень</p>';
      return `<section class="day"><h2>${title}</h2>${msg}</section>`;
    }
    const totalMin = slots.filter(s => s === (onMode ? 'on' : 'off')).length * 30;
    const total = totalMin ? (onMode ? 'зі світлом ' : 'без світла ') + duration(totalMin) : '';
    const rows = list.map(iv => {
      const now = nowIdx != null && nowIdx >= iv.start && nowIdx < iv.end;
      return `<li class="${iv.state}${now ? ' now' : ''}"${now ? ' aria-current="time"' : ''}>
        <span class="range">${hhmm(iv.start * 30)}–${hhmm(iv.end * 30)}</span>
        <span class="len">${now ? '<b class="now-tag">зараз</b>' : ''}${iv.state === 'maybe' ? 'можливо, ' : ''}${duration((iv.end - iv.start) * 30)}</span></li>`;
    }).join('');
    return `<section class="day"><h2>${title}<span class="total">${total}</span></h2><ul>${rows}</ul></section>`;
  }

  function render() {
    const now = new Date();
    const k = kyiv(now);
    const days = json ? maybeAsOn(buildDays(json, group)) : {};
    const st = status(days, now);
    const today = days[k.date], tomorrowDate = addDays(k.date, 1), tomorrow = days[tomorrowDate];

    document.body.dataset.state = !json ? 'none' : st.known ? st.state : 'none';
    $('#group').textContent = group;

    const h = json ? headline(st) : { title: lastError ? 'Немає даних' : 'Завантаження…',
      sub: lastError ? 'Перевірте інтернет і спробуйте ще раз' : '', when: '' };
    $('#title').textContent = h.title;
    $('#sub').textContent = h.sub;
    $('#when').textContent = h.when;
    renderDial(today || null, k.minutes);

    $('#list-mode').hidden = !json;
    for (const r of document.querySelectorAll('input[name="list-mode"]')) r.checked = r.value === listMode;
    $('#days').innerHTML = json
      ? dayList(`Сьогодні, ${humanDate(k.date)}`, today, Math.min(47, Math.floor(k.minutes / 30))) + dayList(`Завтра, ${humanDate(tomorrowDate)}`, tomorrow)
      : '';

    const upd = json && json.fact && json.fact.update;
    let meta = upd ? `Графік оновлено: ${upd}` : '';
    if (fetchedAt) meta += (meta ? '. ' : '') + `Перевірено о ${hhmm(kyiv(new Date(fetchedAt)).minutes)}`;
    if (lastError === 'offline') meta += '. Немає інтернету, показано збережений графік';
    else if (lastError) meta += '. Не вдалося оновити';
    $('#meta').textContent = meta;
    $('#version').textContent = `Версія ${VERSION}`;

    const theme = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc && theme) tc.setAttribute('content', theme);
  }

  function initPicker() {
    const sel = $('#picker');
    sel.innerHTML = GROUPS.map(g => `<option value="${g}"${g === group ? ' selected' : ''}>Черга ${g}</option>`).join('');
    sel.addEventListener('change', () => { group = sel.value; store.set('group', group); render(); });
  }

  function initListMode() {
    $('#list-mode').addEventListener('change', e => {
      if (!LIST_MODES.includes(e.target.value)) return;
      listMode = e.target.value; store.set('listMode', listMode); render();
    });
  }

  function start() {
    initPicker();
    initListMode();
    render();
    load();
    setInterval(render, 20 * 1000);
    setInterval(load, REFRESH_MS);
    $('#refresh').addEventListener('click', () => { $('#refresh').classList.add('spin'); load().finally(() =>
      setTimeout(() => $('#refresh').classList.remove('spin'), 400)); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        render();
        if (Date.now() - fetchedAt > 60 * 1000) load();
      }
    });
    window.addEventListener('online', load);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  root.Svitlo = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
