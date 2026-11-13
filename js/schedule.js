// Розбір JSON графіка і розрахунки над ним. Лише чисті функції — без DOM, тестуються в Node.
//
// Доба — масив із 48 півгодинних слотів: 'on' | 'off' | 'maybe'.
// Слот i — це час від i*30 до (i+1)*30 хвилин після півночі за Києвом.

import { kyiv, addDays } from './time.js';

// Значення години у файлі -> два півгодинні слоти
const SLOT_MAP = {
  yes: ['on', 'on'], no: ['off', 'off'],
  first: ['off', 'on'], second: ['on', 'off'],
  mfirst: ['maybe', 'on'], msecond: ['on', 'maybe'],
  maybe: ['maybe', 'maybe'],
};

// Години "1".."24" однієї доби -> 48 слотів.
// "msecond" у даних Полтаваобленерго стоїть у кінці блоку відключення (no, no, msecond, yes):
// перша половина години продовжує попередній стан, друга — можливе відключення.
// prevSlot — останній слот попереднього дня (для msecond о 00:00).
export function slotsFromHours(hours, prevSlot) {
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

// Об'єкт { <unix ts початку доби>: { 'GPV2.2': {...}, ... } } з файлу (кілька відомих форматів)
export function daysContainer(json) {
  if (!json || typeof json !== 'object') return null;
  return json.fact?.data || json.data?.fact?.data || json.data || null;
}

// Графік черги по днях: { 'YYYY-MM-DD': [48 слотів] }
export function buildDays(json, group) {
  const days = daysContainer(json);
  const res = {};
  if (!days) return res;
  const keys = ['GPV' + group, 'GPV' + group.replace('.', '_'), group];
  const stamps = Object.keys(days).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  let prevDate = null, prevLast = null;
  for (const ts of stamps) {
    const day = days[String(ts)] || {};
    const key = keys.find(k => k in day);
    if (!key) { prevDate = null; continue; }
    const date = kyiv(new Date(ts * 1000)).date;
    const carry = prevDate && addDays(prevDate, 1) === date ? prevLast : null;
    const slots = slotsFromHours(day[key], carry);
    res[date] = slots;
    prevDate = date; prevLast = slots[47];
  }
  return res;
}

// У застосунку «можливе відключення» показуємо як «світло є».
export function maybeAsOn(daysMap) {
  const res = {};
  for (const d in daysMap) res[d] = daysMap[d].map(s => s === 'maybe' ? 'on' : s);
  return res;
}

// Послідовні проміжки без світла / з можливим відключенням: [{ state, start, end }] (у слотах)
export function intervals(slots) {
  const out = [];
  let cur = null;
  slots.forEach((s, i) => {
    if (s === 'on') { cur = null; return; }
    if (cur && cur.state === s) cur.end = i + 1;
    else { cur = { state: s, start: i, end: i + 1 }; out.push(cur); }
  });
  return out;
}

// Проміжки для списку: mode 'off' — без світла (і можливі відключення),
// mode 'on' — тільки коли світло точно є.
export function periods(slots, mode) {
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

// Чи змінився графік між двома завантаженнями. Порівнюємо лише дні, які є в обох файлах:
// поява графіка на завтра чи зникнення вчорашнього дня — не зміна.
export function scheduleChanged(oldJson, newJson) {
  const a = daysContainer(oldJson), b = daysContainer(newJson);
  if (!a || !b) return false;
  return Object.keys(b).some(k => k in a && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

// Поточний стан і найближча зміна (з урахуванням графіка на завтра).
// -> { known: false } або { known: true, state, idx, nowMin,
//      change: null | { atMin, next, tomorrow, remaining } }  (atMin — хвилини від півночі сьогодні)
export function status(daysMap, now) {
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
  const atMin = j * 30;
  return { known: true, state, idx, nowMin: k.minutes,
    change: { atMin, next: seq[j], tomorrow: atMin >= 1440, remaining: Math.max(0, atMin - k.minutes) } };
}
