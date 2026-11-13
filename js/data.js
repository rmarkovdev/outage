// Завантаження графіка з мережі.

import { DATA_FILES, DATA_BASES } from './config.js';
import { daysContainer, scheduleChanged } from './schedule.js';
import { state, setSchedule } from './state.js';

// Пробує всі джерела по черзі (спершу файл, що спрацював минулого разу).
// Успіх — оновлює state через setSchedule; невдача — записує state.lastError.
export async function loadSchedule() {
  const pref = state.preferredFile;
  const files = pref ? [pref, ...DATA_FILES.filter(f => f !== pref)] : DATA_FILES;
  const bust = Math.floor(Date.now() / 60000);   // обхід кешів CDN, не частіше ніж раз на хвилину
  for (const base of DATA_BASES) {
    for (const file of files) {
      try {
        const r = await fetch(`${base}${file}?t=${bust}`, { cache: 'no-store' });
        if (!r.ok) continue;
        const data = await r.json();
        if (!daysContainer(data)) continue;
        setSchedule(data, file, scheduleChanged(state.json, data));
        return;
      } catch (e) { /* пробуємо наступне джерело */ }
    }
  }
  state.lastError = navigator.onLine === false ? 'offline' : 'fail';
}
