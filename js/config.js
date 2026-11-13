// Налаштування застосунку.

// Версія показується внизу екрана. Піднімайте разом з CACHE у sw.js (тест перевіряє, що вони збігаються).
export const VERSION = 14;

export const DEFAULT_GROUP = '2.2';
export const GROUPS = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

// Неофіційне дзеркало графіків (github.com/yaroslav2901/OE_OUTAGE_DATA), оновлюється ~кожні 5 хв.
// Назва файлу траплялась у двох написаннях, тому пробуємо обидві; jsDelivr — запасне джерело.
export const DATA_FILES = ['Poltavaoblenergo.json', 'Poltavaoblenerho.json'];
export const DATA_BASES = [
  'https://raw.githubusercontent.com/yaroslav2901/OE_OUTAGE_DATA/main/data/',
  'https://cdn.jsdelivr.net/gh/yaroslav2901/OE_OUTAGE_DATA@main/data/',
];

export const REFRESH_MS = 5 * 60 * 1000;   // як часто перезавантажувати дані
export const RENDER_MS = 20 * 1000;        // як часто перемальовувати (рух стрілки, «ще N хв»)
export const MAX_FAVS = 2;                 // скільки черг можна зберегти для швидкого перемикання
export const LIST_MODES = ['off', 'on'];   // що показувати у списку: періоди без світла / зі світлом
