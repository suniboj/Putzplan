import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentMonth, lastEditableDay, firstLockedDay, isLocked, isFuture,
  listMonths, listMonthsAhead, formatMonth, formatMonthShort, formatDay, parseRoom, zonedDate,
} from '../src/lock.js';

const TZ = 'Europe/Berlin';
const at = (iso) => new Date(iso);

test('zonedDate liefert Kalenderdatum in der Zeitzone', () => {
  assert.deepEqual(zonedDate(at('2026-11-30T23:30:00Z'), TZ), { year: 2026, month: 12, day: 1 });
});

test('November ist am 05.12. 23:59:59 MEZ noch offen', () => {
  assert.equal(isLocked('2026-11', at('2026-12-05T22:59:59Z'), 5, TZ), false);
});

test('November ist am 06.12. 00:00 MEZ gesperrt', () => {
  assert.equal(isLocked('2026-11', at('2026-12-05T23:00:00Z'), 5, TZ), true);
});

test('Jahreswechsel: Dezember sperrt am 06.01. 00:00', () => {
  assert.equal(isLocked('2026-12', at('2027-01-05T22:59:59Z'), 5, TZ), false);
  assert.equal(isLocked('2026-12', at('2027-01-05T23:00:00Z'), 5, TZ), true);
});

test('Sommerzeit: März 2027 sperrt am 06.04. 00:00 MESZ', () => {
  assert.equal(isLocked('2027-03', at('2027-04-05T21:59:59Z'), 5, TZ), false);
  assert.equal(isLocked('2027-03', at('2027-04-05T22:00:00Z'), 5, TZ), true);
});

test('Zeitumstellungsmonat: September 2026 sperrt am 06.10. 00:00 MESZ', () => {
  assert.equal(isLocked('2026-09', at('2026-10-05T21:59:59Z'), 5, TZ), false);
  assert.equal(isLocked('2026-09', at('2026-10-05T22:00:00Z'), 5, TZ), true);
});

test('Schaltjahr: Februar 2028 offen bis 05.03.2028', () => {
  assert.deepEqual(lastEditableDay('2028-02', 5), { year: 2028, month: 3, day: 5 });
  assert.deepEqual(firstLockedDay('2028-02', 5), { year: 2028, month: 3, day: 6 });
  assert.equal(isLocked('2028-01', at('2028-02-05T22:59:59Z'), 5, TZ), false);
});

test('aktueller Monat ist nie gesperrt', () => {
  assert.equal(isLocked('2026-11', at('2026-11-12T12:00:00Z'), 5, TZ), false);
});

test('currentMonth nutzt Berliner Zeit', () => {
  assert.equal(currentMonth(at('2026-11-30T23:30:00Z'), TZ), '2026-12');
});

test('isFuture', () => {
  assert.equal(isFuture('2026-12', at('2026-11-12T12:00:00Z'), TZ), true);
  assert.equal(isFuture('2026-11', at('2026-11-12T12:00:00Z'), TZ), false);
  assert.equal(isFuture('2026-10', at('2026-11-12T12:00:00Z'), TZ), false);
});

test('listMonths: aktueller bis Startmonat, neueste zuerst', () => {
  assert.deepEqual(listMonths('2026-11', at('2027-01-10T12:00:00Z'), TZ), ['2027-01', '2026-12', '2026-11']);
});

test('listMonths: Startmonat in der Zukunft ergibt leere Liste', () => {
  assert.deepEqual(listMonths('2026-12', at('2026-11-12T12:00:00Z'), TZ), []);
});

test('formatMonth und formatDay', () => {
  assert.equal(formatMonth('2026-11'), 'November 2026');
  assert.equal(formatMonth('2027-03'), 'März 2027');
  assert.equal(formatDay({ month: 12, day: 5 }), '05.12.');
});

test('parseRoom akzeptiert nur Ganzzahlen 1..roomCount', () => {
  assert.equal(parseRoom('12', 30), 12);
  for (const v of ['0', '31', 'abc', '1.5', '', ' 3', null]) {
    assert.equal(parseRoom(v, 30), null, `Wert ${JSON.stringify(v)}`);
  }
});

test('formatMonthShort', () => {
  assert.equal(formatMonthShort('2026-11'), 'Nov 2026');
  assert.equal(formatMonthShort('2027-03'), 'Mär 2027');
});

test('listMonthsAhead: Startmonat bis aktueller Monat + n, chronologisch', () => {
  assert.deepEqual(listMonthsAhead('2026-11', at('2026-12-03T09:00:00Z'), TZ, 3),
    ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
});

test('listMonthsAhead: Startmonat in der Zukunft beginnt beim Startmonat', () => {
  assert.deepEqual(listMonthsAhead('2026-12', at('2026-11-12T12:00:00Z'), TZ, 2),
    ['2026-12', '2027-01']);
});
