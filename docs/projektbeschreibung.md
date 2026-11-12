# Putzplan Proberäume – Projektbeschreibung für Claude Code

## Zusammenfassung

Schlanke, öffentlich erreichbare Web-App (Smartphone-first), in der Bands pro Proberaum und Monat abhaken, welche Aufgaben erledigt wurden. Zugriff ohne Login über einen Link, der später als QR-Code ausgehängt wird. Abgelaufene Monate werden automatisch gesperrt und können nur noch vom Admin geändert werden.

**Stack:** Cloudflare Worker (liefert Frontend und API) + Cloudflare KV (ein einziges JSON-Dokument). Kein Framework, kein Build-Schritt für das Frontend, keine relationale Datenbank.

**Vorgehen in Claude Code:** Mit Superpowers arbeiten – `superpowers:brainstorming` nur für die offenen Punkte unten, danach `superpowers:writing-plans`, Umsetzung per `superpowers:test-driven-development` (vor allem die Sperrlogik).

---

## 1. Anforderungen

### Bestätigt

| Bereich | Anforderung |
|---|---|
| Zugriff | Öffentlich, kein Login für Bands; Link wird später als QR-Code bereitgestellt |
| Wer trägt ein | Jede Band selbst, nur über die Proberaum-Nummer |
| Proberäume | Nummer 1–30 auswählbar (Anzahl konfigurierbar halten) |
| Struktur | Monate werden aufgelistet; pro Monat und Raum Aufgaben abhakbar |
| Aufgaben | Putzen, Müll rausbringen, Putzzeug kaufen |
| Zusatzfeld | Optionales Kommentarfeld pro Raum und Monat |
| Datenschutz | Keine Namen, kein Datum/Zeitstempel speichern |
| Sperre | Monat wird nach Monatsende mit **5 Tagen Puffer** gesperrt |
| Admin | Darf gesperrte Monate ändern; Anmeldung über ein einzelnes Passwort, serverseitig geprüft |
| Hosting | Kostenlos (Cloudflare Free Plan) |
| Speicherung | Ein JSON-Dokument in Cloudflare KV, keine Datenbank |
| Geräte | Fokus ausschließlich Smartphone |
| Nicht benötigt | Erinnerungen/Benachrichtigungen, Kostenerfassung, Export |

### Annahmen (vor Umsetzung bestätigen oder anpassen)

| # | Annahme |
|---|---|
| A1 | Angezeigt werden der aktuelle Monat und die vergangenen Monate ab einem konfigurierbaren Startmonat (Default: aktueller Monat beim ersten Deployment). Zukünftige Monate werden nicht angezeigt. |
| A2 | Neueste Monate oben, aktueller Monat hervorgehoben. |
| A3 | Gewählter Raum wird im Browser (`localStorage`) gemerkt. |
| A4 | Zusätzlich URL-Parameter `?raum=12`, damit pro Proberaum ein eigener QR-Code möglich ist (Raum ist dann vorausgewählt). |
| A5 | Speichern erfolgt automatisch bei jeder Änderung (Checkbox sofort, Kommentar mit Debounce bzw. beim Verlassen des Feldes). |
| A6 | Kommentar max. 200 Zeichen, reiner Text. |
| A7 | Zeitzone für die Sperrlogik: `Europe/Berlin`. |
| A8 | Admin kann auch abgehakte Einträge zurücksetzen und Kommentare löschen. |

---

## 2. Fachliche Regeln

### Sperrlogik (Kernregel)

- Monat `M` ist **editierbar bis einschließlich zum 5. Tag des Folgemonats, 23:59:59 Europe/Berlin**.
- Ab dem **6. Tag des Folgemonats, 00:00 Europe/Berlin** ist `M` gesperrt.
- Beispiel: November 2026 ist bis 05.12.2026 23:59:59 editierbar, ab 06.12.2026 00:00 gesperrt.
- Prüfung erfolgt **serverseitig** (maßgeblich) und clientseitig (nur Anzeige).
- Pufferdauer als Konstante/Konfiguration (`LOCK_GRACE_DAYS = 5`).
- Zukünftige Monate sind nicht editierbar (siehe A1).

