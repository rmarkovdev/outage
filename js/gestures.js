// Дотикові жести: свайп між чергами і згасання сяйва при прокрутці.

const SWIPE_MIN_PX = 50;    // мінімальний горизонтальний зсув
const SWIPE_RATIO = 1.5;    // наскільки рух має бути горизонтальнішим за вертикальний
const SWIPE_MAX_MS = 800;   // повільніший рух — не свайп

// Горизонтальний свайп по area викликає onSwipe(dir): 1 — вліво (наступна), -1 — вправо (попередня).
// Вертикальна прокрутка не заважає: жест рахується, лише якщо рух переважно горизонтальний.
export function onHorizontalSwipe(area, onSwipe) {
  let x0 = 0, y0 = 0, t0 = 0, tracking = false;
  area.addEventListener('touchstart', e => {
    tracking = e.touches.length === 1 && !e.target.closest('select');
    if (!tracking) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  area.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO ||
        Date.now() - t0 > SWIPE_MAX_MS) return;
    onSwipe(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// Новий вміст «заїжджає» з того боку, куди тягнули
export function playSwipeAnimation(elements, dir) {
  for (const el of elements) {
    el.classList.remove('swipe-next', 'swipe-prev');
    void el.offsetWidth;   // перезапуск CSS-анімації
    el.classList.add(dir > 0 ? 'swipe-next' : 'swipe-prev');
  }
}

const PULL_PX = 40;     // наскільки потягнути вниз від верху, щоб сяйво згасло
const SCROLL_PX = 12;   // наскільки прокрутити вниз, щоб сяйво згасло

// Сяйво прибите до верху екрана і гасне (клас glow-off на body), коли:
//  • сторінку прокрутили вниз більше ніж на SCROLL_PX;
//  • її тягнуть униз від самого верху, як pull-to-refresh (на iOS під час «гумового» відскоку
//    scrollY від'ємний; про всяк випадок рахуємо ще й рух пальця).
// Повернулись нагору й відпустили — сяйво плавно вмикається знову.
export function initGlowFade() {
  let startY = null, pulled = false;
  const update = () => document.body.classList.toggle('glow-off', pulled || scrollY > SCROLL_PX);
  addEventListener('touchstart', e => { startY = scrollY <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  addEventListener('touchmove', e => {
    if (startY !== null && scrollY <= 0 && e.touches[0].clientY - startY > PULL_PX) { pulled = true; update(); }
  }, { passive: true });
  addEventListener('touchend', () => { startY = null; if (scrollY >= 0) pulled = false; update(); }, { passive: true });
  addEventListener('scroll', () => {
    if (scrollY < -PULL_PX) pulled = true;
    else if (scrollY >= 0 && startY === null) pulled = false;
    update();
  }, { passive: true });
  update();
}

// Без зуму. Safari на iOS ігнорує user-scalable=no у viewport, тому блокуємо жест щипка напряму.
export function disablePinchZoom() {
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  }
}
