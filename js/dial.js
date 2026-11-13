// Циферблат на 24 години: 48 півгодинних секторів, позначки годин і стрілка «зараз».
// Малюється в <svg viewBox="0 0 320 320">; 0 годин — угорі, далі за годинниковою стрілкою.

const CX = 160, CY = 160;         // центр
const R_OUT = 150, R_IN = 124;    // зовнішній і внутрішній радіуси кільця
const LABEL_R = 102;              // радіус цифр годин
const SEG_GAP_DEG = 0.7;          // проміжок між секторами
const SEG_CLASS = { on: 'on', off: 'off', maybe: 'maybe' };

const fmt1 = n => n.toFixed(1), fmt2 = n => n.toFixed(2);

// Точка на колі радіуса r під кутом deg (0° — угорі)
function polar(r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

// Контур сектора i (0..47) між радіусами rIn і rOut
function segPath(i, rIn = R_IN, rOut = R_OUT) {
  const a0 = i * 7.5 + SEG_GAP_DEG / 2, a1 = (i + 1) * 7.5 - SEG_GAP_DEG / 2;
  const [x0, y0] = polar(rOut, a0), [x1, y1] = polar(rOut, a1);
  const [x2, y2] = polar(rIn, a1), [x3, y3] = polar(rIn, a0);
  return `M${fmt2(x0)} ${fmt2(y0)}A${rOut} ${rOut} 0 0 1 ${fmt2(x1)} ${fmt2(y1)}` +
         `L${fmt2(x2)} ${fmt2(y2)}A${rIn} ${rIn} 0 0 0 ${fmt2(x3)} ${fmt2(y3)}Z`;
}

const line = (cls, [x1, y1], [x2, y2]) =>
  `<line class="${cls}" x1="${fmt1(x1)}" y1="${fmt1(y1)}" x2="${fmt1(x2)}" y2="${fmt1(y2)}"/>`;

// Штрихування для «можливо» (зараз не використовується: maybe показуємо як «світло є»)
const DEFS = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <rect width="6" height="6" fill="var(--seg-off)"/><rect width="3" height="6" fill="var(--lamp)"/></pattern></defs>`;

// Сектори. Минулі півгодини пригашені (клас past): яскрава лише дуга від «зараз» до кінця доби,
// щоб увечері кільце не читалося як графік на завтра.
// prevSlots — попередній графік: тонка смужка біля внутрішнього краю, поточний тоді займає зовнішню частину.
function segments(slots, nowMin, prevSlots) {
  let html = '';
  for (let i = 0; i < 48; i++) {
    const past = nowMin != null && (i + 1) * 30 <= nowMin ? ' past' : '';
    const cls = `seg ${SEG_CLASS[slots?.[i]] || 'none'}${past}`;
    if (prevSlots) {
      html += `<path class="${cls}" d="${segPath(i, R_IN + 11, R_OUT)}"/>`;
      html += `<path class="prev ${SEG_CLASS[prevSlots[i]] || 'none'}${past}" d="${segPath(i, R_IN, R_IN + 9)}"/>`;
    } else {
      html += `<path class="${cls}" d="${segPath(i)}"/>`;
    }
  }
  return html;
}

// Цифри годин усередині кільця і тонкі лінії від них до кільця; 0/6/12/18 — виразніше.
function hourLabels() {
  let html = '';
  for (let h = 0; h < 24; h++) {
    const deg = h * 15, major = h % 6 === 0;
    const [x, y] = polar(LABEL_R, deg);
    html += line(`tick-line${major ? ' major' : ''}`, polar(major ? 112 : 109, deg), polar(R_IN - 1, deg));
    html += `<text class="tick${major ? '' : ' minor'}" x="${fmt1(x)}" y="${fmt1(y)}">${h}</text>`;
  }
  return html;
}

// Риска «кінець доби» на 00 і стрілка поточного часу
function nowMarks(nowMin) {
  const deg = nowMin / 1440 * 360;
  const tip = polar(R_OUT + 8, deg);
  return line('day-edge', [CX, CY - R_IN + 4], [CX, CY - R_OUT - 6]) +
    line('hand', polar(R_IN - 3, deg), tip) +
    `<circle class="hand-dot" cx="${fmt1(tip[0])}" cy="${fmt1(tip[1])}" r="4.5"/>`;
}

export function renderDial(svg, slots, nowMin, prevSlots) {
  svg.innerHTML = DEFS + segments(slots, nowMin, prevSlots) + hourLabels() +
    (nowMin != null ? nowMarks(nowMin) : '');
}
