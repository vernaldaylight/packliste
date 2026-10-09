# Packliste einrichten

Diese Anleitung ist für dich, wenn du die App benutzen willst — nicht, wenn du
sie weiterentwickeln willst. Dafür gibt es das [README](README.md).

Die App macht aus einem Katalog von Gegenständen und einer beschriebenen Reise
automatisch eine Packliste zum Abhaken. Sie braucht dafür **keinen Server und
kein Konto**: alles läuft im Browser, und deine Daten liegen in einem eigenen,
**privaten** GitHub-Repo, das du selbst anlegst.

Zeitaufwand: etwa 15 Minuten. Du brauchst ein GitHub-Konto.

---

## Was du anlegst

Zwei Dinge, die nichts miteinander zu tun haben:

| | Was | Wo |
|---|---|---|
| **Die App** | das Programm selbst — Katalog, Reisen und Token liegen **nicht** darin | im Browser geöffnet |
| **Dein Daten-Repo** | dein Katalog und deine Reisen | privat auf GitHub |

Warum getrennt? Der Katalog kann Gesundheitsdaten enthalten (Medikamentennamen
stehen als Gegenstände drin). Deshalb liegt er in einem privaten Repo, und die
App selbst bleibt leer und darf öffentlich sein.

---

## Schritt 1 · Die App öffnen

Der einfachste Weg: die fertige App im Browser aufrufen.

> **<https://vernaldaylight.github.io/packliste/>**

Da ist nichts zu installieren. Die Seite ist nur die Hülle — sie kennt weder
deinen Katalog noch deine Reisen, bis du sie in Schritt 4 verbindest.

**Wenn du lieber eine eigene Kopie willst** (eigene Adresse, oder offline
arbeiten), hast du zwei Möglichkeiten:

- **Forken und selbst veröffentlichen.** Auf GitHub *Fork* klicken, im Fork
  unter *Settings → Pages* als Quelle **GitHub Actions** wählen. Der Fork baut
  sich bei jedem Push selbst. ⚠️ **Wichtig:** Der Fork heißt anders als
  `packliste`, also muss der Name in `vite.config.js` mit:
  `base: '/<dein-repo-name>/'`. Sonst bleibt die Seite weiß.
