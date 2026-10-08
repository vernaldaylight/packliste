# Packliste

Aus einem festen Item-Katalog und einem beschriebenen Reise-Profil wird automatisch
eine vollständige Packliste — mit Mengen, gruppiert nach Kategorie, abhakbar.

Reine Browser-App. Kein Backend, keine Datenbank, keine Konten.

## Loslegen

```bash
npm install
npm run dev          # Dev-Server mit Hot-Reload auf http://localhost:5173
```

Die App startet ohne Katalog und zeigt die Import-Aufforderung. `daten/katalog.json`
über den Knopf auswählen — danach bleibt er im `localStorage` des Browsers.

```bash
npm test             # 52 Tests: Regel-Engine und Persistenz
npm run build        # dist/ — nur die App-Hülle
```

Es gibt bewusst kein `npm run katalog` mehr — siehe „Katalog pflegen".

## Aufbau

```
src/
  engine.js     Regel-Engine und Mengenformel — reine Funktionen, testbar ohne DOM
  store.js      localStorage, Datei-Import, Backup, Share-Export
  main.js       App-Start, Zustand, Router
  ui/           die fünf Ansichten
daten/
  katalog.json  der Schatz — im git, NICHT deployt
import/
  import.mjs    einmalig gelaufen: quellen/packliste.xlsx -> daten/katalog.json
                danach totgelegt, siehe „Katalog pflegen"
  mapping.json  die Entscheidungen des Imports (Kategorien, Tags, Ausnahmen)
  erwartungen.json  Regressionstest gegen stilles Falschsortieren
tests/
  engine.test.js  Regel-Engine, inkl. echter Katalog
  store.test.js   Persistenz, Validierung, Export-Rundlauf
  smoke.html      Rauchtest im echten Browser (siehe unten)
quellen/        private Excel-Quellen — nicht versioniert
```

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

## Rauchtest im Browser

`tests/smoke.html` klickt sich in einem echten Browser durch alle fünf Ansichten —
Liste erzeugen, abhaken, Menge ändern, Item entfernen und von Hand hinzufügen,
Tag-Ableitung, Katalogansicht, Retro, und zuletzt den leeren Zustand ohne Katalog.
Er prüft genau die Dinge, die ein Node-Test nicht sieht.

```bash
npm run dev   # in einem zweiten Terminal laufen lassen

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --user-data-dir=/tmp/packliste-smoke \
  --virtual-time-budget=25000 --dump-dom http://localhost:5173/tests/smoke.html \
  | python3 -c "import sys,re,html; s=sys.stdin.read(); m=re.search(r'<pre id=\"ergebnis\">(.*?)</pre>', s, re.S); print(html.unescape(m.group(1)))"
```

## Katalog pflegen

Am Mac entsteht der Katalog, am Handy wird er benutzt. Änderungen laufen über
`daten/katalog.json` und einen Commit — es gibt im MVP bewusst keinen
Katalog-Editor in der UI (der kommt mit FF-16).

**`daten/katalog.json` wird von Hand gepflegt.** Der Excel-Import ist einmal
gelaufen und danach totgelegt: `mapping.json` und `import.mjs` kennen nur die
Quelltabelle und wissen nichts von umbenannten, gelöschten oder neu getaggten
Items. Ein Lauf mit `--write` würde diese Arbeit überschreiben, deshalb ist der
Schreibpfad gesperrt (`--trotzdem-schreiben` nötig).

Der **Trockenlauf** bleibt offen und ist weiter nützlich — er liest die Excel,
prüft gegen `erwartungen.json` und schreibt nur `import/import-report.md`:

```bash
node import/import.mjs        # nur lesen, prüfen, Report
```

Die Datei ist nach `name` sortiert (`localeCompare` mit Locale `de`). Wer Items
einfügt oder umbenennt, sortiert neu — sonst wandert die Zeile ans falsche Ende.

Damit eine Änderung am Handy ankommt, muss die Datei dort neu importiert werden.
Am Handy ist der Katalog read-only.

## Deployment

Statisch gehostet (Vercel erkennt Vite und liefert `dist/` aus). Das Deployment
enthält **nur die App-Hülle** — kein Katalog, keine Reisen. Die Deploy-URL darf
deshalb öffentlich sein.

`daten/` liegt aus genau diesem Grund außerhalb von `public/`: was unter `public/`
steht, kopiert Vite unverändert in den Build.
