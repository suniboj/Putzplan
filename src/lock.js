// Sperrlogik für den Putzplan – reines ES-Modul ohne Abhängigkeiten.
// Wird im Browser, in den Tests (Node) und im Cloudflare Worker verwendet.
// Monate immer als "YYYY-MM".

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const pad = (n) => String(n).padStart(2, '0');

function parseMonth(monat) {
  const [year, month] = monat.split('-').map(Number);
  return { year, month };
}

function toMonthString(year, month) {
  return `${year}-${pad(month)}`;
}

function nextMonth({ year, month }) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function compareDate(a, b) {
  return (a.year - b.year) || (a.month - b.month) || ((a.day ?? 0) - (b.day ?? 0));
}

/** Kalenderdatum des Zeitpunkts `now` in der Zeitzone `tz`. */
export function zonedDate(now, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function currentMonth(now, tz) {
  const { year, month } = zonedDate(now, tz);
  return toMonthString(year, month);
}

/** Letzter editierbarer Tag: Tag `graceDays` des Folgemonats. */
export function lastEditableDay(monat, graceDays) {
  return { ...nextMonth(parseMonth(monat)), day: graceDays };
}

/** Erster gesperrter Tag (ab 00:00 Ortszeit): Tag `graceDays + 1` des Folgemonats. */
export function firstLockedDay(monat, graceDays) {
  return { ...nextMonth(parseMonth(monat)), day: graceDays + 1 };
}

export function isLocked(monat, now, graceDays, tz) {
  return compareDate(zonedDate(now, tz), firstLockedDay(monat, graceDays)) >= 0;
}

export function isFuture(monat, now, tz) {
  return monat > currentMonth(now, tz);
}

/** Alle Monate vom aktuellen bis zum Startmonat, neueste zuerst. */
export function listMonths(startMonth, now, tz) {
  const result = [];
  let { year, month } = parseMonth(currentMonth(now, tz));
  while (toMonthString(year, month) >= startMonth) {
    result.push(toMonthString(year, month));
    if (month === 1) { year -= 1; month = 12; } else { month -= 1; }
  }
  return result;
}

export function formatMonth(monat) {
  const { year, month } = parseMonth(monat);
  return `${MONATE[month - 1]} ${year}`;
}

export function formatDay({ month, day }) {
  return `${pad(day)}.${pad(month)}.`;
}

/** Raumnummer aus Text (z. B. URL-Parameter); nur Ganzzahl 1..roomCount, sonst null. */
export function parseRoom(value, roomCount) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const n = Number(value);
  return n <= roomCount ? n : null;
}
