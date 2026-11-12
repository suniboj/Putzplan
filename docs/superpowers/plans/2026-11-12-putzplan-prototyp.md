# Putzplan Prototyp (Phase 1 + Sperrlogik) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Am Handy testbarer Prototyp der Putzplan-Oberfläche als claude.ai-Artifact, Speicherung lokal im Browser, mit getesteter Sperrlogik, die später unverändert im Worker verwendet wird.

**Architecture:** `src/lock.js` ist ein reines ES-Modul ohne Abhängigkeiten (Node-Tests + Browser + später Worker). `src/index.html` importiert es per `<script type="module">` und kapselt alle Datenzugriffe in einem `store`-Objekt (Phase 1: `localStorage`; Phase 3: API). Veröffentlichung als Artifact mit `lock.js` als Zusatzdatei.

**Tech Stack:** Vanilla HTML/CSS/JS, Node 22 `node:test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-12-putzplan-design.md`, `docs/projektbeschreibung.md`

## Global Constraints

- Räume `1..ROOM_COUNT`, `ROOM_COUNT = 30`; `START_MONTH = "2026-11"`; `LOCK_GRACE_DAYS = 5`; `TIMEZONE = "Europe/Berlin"`.
- Monat `M` editierbar bis 5. des Folgemonats 23:59:59 Europe/Berlin, gesperrt ab 6. 00:00.
- Aufgaben-Keys `putzen`, `muell`, `putzzeug`; Labels „Putzen", „Müll rausbringen", „Putzzeug kaufen"; `kommentar` max. 200 Zeichen, reiner Text.
- Datenmodell exakt wie Projektbeschreibung §3 (`{version:1, entries:{"YYYY-MM":{"12":{…}}}}`), keine Namen, keine Zeitstempel.
- Smartphone-first, Touch-Ziele ≥ 44 px, kein horizontales Scrollen, deutsche Texte, kein CDN, kein Framework.
- Nutzertext nie über `innerHTML`.

## Review Focus

- Zeitumstellung (letzter So. im März/Oktober): Sperrgrenze muss Berliner Mitternacht bleiben → Tests in Task 1.
- Gerät in anderer Zeitzone (z. B. UTC-Browser): Anzeige muss Berliner Zeit verwenden → Test `isLocked` mit UTC-Instants in Task 1.
- `?raum=` ungültig (`0`, `31`, `abc`): ignorieren, auf gemerkten Raum/keinen Raum zurückfallen → `parseRoom`-Test in Task 1.
- `localStorage` blockiert (privater Modus, Artifact-Vorschau): Seite muss trotzdem laufen, Speichern meldet Fehler → try/catch im `store`, manuell geprüft in Task 3.
- Kommentar mit HTML (`<img onerror=…>`) muss als Text erscheinen → manuelle Prüfung in Task 3.

---

### Task 1: Sperrlogik `src/lock.js` (TDD)

**Files:**
- Create: `package.json` (`"type": "module"`, script `"test": "node --test test/"`), `.gitignore` (`node_modules`, `.wrangler`)
- Create: `src/lock.js`
- Test: `test/lock.test.js`

