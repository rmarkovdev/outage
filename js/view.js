// Відмальовування екрана зі стану (state). Не обробляє події — це робить main.js.

import { VERSION, MAX_FAVS } from './config.js';
import { kyiv, addDays, hhmm, duration, humanDate } from './time.js';
import { buildDays, maybeAsOn, periods, status } from './schedule.js';
import { renderDial } from './dial.js';
import { state } from './state.js';

const $ = sel => document.querySelector(sel);

// Заголовок у центрі циферблата: { title, sub, when }
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
  return { title: 'Світло є', sub: c.next === 'maybe' ? `Можливе вимкнення ${at}` : `Вимкнуть ${at}`, when: left };
}

function loadingHeadline() {
  return state.lastError
    ? { title: 'Немає даних', sub: 'Перевірте інтернет і спробуйте ще раз', when: '' }
    : { title: 'Завантаження…', sub: '', when: '' };
}

// Список проміжків однієї доби. nowIdx — поточний півгодинний слот (лише для сьогодні),
// щоб підсвітити проміжок, що триває зараз.
function dayList(title, slots, nowIdx) {
  const section = body => `<section class="day">${body}</section>`;
  if (!slots) return section(`<h2>${title}</h2><p class="muted">Графік ще не опубліковано</p>`);

  const onMode = state.listMode === 'on';
  const list = periods(slots, state.listMode);
  if (!list.length) {
    const msg = onMode ? '<p class="muted">Світла за графіком не буде</p>' : '<p class="free">Без відключень</p>';
    return section(`<h2>${title}</h2>${msg}`);
  }

  const totalMin = slots.filter(s => s === (onMode ? 'on' : 'off')).length * 30;
  const total = totalMin ? (onMode ? 'зі світлом ' : 'без світла ') + duration(totalMin) : '';
  const rows = list.map(iv => {
    const now = nowIdx != null && nowIdx >= iv.start && nowIdx < iv.end;
    return `<li class="${iv.state}${now ? ' now' : ''}"${now ? ' aria-current="time"' : ''}>
      <span class="range">${hhmm(iv.start * 30)}–${hhmm(iv.end * 30)}</span>
      <span class="len">${now ? '<b class="now-tag">зараз</b>' : ''}${iv.state === 'maybe' ? 'можливо, ' : ''}${duration((iv.end - iv.start) * 30)}</span></li>`;
  }).join('');
  return section(`<h2>${title}<span class="total">${total}</span></h2><ul>${rows}</ul>`);
}

// Рядок збережених черг: кнопки-пігулки + кнопка «зберегти/прибрати» для поточної
export function renderQuick() {
  const { favs, group } = state;
  const saved = favs.includes(group);
  const pills = favs.map(g => `<button type="button" class="q-pill${g === group ? ' active' : ''}"
    data-group="${g}" aria-pressed="${g === group}" aria-label="Черга ${g}">${g}</button>`).join('');
  const [label, aria] = saved
    ? [`★ Прибрати ${group}`, `Прибрати чергу ${group} зі збережених`]
    : favs.length >= MAX_FAVS
      ? [`☆ Зберегти замість ${favs[0]}`, `Зберегти чергу ${group} замість ${favs[0]}`]
      : [`☆ Зберегти ${group}`, `Зберегти чергу ${group} для швидкого перемикання`];
  $('#quick').innerHTML = pills +
    `<button type="button" class="q-fav${saved ? ' saved' : ''}" data-fav aria-label="${aria}">${label}</button>`;
}

// Порівняння з попереднім графіком: доступне, лише якщо сьогоднішній графік справді змінився
function renderCompare(today, prevToday) {
  const canCompare = !!(today && prevToday && today.join() !== prevToday.join());
  if (!canCompare) state.compare = false;
  const prevUpd = state.prevJson?.fact?.update;
  $('#cmp-note').hidden = !state.compare;
  $('#cmp-note').textContent = state.compare
    ? `Тонка смужка всередині — попередній графік${prevUpd ? ` (від ${prevUpd})` : ''}` : '';
  const btn = $('#compare');
  btn.hidden = !canCompare;
  btn.textContent = state.compare ? 'Вимкнути порівняння' : 'Порівняти з попереднім графіком';
  btn.setAttribute('aria-pressed', String(state.compare));
}

function renderFooter() {
  const { json, fetchedAt, lastError } = state;
  const upd = json?.fact?.update;
  let meta = upd ? `Графік оновлено: ${upd}` : '';
  if (fetchedAt) meta += (meta ? '. ' : '') + `Перевірено о ${hhmm(kyiv(new Date(fetchedAt)).minutes)}`;
  if (lastError === 'offline') meta += '. Немає інтернету, показано збережений графік';
  else if (lastError) meta += '. Не вдалося оновити';
  $('#meta').textContent = meta;
  $('#version').textContent = `Версія ${VERSION}`;
}

// Колір смуги браузера = поточний фон (він змінюється, коли світла немає)
function syncThemeColor() {
  const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}

export function render() {
  const { json, prevJson, group } = state;
  const now = new Date();
  const k = kyiv(now);
  const days = json ? maybeAsOn(buildDays(json, group)) : {};
  const st = status(days, now);
  const today = days[k.date];
  const tomorrowDate = addDays(k.date, 1);

  // Стан сторінки керує кольорами в CSS: on | off | maybe | none
  document.body.dataset.state = json && st.known ? st.state : 'none';
  $('#group').textContent = group;
  renderQuick();

  const h = json ? headline(st) : loadingHeadline();
  $('#title').textContent = h.title;
  $('#sub').textContent = h.sub;
  $('#when').textContent = h.when;

  const prevToday = prevJson ? maybeAsOn(buildDays(prevJson, group))[k.date] : null;
  renderCompare(today, prevToday);
  renderDial($('#dial'), today || null, k.minutes, state.compare ? prevToday : null);

  $('#list-mode').hidden = !json;
  for (const r of document.querySelectorAll('input[name="list-mode"]')) r.checked = r.value === state.listMode;
  $('#days').innerHTML = json
    ? dayList(`Сьогодні, ${humanDate(k.date)}`, today, Math.min(47, Math.floor(k.minutes / 30))) +
      dayList(`Завтра, ${humanDate(tomorrowDate)}`, days[tomorrowDate])
    : '';

  renderFooter();
  syncThemeColor();
}
