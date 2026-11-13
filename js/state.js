// Стан застосунку і його збереження в localStorage.

import { DEFAULT_GROUP, GROUPS, MAX_FAVS, LIST_MODES } from './config.js';

// localStorage може бути недоступний (приватний режим тощо) — тоді просто не зберігаємо.
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
  getJSON(key, fallback) {
    try { return JSON.parse(storage.get(key)) ?? fallback; } catch (e) { return fallback; }
  },
};

function loadFavs() {
  const favs = storage.getJSON('favs', []);
  return Array.isArray(favs) ? [...new Set(favs.filter(g => GROUPS.includes(g)))].slice(-MAX_FAVS) : [];
}

const savedGroup = storage.get('group');
const savedListMode = storage.get('listMode');

export const state = {
  group: GROUPS.includes(savedGroup) ? savedGroup : DEFAULT_GROUP,  // обрана черга
  favs: loadFavs(),                                                 // збережені черги (до MAX_FAVS)
  listMode: LIST_MODES.includes(savedListMode) ? savedListMode : 'off',
  json: storage.getJSON('cache', null),         // останній завантажений файл графіка
  prevJson: storage.getJSON('prevCache', null), // попередня версія, якщо графік змінювався
  fetchedAt: Number(storage.get('fetchedAt')) || 0,
  preferredFile: storage.get('file'),           // яке з DATA_FILES спрацювало минулого разу
  compare: false,                               // показувати попередній графік на циферблаті
  lastError: null,                              // null | 'offline' | 'fail'
};

export function setGroup(g) {
  state.group = g;
  storage.set('group', g);
}

export function setFavs(favs) {
  state.favs = favs;
  storage.set('favs', JSON.stringify(favs));
}

export function setListMode(mode) {
  state.listMode = mode;
  storage.set('listMode', mode);
}

// Новий файл графіка: якщо розклад змінився, поточний стає «попереднім».
export function setSchedule(json, file, changed) {
  if (changed && state.json) {
    state.prevJson = state.json;
    storage.set('prevCache', JSON.stringify(state.prevJson));
  }
  state.json = json;
  state.fetchedAt = Date.now();
  state.preferredFile = file;
  state.lastError = null;
  storage.set('cache', JSON.stringify(json));
  storage.set('fetchedAt', String(state.fetchedAt));
  storage.set('file', file);
}
