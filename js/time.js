// Час за Києвом (незалежно від часового поясу телефона) і форматування часу/тривалості.

function makeFormatter() {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
  for (const timeZone of ['Europe/Kyiv', 'Europe/Kiev']) {   // старі браузери знають лише «Kiev»
    try { return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone }); } catch (e) {}
  }
  return new Intl.DateTimeFormat('en-CA', opts);
}
const FMT = makeFormatter();

// Дата й час у Києві: { date: 'YYYY-MM-DD', h, m, s, minutes — хвилини від півночі (з дробом) }
export function kyiv(d) {
  const p = {};
  for (const x of FMT.formatToParts(d)) p[x.type] = x.value;
  const h = +p.hour % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, h, m: +p.minute, s: +p.second,
    minutes: h * 60 + +p.minute + (+p.second) / 60 };
}

// 'YYYY-MM-DD' + n днів
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Хвилини від півночі -> 'ГГ:ХХ' (рівно 1440 — '24:00', кінець доби)
export function hhmm(min) {
  if (Math.round(min) === 1440) return '24:00';
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

// Хвилини -> '2 год 30 хв'
export function duration(min) {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} хв`;
  if (!m) return `${h} год`;
  return `${h} год ${m} хв`;
}

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

// 'YYYY-MM-DD' -> '13 листопада'
export function humanDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
