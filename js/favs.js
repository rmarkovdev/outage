// Збережені черги для швидкого перемикання. Чисті функції над масивом назв черг.

import { MAX_FAVS } from './config.js';

// Додати або прибрати чергу g. Якщо місць немає — витісняється найстаріша.
export function toggleFav(favs, g, max = MAX_FAVS) {
  if (favs.includes(g)) return favs.filter(x => x !== g);
  return favs.concat(g).slice(-max);
}

// Свайп між збереженими чергами: dir = 1 — наступна, -1 — попередня (по колу).
// Якщо поточна черга не збережена, свайп веде на першу/останню збережену.
export function nextFav(favs, g, dir) {
  if (!favs.length) return null;
  const i = favs.indexOf(g);
  if (i === -1) return dir > 0 ? favs[0] : favs[favs.length - 1];
  if (favs.length < 2) return null;
  return favs[(i + dir + favs.length) % favs.length];
}