- **Lokal starten** (braucht [Node.js](https://nodejs.org)):
  ```bash
  npm install
  npm run dev          # dann http://localhost:5173 öffnen
  ```

Egal welcher Weg — die folgenden Schritte sind identisch.

---

## Schritt 2 · Dein Daten-Repo anlegen

Auf GitHub ein **neues, privates** Repo anlegen. Der Name ist egal, nimm zum
Beispiel `packliste-daten`.

Es muss zunächst **nichts** drin sein. Du kannst die Dateien später direkt auf
GitHub im Browser anlegen (*Add file → Create new file*) — du brauchst dafür
kein Git auf dem Rechner.

### Wie es am Ende aussehen muss

Die beiden Dateien müssen **im Hauptverzeichnis** liegen, mit **genau diesen
Namen** — die App sucht sie dort:

```
packliste-daten/          ← privat
├── katalog.json          ← PFLICHT: deine Gegenstände
└── reisen.json           ← legt die App selbst an (Schritt 5)
```

Mehr braucht es nicht. Wenn du später einen Katalog aus Excel/CSV pflegst,
kommen noch `quellen/` und `import/` dazu — für den Anfang irrelevant.

---

## Schritt 3 · `katalog.json` schreiben

Das ist die Datei, die du selbst pflegst. Sie hat zwei Ebenen: oben `version`
und `items`, darunter die Gegenstände.

```json
{
  "version": 1,
  "items": [
    {
      "id": "zahnbuerste",
      "name": "Zahnbürste",
      "kategorie": "Kosmetik & Pflege",
      "tags": ["Allgemein"],
      "menge": { "art": "einmal" }
    },
    {
      "id": "t-shirt",
      "name": "T-Shirt",
      "kategorie": "Kleidung",
      "tags": ["Allgemein"],
      "menge": { "art": "pro_tage", "n": 1, "pro_tage": 3, "max": 6 }
    },
    {
      "id": "zelt",
      "name": "Zelt",
      "kategorie": "Campingausrüstung",
      "tags": ["Camping"],
      "menge": { "art": "einmal" },
      "nicht_mit": ["Hotel"]
    }
  ]
}
```

**Am schnellsten:** Kopiere
[`tests/fixtures/katalog.synthetisch.json`](tests/fixtures/katalog.synthetisch.json)
aus dem App-Repo als Startpunkt. Da sind alle Kategorien und alle drei
Mengenarten einmal drin — dann musst du nur noch ergänzen und löschen.

### Die Felder eines Gegenstands

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | eindeutiger Schlüssel, klein, ohne Umlaute/Leerzeichen (z. B. `zahnbuerste`). **Jede id nur einmal** |
| `name` | ja | was in der Liste steht (z. B. `Zahnbürste`) |
| `kategorie` | ja | eine der elf unten — bestimmt die Gruppierung |
| `tags` | ja | Liste von Tags; **wann** der Gegenstand mitkommt (siehe unten) |
| `menge` | ja | wie viel gepackt wird (siehe unten) |
| `nicht_mit` | nein | Liste von Tags; dann kommt er **nicht** mit (z. B. `["Hotel"]`) |
| `im_besitz` | nein | `false` = musst du noch kaufen; Standard `true` |
| `notiz` | nein | freier Text, erscheint am Gegenstand |

### Wie die Auswahl funktioniert

Für jede Reise sammelt die App deren Tags ein (Saison, Aktivitäten,
Verkehrsmittel, Unterkunft, Zusatz-Tags) und dazu immer `Allgemein`. Dann gilt:

- **mitnehmen**, wenn mindestens ein Tag des Gegenstands dabei ist
- **weglassen**, wenn ein Tag aus `nicht_mit` dabei ist

Daraus folgt der wichtigste Satz für die Katalogpflege: **Was auf jeder Reise
dabeisein soll, braucht den Tag `Allgemein`.** Ein Gegenstand ganz ohne
passenden Tag taucht nie auf.

### Die erlaubten Werte

**`kategorie`** — genau eine dieser elf:

```
Dokumente & Wertsachen   Kleidung        Schuhe
Kosmetik & Pflege        Medizin         Technik
Tauchausrüstung          Campingausrüstung
Taschen & Ordnung        Verpflegung     Haushalt & Sonstiges
```

**`tags`** — die bekannten Reise-Tags (du kannst in der App nur diese wählen):

| Gruppe | Tags |
|---|---|
| Basis | `Allgemein`, `Reiseapotheke` |
| Klima / Saison | `Winter`, `Sommer`, `Übergangszeit`, `Regen` |
| Verkehrsmittel | `Flugzeug`, `Auto`, `Zug` |
| Aktivität | `Tauchen`, `Festival`, `Wandern`, `Strand`, `Ski`, `Arbeit`, `Fotografie`, `UW-Fotografie` |
| Unterkunft | `Camping`, `Ferienwohnung`, `Hotel`, `Hostel`, `Freunde` |
| Person | `Damen`, `Herren` — **nur** in `nicht_mit`, siehe unten |

**`menge`** — drei Formen:

| Form | Beispiel | Ergebnis |
|---|---|---|
| `{ "art": "einmal" }` | Zahnbürste | immer 1 |
| `{ "art": "fest", "n": 2 }` | Badehose | genau 2 |
| `{ "art": "pro_tage", "n": 1, "pro_tage": 3, "max": 6 }` | T-Shirt | 1 pro 3 Tage, höchstens 6 |

Die Formel für `pro_tage`: `min(aufgerundet(Reisetage / pro_tage) * n, max)`.
Bei 10 Tagen ergibt das obige T-Shirt also 4.

### Geschlechtsspezifische Gegenstände

Ein Gegenstand „nur für sie" bekommt das **andere** Geschlecht als Ausschluss,
nicht das eigene als Tag:

```json
{ "id": "badehose", "name": "Badehose", "kategorie": "Kleidung",
  "tags": ["Sommer", "Strand"], "menge": { "art": "einmal" },
  "nicht_mit": ["Damen"] }
```

`Damen`/`Herren` gehören **nie** in `tags`, immer in `nicht_mit`. Und ein
solcher Gegenstand darf `Allgemein` **nicht** tragen — sonst käme er über das
Fundament für alle mit.

---

## Schritt 4 · Einen Zugangsschlüssel (Token) erzeugen

Die App liest und schreibt dein Daten-Repo über die GitHub-Schnittstelle. Dafür
braucht sie ein Token — so etwas wie ein Passwort für genau dieses eine Repo.

Auf GitHub: *Settings → Developer settings → Personal access tokens →
**Fine-grained tokens** → Generate new token*.

| Feld | Wert |
|---|---|
| Resource owner | dein Konto |
| Repository access | **Only select repositories** → dein Daten-Repo |
| Repository permissions | **Contents: Read and write** — sonst nichts |
| Expiration | z. B. 90 Tage; läuft es ab, scheitert der Abgleich mit `401` |

> **Nimm nicht das Token von `gh auth token`.** Das gilt für *alle* deine
> Repositories. Das fein granulierte gilt für genau eines.

Das Token ist ein Passwort: Es liegt danach **nur im Browser** dieses Geräts —
nie im Repo, nie im Code. Wer dein entsperrtes Gerät hat, kommt daran; deshalb
ein Ablaufdatum, und im Zweifel bei GitHub einfach widerrufen.

---

## Schritt 5 · In der App verbinden

1. In der App: **Katalog & Daten → Synchronisierung**
2. Dort `owner/name` deines Daten-Repos eintragen (z. B. `maxmustermann/packliste-daten`)
   und das Token einfügen.
3. **Aus GitHub holen** klicken — jetzt lädt die App deinen `katalog.json` und
   prüft ihn. Ist etwas faul, sagt sie dir, was, und übernimmt nichts.
4. Beim ersten **Hochschieben** legt die App `reisen.json` in deinem Repo an.
   Die Datei musst du nicht selbst erstellen.

Danach kannst du Reisen anlegen wie beschrieben — der Katalog bleibt im Browser
gespeichert, du brauchst das Token nicht bei jedem Start.

> **Ohne Netz** läuft die App vollständig aus dem Browser weiter. Der Abgleich
> passiert nur, wenn du ihn anklickst — nie von allein.

---

## Schritt 6 · `reisen.json` verstehen

Diese Datei schreibt die App; du musst sie normalerweise nie anfassen. Wenn du
doch mal hineinschaust (z. B. um etwas zu retten), sieht sie so aus:

```json
{
  "version": 2,
  "personen": [{ "id": "…", "name": "Max", "geschlecht": "maennlich" }],
  "reisen": [
    {
      "id": "…", "name": "Tauchurlaub", "ziel": "Hurghada",
      "von": "2026-10-01", "bis": "2026-10-21",
      "saison": ["Sommer"],
      "aktivitaeten": ["Tauchen", "Strand"],
      "verkehrsmittel": "Flugzeug",
      "unterkunft": "Ferienwohnung",
      "zusatz_tags": [], "entfernte_tags": [],
      "teilnehmer": [{ "person_id": "…", "aktivitaeten": [] }]
    }
  ],
  "packlisten": [
    {
      "reise_id": "…", "person_id": "…",
      "erzeugt_am": "2026-10-08T12:57:07.800Z",
      "positionen": [
        { "item_id": "zahnbuerste", "menge": 1, "gepackt": false, "manuell_hinzugefuegt": false }
      ]
    }
  ]
}
```

Die wichtigsten Regeln, falls du doch mal von Hand eingreifst:

- Datumsangaben sind `"JJJJ-MM-TT"`. Beide Enden zählen mit: 01.–10. sind 10 Tage.
- `saison` ist eine **Liste**, auch bei nur einem Wert (`["Sommer"]`).
- Eine Packliste gehört immer zu einem **Paar** aus `reise_id` und `person_id`
  (pro Person eine eigene Liste). `person_id: null` ist der alte Stand ohne Personen.
- `teilnehmer` verweist mit `person_id` auf einen Eintrag in `personen`.
- **Ändere die Datei nur, wenn die App geschlossen ist.** Ein „Hochschieben"
  ersetzt sie komplett durch das, was im Browser steht.

---

## Alltag

**Katalog ändern** — du bearbeitest `katalog.json` in deinem Daten-Repo (auf
GitHub im Browser oder lokal und dann committen). Danach in der App
*Katalog & Daten → Aus GitHub holen*. Die App schreibt den Katalog **nie**
zurück — eine Richtung, das ist Absicht.

**Reisen** — die Pflege passiert in der App. Die drei Knöpfe:

| Knopf | Was passiert |
|---|---|
| **Katalog holen** | lädt `katalog.json` und prüft ihn, bevor er übernommen wird |
| **Hochschieben** | schreibt deine Reisen nach `reisen.json` |
| **Holen** | führt zusammen: gleiche Reise wird ersetzt, neue kommen dazu, deine bleiben |

**Auf zwei Geräten (z. B. Handy und Laptop):** erst **Holen**, dann arbeiten,
dann **Hochschieben**. „Hochschieben" ersetzt, was drüben liegt — wer das
umgekehrte macht, verliert die Reise des anderen Geräts.

---

## Wenn etwas nicht klappt

| Symptom | Ursache |
|---|---|
| Seite bleibt weiß | Fork mit anderem Namen, aber `base` in `vite.config.js` nicht angepasst |
| `401` beim Abgleich | Token abgelaufen, falsch kopiert oder widerrufen |
| `404` beim Abgleich | `owner/name` vertippt oder Repo ist nicht privat/read für das Token |
| Katalog wird abgelehnt | doppelte `id`, fehlendes Pflichtfeld oder unbekannte `kategorie` — die App nennt den Grund |
| Gegenstand taucht nie auf | kein `Allgemein` und kein anderer Tag, der zu einer Reise passt |
| App fragt nach einem Katalog | noch keiner geladen — entweder *Aus GitHub holen* oder die Datei über die Dateiauswahl laden (geht auch ohne Netz und Token) |
