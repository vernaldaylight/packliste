# Packliste

Aus einem festen Item-Katalog und einem beschriebenen Reise-Profil wird automatisch
eine vollständige Packliste — mit Mengen, gruppiert nach Kategorie, abhakbar.

Reine Browser-App. Kein Backend, keine Datenbank, keine Konten.

## Loslegen

```bash
npm install
npm run dev          # Dev-Server mit Hot-Reload auf http://localhost:5173
```

Die App startet ohne Katalog und zeigt die Aufforderung. Zwei Wege führen hinein:

- **Aus GitHub holen** — braucht Netz, ein hinterlegtes Token und das private
  Daten-Repo (siehe „Synchronisierung einrichten")
- **Katalog auswählen** — die Datei über die Dateiauswahl holen. Braucht kein Netz
  und kein Token; auf einem frischen Gerät unterwegs ist das der einzige Weg

Danach bleibt der Katalog im `localStorage` des Browsers.

```bash
npm test             # 81 Tests: Regel-Engine, Persistenz, Synchronisierung
npm run build        # dist/ — nur die App-Hülle
```

Es gibt bewusst kein `npm run katalog` mehr — siehe „Katalog pflegen".

## Aufbau

```
src/
  engine.js     Regel-Engine und Mengenformel — reine Funktionen, testbar ohne DOM
  store.js      localStorage, Validierung, Datei-Import, Backup, Share-Export
  sync.js       GitHub-Contents-API — reine Funktionen plus injizierbarer Netzrand
  main.js       App-Start, Zustand, Router
  ui/           die fünf Ansichten; syncUi.js trägt Einstellungen und Konfliktdialog
tests/
  engine.test.js  Regel-Engine gegen den Fixture; zusätzlich gegen den echten Katalog
  store.test.js   Persistenz, Validierung, Export-Rundlauf, Zusammenführen
  sync.test.js    Kodierung, Antwortdeutung, Konflikt — gegen eine fetch-Attrappe
  fixtures/
    katalog.synthetisch.json   erfundener Katalog: alle 11 Kategorien, alle 3 Regeln
  smoke.html      Rauchtest im echten Browser (siehe unten)
vite.config.js    base für den Pages-Pfad, nur beim Bauen gesetzt
.github/workflows/deploy.yml   baut, testet und veröffentlicht auf GitHub Pages
```

**Der echte Katalog liegt nicht in diesem Repo**, sondern im privaten
`packliste-daten` — er nennt Medikamente und ist nichts für ein öffentliches Repo.
`katalog.json`, die Rohquellen und die Import-Werkzeuge sind mit ihm zusammen
dorthin gezogen; hier gibt es sie nicht mehr.

Die Tests laufen deshalb gegen einen **erfundenen** Katalog in `tests/fixtures/`.
Der prüft die Struktur (elf Kategorien, drei Mengenregeln, Sortierung), nicht die
echten Item-Namen. Liegt `katalog.json` aus dem Daten-Repo daneben, laufen
zusätzlich die Tests gegen den echten Katalog; fehlt er, überspringen die sich selbst.

## Die Auswahllogik

```
tripTags = {saison} ∪ aktivitaeten ∪ {verkehrsmittel} ∪ {unterkunft}
           ∪ zusatz_tags ∪ {"Allgemein"}   \ entfernte_tags

Item überspringen, wenn nicht_mit ∩ tripTags ≠ ∅
Item aufnehmen,   wenn tags      ∩ tripTags ≠ ∅
```

`Allgemein` ist implizit in jeder Reise. Verkehrsmittel und Unterkunft sind keine
Sonderfälle, sondern Tag-Quellen — es gibt kein Regelwerk und keine Warnungen.

## Mengen

| Variante | Felder | Beispiel | Ergebnis bei 10 Tagen |
|---|---|---|---|
| `einmal` | — | Zahnbürste | 1 |
| `fest` | `n` | Badehose | n |
| `pro_tage` | `n`, `pro_tage`, `max` | T-Shirt: 1 pro 3 Tage, max 6 | 4 |

Formel: `min(ceil(reisetage / pro_tage) * n, max)`

## Synchronisierung einrichten

Katalog und Reisen liegen im **privaten** Repo `packliste-daten`. Die App liest und
schreibt es über die GitHub-Contents-API, direkt aus dem Browser — kein Proxy, kein
Server. Der Abgleich läuft **nur auf Knopfdruck**: nie beim Start, nie im
Hintergrund. Ohne Netz läuft die App vollständig aus dem `localStorage` weiter.

**1 · Repo anlegen** (falls noch nicht da)

```bash
gh repo create packliste-daten --private
```

**2 · Token erzeugen** — bei GitHub unter *Settings → Developer settings →
Personal access tokens → Fine-grained tokens → Generate new token*:

| Feld | Wert |
|---|---|
| Resource owner | dein Konto |
| Repository access | **Only select repositories** → `packliste-daten` |
| Repository permissions | **Contents: Read and write** — sonst nichts |
| Expiration | nach Wahl; wenn es abläuft, scheitert der Sync mit einem `401` |

> **Nimm nicht dein `gh`-Login-Token.** `gh auth token` trägt den `repo`-Scope über
> **alle** Repositories. Das fein granulierte Token gilt für genau eines.

Das Token ist ein Passwort. Es liegt ausschließlich im `localStorage` dieses
Browsers, steht nie im Code, nie im Build und nie in einer Meldung. Wer das
entsperrte Gerät in die Hand bekommt, kommt daran — deshalb ein Ablaufdatum, und im
Verdachtsfall: bei GitHub widerrufen. Der Verlust kostet dann nur den Sync.

**3 · In der App eintragen** — *Katalog & Daten → Synchronisierung*: `owner/name`
des **Daten-Repos** und das Token. „Token löschen" entfernt nur das Token; das Repo
bleibt stehen.

**4 · Erste Füllung** — `katalog.json` ins Daten-Repo legen und committen, dann in
der App *Katalog & Daten → Aus GitHub holen*. `reisen.json` wird nicht vorab
angelegt: der erste „Hochschieben"-Klick erzeugt sie.

### Was die drei Knöpfe tun

| Knopf | Ablauf |
|---|---|
| **Katalog holen** | Lädt `katalog.json`, prüft ihn und übernimmt ihn erst dann. Ein unbrauchbarer Stand drüben lässt den hiesigen unangetastet |
| **Hochschieben** | Liest vorher die `sha`, schreibt dann mit ihr. Liegt drüben inzwischen etwas anderes, wird **nichts** geschrieben und der Konflikt gemeldet |
| **Holen** | Führt über die `id` zusammen: gleiche Reise wird ersetzt, neue kommen dazu, hiesige bleiben |

Der Katalog geht nur **eine** Richtung — die App schreibt ihn nie. Er wird am Mac
bearbeitet; damit schrumpft die Schreibfläche des Tokens auf `reisen.json`.

**Hochschieben ersetzt, was drüben liegt.** Liegt dort eine Reise, die es hier nicht
gibt, fragt die App vorher nach. Die `sha` allein fängt das nicht — sie erkennt nur,
ob *während* des Schreibens jemand anders geschrieben hat, nicht eine früher
angelegte Reise des zweiten Geräts. Wer sichergehen will: erst **Holen**, dann
hochschieben.

## Rauchtest im Browser

`tests/smoke.html` klickt sich in einem echten Browser durch alle fünf Ansichten —
Liste erzeugen, abhaken, Menge ändern, Item entfernen und von Hand hinzufügen,
Tag-Ableitung, Katalogansicht samt Sync-Bedienung, Retro, und zuletzt den leeren
Zustand ohne Katalog. Er prüft genau die Dinge, die ein Node-Test nicht sieht — unter
anderem, dass das Token nirgends im DOM landet.

```bash
npm run dev   # in einem zweiten Terminal laufen lassen

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --user-data-dir=/tmp/packliste-smoke \
  --virtual-time-budget=25000 --dump-dom http://localhost:5173/tests/smoke.html \
  | python3 -c "import sys,re,html; s=sys.stdin.read(); m=re.search(r'<pre id=\"ergebnis\">(.*?)</pre>', s, re.S); print(html.unescape(m.group(1)))"
```

## Katalog pflegen

Am Mac entsteht der Katalog, am Handy wird er benutzt. Änderungen laufen **im Daten-
Repo** über `katalog.json` und einen Commit — es gibt im MVP bewusst keinen
Katalog-Editor in der UI (der kommt mit FF-16).

Also dort klonen, nicht hier:

```bash
git clone git@github.com:<du>/packliste-daten.git
```

Dort liegen auch die Rohquellen (`quellen/`) und die Import-Werkzeuge (`import/`).
Der Import läuft entsprechend **im Daten-Repo**, nicht in diesem:

**`katalog.json` wird von Hand gepflegt.** Der Excel-Import ist einmal gelaufen und
danach totgelegt: `mapping.json` und `import.mjs` kennen nur die Quelltabelle und
wissen nichts von umbenannten, gelöschten oder neu getaggten Items. Ein Lauf mit
`--write` würde diese Arbeit überschreiben, deshalb ist der Schreibpfad gesperrt
(`--trotzdem-schreiben` nötig).

Der **Trockenlauf** bleibt offen und ist weiter nützlich — er liest die Excel, prüft
gegen `erwartungen.json` und schreibt nur `import/import-report.md`:

```bash
node import/import.mjs        # nur lesen, prüfen, Report
```

Die Datei ist nach `name` sortiert (`localeCompare` mit Locale `de`). Wer Items
einfügt oder umbenennt, sortiert neu — sonst wandert die Zeile ans falsche Ende.

Damit eine Änderung am Handy ankommt: committen und pushen, dann in der App
*Katalog & Daten → Aus GitHub holen*. Am Handy ist der Katalog read-only.

## Deployment

**GitHub Pages**, gebaut von `.github/workflows/deploy.yml` bei jedem Push auf
`main`: <https://vernaldaylight.github.io/packliste/>. Der Workflow lässt vorher
`npm test` laufen — fällt ein Test, wird nicht veröffentlicht.

Das Deployment enthält **nur die App-Hülle** — kein Katalog, keine Reisen. Die URL
darf deshalb öffentlich sein.

Zwei Eigenheiten, die man beim Nachbauen kennen muss:

- **`base` in `vite.config.js`.** Eine Projekt-Seite liegt unter `/packliste/`, nicht
  an der Wurzel. Ohne `base` zeigen alle Asset-Pfade ins Leere und die Seite bleibt
  weiß — der häufigste Grund, warum ein Pages-Deploy „nichts tut". Gesetzt wird es
  **nur beim Bauen**, damit Entwicklungsserver, Rauchtest und die absoluten
  Fixture-Pfade unverändert bleiben.
- **Hash-Routing statt History-API.** `#/liste/xyz` sieht der Server nie, also
  braucht es keine `404.html`-Krücke für Deep-Links.

Was wirklich ausgeliefert wird, prüft man mit `npm run preview` — das liefert `dist/`
unter demselben `/packliste/`-Pfad aus wie Pages.

Katalog und `import/` liegen aus genau diesem Grund in einem **eigenen privaten
Repo** und nicht hier: ein einmal veröffentlichter Stand wäre über Forks, Caches und
Archive nicht mehr zurückzuholen. Der Build sieht die Dateien gar nicht mehr.