**Interfaces – Produces (alle Monate als `"YYYY-MM"`, `now` als `Date`):**
- `zonedDate(now: Date, tz: string) -> {year, month, day}` (Kalenderdatum in `tz`, via `Intl.DateTimeFormat('en-CA', {timeZone})`)
- `currentMonth(now, tz) -> string`
- `firstLockedDay(monat, graceDays) -> {year, month, day}` = Tag `graceDays+1` des Folgemonats
- `lastEditableDay(monat, graceDays) -> {year, month, day}` = Tag `graceDays` des Folgemonats
- `isLocked(monat, now, graceDays, tz) -> boolean` (Vergleich des Kalenderdatums in `tz` mit `firstLockedDay`, keine Offset-Rechnung)
- `isFuture(monat, now, tz) -> boolean`
- `listMonths(startMonth, now, tz) -> string[]` (aktueller bis Startmonat, neueste zuerst; leer, wenn Start in der Zukunft)
- `formatMonth(monat) -> string` („November 2026")
- `formatDay({month, day}) -> string` („05.12.")
- `parseRoom(value: string|null, roomCount: number) -> number|null` (nur Ganzzahl 1..roomCount)

- [ ] **Step 1: Failing tests schreiben** (`test/lock.test.js`, `node:test` + `assert/strict`), Zeitpunkte als UTC-Instants:
  - `isLocked('2026-11', new Date('2026-12-05T22:59:59Z'), 5, TZ) === false` (05.12. 23:59:59 MEZ)
  - `isLocked('2026-11', new Date('2026-12-05T23:00:00Z'), 5, TZ) === true` (06.12. 00:00 MEZ)
  - Jahreswechsel: `isLocked('2026-12', '2027-01-05T22:59:59Z') === false`, `'2027-01-05T23:00:00Z' === true`
  - Sommerzeit: `isLocked('2027-03', '2027-04-05T21:59:59Z') === false`, `'2027-04-05T22:00:00Z' === true` (MESZ, UTC+2)
  - Schaltjahr: `lastEditableDay('2028-02', 5)` → `{year:2028, month:3, day:5}`; `isLocked('2028-01', '2028-02-05T22:59:59Z') === false`
  - Zeitumstellungsmonat: `isLocked('2026-09', '2026-10-05T21:59:59Z') === false`, `'2026-10-05T22:00:00Z' === true`
  - `currentMonth(new Date('2026-11-30T23:30:00Z'), TZ) === '2026-12'` (Berlin schon Dezember)
  - `isFuture('2026-12', new Date('2026-11-12T12:00:00Z'), TZ) === true`, `isFuture('2026-11', …) === false`
  - `listMonths('2026-11', new Date('2027-01-10T12:00:00Z'), TZ)` → `['2027-01','2026-12','2026-11']`; `listMonths('2026-12', new Date('2026-11-12T12:00:00Z'), TZ)` → `[]`
  - `formatMonth('2026-11') === 'November 2026'`, `formatMonth('2027-03') === 'März 2027'`, `formatDay({month:12, day:5}) === '05.12.'`
  - `parseRoom('12', 30) === 12`; `parseRoom('0',30)`, `('31',30)`, `('abc',30)`, `('1.5',30)`, `(null,30)` → `null`

- [ ] **Step 2: Tests laufen lassen** – `npm test` → FAIL (Modul fehlt)
- [ ] **Step 3: `src/lock.js` implementieren** gemäß Interfaces; deutsche Monatsnamen als feste Liste (kein `Intl`, damit unabhängig von Locale-Daten).
- [ ] **Step 4: Tests laufen lassen** – `npm test` → alle PASS
- [ ] **Step 5: Commit** – `git add package.json .gitignore src/lock.js test/lock.test.js && git commit -m "feat: Sperrlogik mit Tests"`

### Task 2: Frontend-Prototyp `src/index.html`

**Files:**
- Create: `src/index.html`

**Interfaces:**
- Consumes: alle Exporte aus `src/lock.js` via `import … from './lock.js'`
- Produces: `store` mit `async load() -> {entries}`, `async save(monat, raum, entry) -> void` (wirft bei Fehler), `async checkAdmin(pw) -> boolean`. Phase 1: `localStorage`-Key `putzplan-data` (Datenmodell §3), Admin-Platzhalter `pw === 'admin'`. Raum gemerkt unter `putzplan-raum`, Admin-Passwort in `sessionStorage` `putzplan-admin`.

- [ ] **Step 1: `artifact-design`-Skill laden** und Vorgaben (Titel, Farb-Tokens hell/dunkel, 16 px Rand) übernehmen.
- [ ] **Step 2: Seite bauen** nach Projektbeschreibung §6:
  - Sticky Header „Putzplan Proberäume" + `<select>` „Proberaum wählen" / „Proberaum 1"…„30".
  - Raum-Vorauswahl: `parseRoom(URL ?raum)` vor `localStorage`.
  - Ohne Raum: Hinweis „Bitte Proberaum wählen".
  - Je Monat aus `listMonths` eine Karte: Monatsname, Badge „aktuell" (aktueller Monat) / „offen bis DD.MM." (vergangen, offen) / „gesperrt 🔒"; im Admin-Modus bei gesperrt „gesperrt (Admin-Bearbeitung)".
  - Drei Toggles (Label + Checkbox, ganze Zeile klickbar, ≥ 44 px) und Kommentarfeld (`maxlength=200`, Zeichenzähler).
  - Gesperrt ohne Admin: Controls `disabled`, Karte ausgegraut.
  - Checkbox speichert sofort; Kommentar mit 600 ms Debounce und bei `blur`.
  - Status-Toast „Gespeichert" / „Speichern fehlgeschlagen" / „Monat ist gesperrt".
  - Vor jedem Speichern Sperre erneut prüfen (Seite kann über Mitternacht offen sein).
  - Footer: Button „Admin" → Passwortfeld → Admin-Modus; „Abmelden" löscht `sessionStorage`. Prototyp-Hinweis „Prototyp: Daten nur auf diesem Gerät gespeichert".
- [ ] **Step 3: Commit** – `git add src/index.html && git commit -m "feat: Frontend-Prototyp mit lokaler Speicherung"`

### Task 3: Prüfen am Handy-Viewport und als Artifact veröffentlichen

**Files:**
- Create (Scratchpad, nicht im Repo): Playwright-Prüfskript

- [ ] **Step 1: Lokal ausliefern** – `python3 -m http.server` im Ordner `src/` (Module brauchen HTTP).
- [ ] **Step 2: Playwright-Prüfung** mit `devices['iPhone 13']`, Uhrzeit per `page.clock.setFixedTime` auf `2026-12-03T10:00:00+01:00` und `2026-12-06T00:00:01+01:00`:
  - kein horizontales Scrollen (`scrollWidth <= clientWidth`)
  - `?raum=12` wählt Raum 12; Neuladen ohne Parameter behält 12; `?raum=99` wird ignoriert
  - Häkchen + Kommentar bleiben nach Neuladen erhalten
  - am 06.12. ist November gesperrt, Controls disabled; nach Admin-Login (`admin`) editierbar
  - Kommentar `<img src=x onerror=alert(1)>` erscheint als Text, kein Dialog
  - Screenshot zur Sichtprüfung
  Erwartet: alle Prüfungen OK.
- [ ] **Step 3: Artifact veröffentlichen** – `file_path: src/index.html`, `files: {"lock.js": "src/lock.js"}`, `icon: "broom"`.
- [ ] **Step 4: Push** – `git push -u origin ccr-14b3c9b6-42xtna`
