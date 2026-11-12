# Putzplan Proberäume – Design

Grundlage: [`docs/projektbeschreibung.md`](../../projektbeschreibung.md) (vollständige Anforderungen). Dieses Dokument hält nur die Entscheidungen zu den offenen Punkten und die Umsetzungsdetails fest.

## Zweck

Bands haken pro Proberaum und Monat ab, ob Putzen, Müll rausbringen und Putzzeug kaufen erledigt wurden. Kein Login, Zugriff per Link/QR-Code, Smartphone-first. Abgelaufene Monate sperren automatisch (Monatsende + 5 Tage, Europe/Berlin); nur der Admin kann sie ändern.

## Entscheidungen zu den offenen Punkten

| Punkt | Entscheidung |
|---|---|
| A1–A8 | Alle wie in der Projektbeschreibung übernommen |
| Startmonat | `2026-11` |
| QR-Code | Ein QR-Code für alle (Startseite). `?raum=N` bleibt technisch unterstützt (A4) |
| Domain | `*.workers.dev` |

## Ansätze

| Ansatz | Bewertung |
|---|---|
| **Cloudflare Worker + KV, ein JSON-Dokument** | Gewählt (Vorgabe der Projektbeschreibung). Kostenlos, minimal, kein Build |
| Worker + D1 / Durable Objects | Konsistenter bei gleichzeitigen Schreibzugriffen, aber mehr Aufwand; nur nötig, falls verlorene Änderungen in der Praxis auftreten |
| Statische Seite + Drittanbieter-Backend | Verworfen: zusätzliche Abhängigkeit, Admin-Prüfung nicht sauber serverseitig |

## Umsetzung

### Struktur

```
src/
  lock.js       Sperrlogik (rein, testbar)
  validate.js   Eingabevalidierung
  api.js        Request-Handling (Routing, KV, Admin) – ohne HTML-Import, dadurch in Node testbar
  worker.js     Einstiegspunkt: importiert index.html als Text und api.js
  index.html    Frontend (HTML/CSS/JS inline)
test/
  lock.test.js, validate.test.js, api.test.js   (node:test, Fake-KV)
scripts/
  qr.mjs        Erzeugt qr.svg für die produktive URL
wrangler.toml, package.json, README.md
```

### Sperrlogik

- `isLocked(monat, now, graceDays, tz)`: gesperrt ab dem `graceDays + 1`-ten Tag des Folgemonats, 00:00 in `tz`.
- Umsetzung über `Intl.DateTimeFormat` (Datum in `tz` ermitteln) statt Offset-Rechnung, damit Sommer-/Winterzeit korrekt sind.
- `isFuture(monat, now, tz)`, `listMonths(startMonth, now, tz)` (aktueller Monat bis Startmonat, neueste zuerst).
- Tests: Monatswechsel, Dez→Jan, Schaltjahr (Feb 2028), Zeitumstellung, genau 05. 23:59:59 vs. 06. 00:00 Berliner Zeit.

### API

Wie in der Projektbeschreibung, Abschnitt 4. Zusätzlich:
- `GET /api/data` liefert `{ config: { roomCount, startMonth, graceDays }, now, months: [{ monat, locked, lockDate }], entries }`.
- Falsches Admin-Passwort: Antwort nach 1 s Verzögerung (einfacher Brute-Force-Schutz). *(meine Entscheidung)*
- Zeitkonstanter Vergleich über SHA-256-Digest beider Werte und XOR-Vergleich.
- Kein `ADMIN_PASSWORD` gesetzt → Admin-Funktionen deaktiviert (`403`).
- Unbekannte Felder im Request werden ignoriert, gespeichert werden nur die vier Felder.

### Frontend

Wie Abschnitt 6 der Projektbeschreibung. Kommentar wird nur über `textContent`/`value` gesetzt (kein `innerHTML` mit Nutzerdaten). Vorbedingung `?raum=N` hat Vorrang vor `localStorage`.

## Bewusste Abweichungen / meine Entscheidungen

- **Phase 1 (localStorage-Prototyp) entfällt** als eigener Schritt: das Frontend wird direkt gegen die API gebaut und lokal mit `wrangler dev` getestet. Spart Doppelarbeit.
- Tests mit `node:test` statt zusätzlichem Test-Framework; einzige Dev-Abhängigkeiten: `wrangler`, `qrcode` (nur für das QR-Skript).
- Deployment (Cloudflare-Account, KV-Namespace, Secret, `wrangler deploy`) führst du selbst aus – ich habe keinen Zugang zu deinem Cloudflare-Account. Die README beschreibt die Schritte; die KV-ID wird danach in `wrangler.toml` eingetragen.

## Nicht-Ziele

Erinnerungen, Kostenerfassung, Export, Namen, Zeitstempel, Desktop-Optimierung.
