// Run: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require('../app.js');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'Poltavaoblenergo-2026-11-08.json'), 'utf8'));

const fmt = slots => A.intervals(slots)
  .map(i => `${i.state === 'maybe' ? '?' : ''}${A.hhmm(i.start * 30)}-${A.hhmm(i.end * 30)}`);

test('real Poltava file: group 2.2 on 2026-11-08', () => {
  const days = A.buildDays(fixture, '2.2');
  assert.deepEqual(Object.keys(days), ['2026-11-08']);
  assert.deepEqual(fmt(days['2026-11-08']), [
    '02:30-06:30', '?06:30-07:00',
    '09:30-13:30', '?13:30-14:00',
    '15:30-19:30', '?19:30-20:00',
    '21:30-24:00'
  ]);
});

test('real Poltava file: sub-groups x.1 and x.2 are 30 min apart', () => {
  const d21 = fmt(A.buildDays(fixture, '2.1')['2026-11-08']);
  assert.equal(d21[0], '02:00-06:00');
  assert.equal(d21[1], '?06:00-06:30');
});

test('msecond continues the previous state in its first half', () => {
  const hours = {};
  for (let h = 1; h <= 24; h++) hours[h] = 'yes';
  Object.assign(hours, { 3: 'no', 4: 'msecond' });
  const s = A.slotsFromHours(hours);
  assert.deepEqual(s.slice(4, 8), ['off', 'off', 'off', 'maybe']);
});

test('msecond in hour 1 carries over from the previous day', () => {
  const hours = { 1: 'msecond' };
  assert.deepEqual(A.slotsFromHours(hours, 'off').slice(0, 2), ['off', 'maybe']);
  assert.deepEqual(A.slotsFromHours(hours, 'on').slice(0, 2), ['on', 'maybe']);
});

test('status at 14:25 Kyiv: light on, off at 15:30', () => {
  const st = A.status(A.buildDays(fixture, '2.2'), new Date('2026-11-08T14:25:00+02:00'));
  assert.equal(st.state, 'on');
  assert.equal(st.change.next, 'off');
  assert.equal(A.hhmm(st.change.atMin), '15:30');
  assert.equal(A.duration(st.change.remaining), '1 год 5 хв');
});

test('status crosses midnight into tomorrow', () => {
  const ts = d => String(Date.parse(d + 'T00:00:00+02:00') / 1000);
  const all = v => Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i + 1, v]));
  const json = { fact: { data: {
    [ts('2026-11-08')]: { 'GPV2.2': Object.assign(all('yes'), { 24: 'no' }) },
    [ts('2026-11-09')]: { 'GPV2.2': Object.assign(all('yes'), { 1: 'no', 2: 'no' }) }
  } } };
  const st = A.status(A.buildDays(json, '2.2'), new Date('2026-11-08T23:10:00+02:00'));
  assert.equal(st.state, 'off');
  assert.equal(st.change.tomorrow, true);
  assert.equal(A.hhmm(st.change.atMin), '02:00');
});

test('unknown day -> known: false', () => {
  const st = A.status(A.buildDays(fixture, '2.2'), new Date('2026-11-20T10:00:00+02:00'));
  assert.equal(st.known, false);
});
