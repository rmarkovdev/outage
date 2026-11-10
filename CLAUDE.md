# Світло — графік відключень (Полтавська обл.)

PWA for iPhone (added to the home screen from Safari, no App Store) that shows the hourly
power-outage schedule (ГПВ) for one queue of Poltavaoblenergo. Owner's queue: **2.2**.
UI language: Ukrainian. Talk to the owner in Ukrainian unless they write in English.

## Stack and constraints
- Vanilla HTML/CSS/JS, **no build step, no dependencies, no framework**. Keep it that way
  unless asked: GitHub Pages serves the repo root as-is.
- `index.html` — markup + all CSS. `app.js` — logic and UI (one IIFE). `sw.js` — service worker.
  `manifest.webmanifest` + `icon-*.png`, `apple-touch-icon.png`.
- `app.js` doubles as a CommonJS module: when `module.exports` exists it exports the pure
  functions (`buildDays`, `slotsFromHours`, `intervals`, `status`, `hhmm`, `duration`, `kyiv`,
  `addDays`) and skips the UI. Keep logic pure and testable that way.
- All times are computed in **Europe/Kyiv** via `Intl.DateTimeFormat`, independent of the
  phone's time zone.

## Data source
- Unofficial JSON mirror, updated ~every 5 min by scrapers of the official sites:
  `https://raw.githubusercontent.com/yaroslav2901/OE_OUTAGE_DATA/main/data/Poltavaoblenergo.json`
  with fallback `https://cdn.jsdelivr.net/gh/yaroslav2901/OE_OUTAGE_DATA@main/data/…`.
- Official site (no public API): https://www.poe.pl.ua/disconnection/power-outages/
- Emergency (аварійні) outages are NOT in this data — only scheduled ГПВ.
- Real sample: `tests/fixtures/Poltavaoblenergo-2026-11-08.json`.

### Format
```
fact.data[<unix ts of 00:00 Kyiv>]["GPV2.2"]["1".."24"] = yes|no|first|second|mfirst|msecond
fact.update = "07.11.2026 22:54"   // shown in the footer
fact.today  = <unix ts>
preset.time_type = human-readable meaning of each value
```
Hour "1" = 00:00–01:00. Each hour is split into two 30-min slots: `on | off | maybe`.

### Gotcha: `msecond`
In Poltava data `msecond` sits at the END of an outage block (`no, no, msecond, yes`).
Its first half continues the previous slot (usually off), second half is "maybe".
Reading it literally (`on, maybe`) produces fake 30-min windows with power.
`slotsFromHours(hours, prevSlot)` handles this, carrying the last slot across midnight.
`mfirst` appears at the start of a light-on block and is read literally (`maybe, on`).

## Run / test
- Local: `python3 -m http.server 8000` → http://localhost:8000 (service worker needs http, not file://).
- Tests: `node --test` (Node 18+, no deps). Run them after any change to parsing/status logic.

## Deploy
- GitHub repo `rmarkovdev/outage`, GitHub Pages from branch `main`, folder `/` (root).
  URL: https://rmarkovdev.github.io/outage/
- **Bump `CACHE` in `sw.js`** (`svitlo-v1` → `v2` …) whenever shipping changes to
  index.html/app.js/icons, otherwise installed home-screen apps may keep the old shell.
- On iPhone: open the URL in Safari → Share → "На початковий екран".

## Design
- 24-hour dial (48 half-hour segments): amber = power on, slate = off, hatched = maybe;
  hand = now. Whole screen turns night-blue while the power is off.
- Display font: Unbounded (Google Fonts), body: system font. Light/dark via prefers-color-scheme.
- Queue picker: tap "Черга 2.2" in the header; choice saved in localStorage.

## Ideas not done yet
- Push notification N minutes before an outage (iOS 16.4+ web push needs a server/worker
  that watches the JSON, e.g. GitHub Actions cron or Cloudflare Worker).
- Scriptable home-screen widget using the same JSON.