### Rechte

| Rolle | Offene Monate | Gesperrte Monate |
|---|---|---|
| Band (öffentlich) | lesen + schreiben | nur lesen |
| Admin (Passwort) | lesen + schreiben | lesen + schreiben |

---

## 3. Datenmodell (KV)

Ein KV-Key, z. B. `putzplan`, mit folgendem JSON:

```json
{
  "version": 1,
  "entries": {
    "2026-11": {
      "12": {
        "putzen": true,
        "muell": false,
        "putzzeug": true,
        "kommentar": "Staubsauger defekt"
      }
    }
  }
}
```

- Schlüssel Monat: `YYYY-MM`; Schlüssel Raum: Nummer als String.
- Nicht vorhandene Einträge = alles `false`, Kommentar leer.
- Keine Namen, keine Zeitstempel.

---

## 4. API (Worker)

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/` | Liefert die HTML-Seite (inkl. CSS/JS inline) |
| `GET` | `/api/data` | Liefert alle Einträge + Konfiguration (Raumanzahl, Startmonat, Lock-Status je Monat, Serverzeit) |
| `PUT` | `/api/entry` | Speichert einen Eintrag für einen Monat/Raum |
| `POST` | `/api/admin/check` | Prüft das Admin-Passwort (für UI-Anmeldung) |

### `PUT /api/entry`

Request:

```json
{ "monat": "2026-11", "raum": 12, "putzen": true, "muell": false, "putzzeug": true, "kommentar": "..." }
```

- Optionaler Header `X-Admin-Password` für Änderungen an gesperrten Monaten.
- Validierung: Monatsformat, Monat nicht in der Zukunft, nicht vor Startmonat, Raum 1–`ROOM_COUNT`, Booleans, Kommentar ≤ 200 Zeichen.
- Antworten: `200` OK, `400` ungültige Eingabe, `403` Monat gesperrt / falsches Admin-Passwort.
- Server liest JSON, ändert nur den betroffenen Eintrag, schreibt JSON zurück.

---

## 5. Admin

- Passwort als Worker-Secret `ADMIN_PASSWORD` (`wrangler secret put ADMIN_PASSWORD`), **nie im Code oder Repo**.
- Vergleich zeitkonstant.
- UI: dezenter „Admin"-Button → Passwortfeld → Admin-Modus; Passwort nur in `sessionStorage`, „Abmelden" löscht es.
- Im Admin-Modus sind gesperrte Monate editierbar und sichtbar als „gesperrt (Admin-Bearbeitung)" markiert.

---

## 6. Oberfläche (Mobile-first)

- Sticky Header: Titel „Putzplan Proberäume" + Dropdown „Proberaum 1–30".
- Darunter Monatskarten (neueste oben):
  - Monatsname (z. B. „November 2026"), Status-Badge: „aktuell", „offen bis 05.12.", „gesperrt 🔒".
  - Drei große Checkboxen/Toggles: Putzen, Müll rausbringen, Putzzeug kaufen.
  - Kommentarfeld (einzeilig oder kleines Textarea).
  - Gesperrte Monate: ausgegraut, Controls deaktiviert.
- Kurzes Feedback nach Speichern („Gespeichert" / Fehlermeldung bei Netzwerkfehler oder 403).
- Ohne gewählten Raum: Hinweis „Bitte Proberaum wählen", keine Karten.
- Große Touch-Ziele (≥ 44 px), gut lesbar, kein horizontales Scrollen, deutsche Texte.
- Kein externes CDN, keine Frameworks; alles in einer HTML-Datei.

---

## 7. Projektstruktur (Vorschlag)

```
putzplan/
├── src/
│   ├── worker.js        # Routing, API, KV-Zugriff
│   ├── lock.js          # Sperrlogik (rein, testbar)
│   ├── validate.js      # Eingabevalidierung
│   └── index.html       # Frontend (HTML/CSS/JS inline), wird vom Worker ausgeliefert
├── test/
│   ├── lock.test.js
│   ├── validate.test.js
│   └── api.test.js
├── wrangler.toml
├── package.json
└── README.md            # Setup, Deployment, Admin-Passwort setzen, QR-Code
```

Konfiguration über `wrangler.toml` `[vars]`: `ROOM_COUNT = 30`, `START_MONTH = "2026-11"`, `LOCK_GRACE_DAYS = 5`, `TIMEZONE = "Europe/Berlin"`.

---

## 8. Umsetzungsphasen

1. **GUI-Prototyp**
   `index.html` standalone lauffähig, Speicherung zunächst in `localStorage`, Admin-Passwort-Platzhalter. Ziel: Bedienung am Handy testen.
2. **Sperrlogik + Tests**
   `lock.js` per TDD inkl. Randfälle (Monatswechsel, Jahreswechsel Dez→Jan, Schaltjahr, Sommer-/Winterzeit, genau 00:00 am 6.).
3. **Worker + KV**
   API aus Abschnitt 4, Frontend auf API umstellen, lokal mit `wrangler dev` testen.
4. **Admin**
   Secret, Prüfung, Admin-Modus in der UI.
5. **Deployment**
   Cloudflare-Account (Free), KV-Namespace anlegen, Secret setzen, `wrangler deploy`, URL testen, QR-Code(s) erzeugen (gesamt und optional pro Raum via `?raum=N`).

---

## 9. Akzeptanzkriterien

- [ ] Seite lädt auf dem Smartphone ohne Login, ohne horizontales Scrollen.
- [ ] Raum 1–30 auswählbar, Auswahl bleibt nach Neuladen erhalten; `?raum=N` wählt Raum vor.
- [ ] Aufgaben und Kommentar werden gespeichert und sind auf einem anderen Gerät sichtbar.
- [ ] Am 05. des Folgemonats 23:59 ist der Vormonat editierbar, am 06. 00:00 (Europe/Berlin) gesperrt.
- [ ] Gesperrte Monate lassen sich ohne Admin-Passwort weder per UI noch per direktem API-Aufruf ändern (`403`).
- [ ] Mit korrektem Admin-Passwort lassen sich gesperrte Monate ändern; falsches Passwort → `403`.
- [ ] Admin-Passwort steht nicht im Repository.
- [ ] Es werden keine Namen oder Zeitstempel gespeichert.
- [ ] Kommentar wird als Text ausgegeben (kein HTML/XSS möglich), max. 200 Zeichen.
- [ ] Tests für Sperrlogik und Validierung laufen grün.
- [ ] Betrieb komplett im Cloudflare Free Plan.

---

## 10. Bekannte Einschränkungen und Risiken

| Thema | Auswirkung | Umgang |
|---|---|---|
| KV ist „eventually consistent", ein Dokument für alle | Schreiben zwei Bands fast gleichzeitig, kann eine Änderung verloren gehen; Änderungen sind auf anderen Geräten ggf. erst nach bis zu ~60 s sichtbar | Bei geringer Nutzung akzeptabel. Falls problematisch: Umstieg auf Durable Objects oder D1 (ebenfalls kostenlos nutzbar) |
| Öffentlicher Zugriff ohne Login | Jeder mit Link kann Einträge jedes Raums ändern | Bewusst akzeptiert; Admin kann korrigieren |
| Einfaches Admin-Passwort | Brute-Force theoretisch möglich | Starkes Passwort; optional einfache Verzögerung bei Fehlversuchen |
| KV-Limits Free Plan | Begrenzte Schreibvorgänge pro Tag | Für ~30 Räume weit ausreichend; Limits vor Deployment in der aktuellen Cloudflare-Doku prüfen |

---

## 11. Offene Punkte

- Annahmen A1–A8 bestätigen.
- Startmonat festlegen.
- Ein QR-Code für alle oder zusätzlich einer pro Proberaum?
- Gewünschte Domain (Standard: `*.workers.dev`).
