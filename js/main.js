// Точка входу: підключає обробники подій і запускає оновлення.
//
// Структура:
//   config.js   — налаштування (версія, черги, джерела даних)
//   time.js     — час за Києвом і форматування
//   schedule.js — розбір JSON і розрахунки графіка (чисті функції, є тести)
//   favs.js     — збережені черги (чисті функції, є тести)
//   state.js    — стан застосунку + localStorage
//   data.js     — завантаження графіка з мережі
//   dial.js     — SVG-циферблат
//   view.js     — відмальовування екрана зі стану
//   gestures.js — свайпи, сяйво, заборона зуму

import { GROUPS, LIST_MODES, REFRESH_MS, RENDER_MS } from './config.js';
import { toggleFav, nextFav } from './favs.js';
import { state, setGroup, setFavs, setListMode } from './state.js';
import { loadSchedule } from './data.js';
import { render, renderQuick } from './view.js';
import { onHorizontalSwipe, playSwipeAnimation, initGlowFade, disablePinchZoom } from './gestures.js';

const $ = sel => document.querySelector(sel);

async function refresh() {
  await loadSchedule();
  render();
}

function selectGroup(g) {
  if (!GROUPS.includes(g)) return;
  setGroup(g);
  $('#picker').value = g;
  render();
}

// Випадаючий список усіх черг (прихований <select> поверх заголовка «Черга X»)
function initPicker() {
  const sel = $('#picker');
  sel.innerHTML = GROUPS.map(g =>
    `<option value="${g}"${g === state.group ? ' selected' : ''}>Черга ${g}</option>`).join('');
  sel.addEventListener('change', () => selectGroup(sel.value));
}

// Збережені черги: пігулка — перемкнутись, «☆/★» — зберегти чи прибрати поточну
function initQuick() {
  $('#quick').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.group) { selectGroup(b.dataset.group); return; }
    setFavs(toggleFav(state.favs, state.group));
    renderQuick();
  });
}

function initSwipe() {
  onHorizontalSwipe($('main'), dir => {
    const g = nextFav(state.favs, state.group, dir);
    if (!g || g === state.group) return;
    selectGroup(g);
    playSwipeAnimation([$('.clock'), $('#days')], dir);
  });
}

function initListMode() {
  $('#list-mode').addEventListener('change', e => {
    if (!LIST_MODES.includes(e.target.value)) return;
    setListMode(e.target.value);
    render();
  });
}

function initCompare() {
  $('#compare').addEventListener('click', () => {
    state.compare = !state.compare;
    render();
    if (state.compare) scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initRefreshButton() {
  const btn = $('#refresh');
  btn.addEventListener('click', () => {
    btn.classList.add('spin');
    refresh().finally(() => setTimeout(() => btn.classList.remove('spin'), 400));
  });
}

// Повернулись у застосунок — одразу перемалювати і, якщо дані старші за хвилину, оновити
function initAutoRefresh() {
  setInterval(render, RENDER_MS);
  setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    render();
    if (Date.now() - state.fetchedAt > 60 * 1000) refresh();
  });
  addEventListener('online', refresh);
}

initPicker();
initQuick();
initSwipe();
initListMode();
initCompare();
initRefreshButton();
initGlowFade();
disablePinchZoom();
render();
refresh();
initAutoRefresh();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
