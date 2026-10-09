# Packliste — Product Requirements Document

**Version**: 1.10
**Datum**: 2026-10-09
**Autor**: Sarah
**Status**: Abgestimmt — bereit für die Umsetzung. Technische Architektur entschieden (§3.6). Der Katalog-Editor ist aus dem MVP in die erste Überarbeitung verschoben (FF-16).
**Sprache der App**: Deutsch

---

## 1. Executive Summary

### Problem
Reisen packen bedeutet heute, dieselbe Liste immer wieder von Hand zusammenzustellen. Die bestehende Excel-Tabelle kennt zwar alle Items und ihre Tags, kann aber die Auswahl nicht selbst treffen: Nach dem Tag-Filter bleibt ein manueller Copy-Paste- und Streich-Schritt. Das kostet vor jeder Reise Zeit und führt zu vergessenen Dingen.

### Lösung
Eine Web-App, die aus einem festen Item-Katalog und einem beschriebenen Reise-Profil automatisch eine vollständige Packliste erzeugt — mit konkreten Mengen, gruppiert nach Kategorie, abhakbar.

### Business Impact
- **Zeit**: Packliste in unter 2 Minuten statt ~20 Minuten Handarbeit
- **Vollständigkeit**: nichts vergessen, weil die Auswahl deterministisch aus Tags folgt statt aus Erinnerung
- **Wiederverwendbarkeit**: einmal gepflegter Katalog trägt jede künftige Reise

### Erfolgskriterien (KPI)
1. Zeit bis zur fertigen Packliste: **< 2 Minuten**
2. Vergessene Items pro Reise: **0** (Basis: Beobachtung der nächsten 3 Reisen)
3. Anteil Reisen, deren generierte Liste ohne manuelle Nacharbeit genutzt wird: **> 80 %**
4. Manuelle Nachträge pro Reise: **sinkend** über die Zeit (Katalog lernt)

### Umfang & Ressourcen
- Solo-Projekt, reine Browser-App, kein Backend-Prozess, keine Datenbank
- Auslieferung: statisch gehostet, damit die Liste auch am Handy verfügbar ist (§3.6)
- Stack: Vite + Vanilla JS
- Persistenz: `katalog.json` als versionierte Datei im Repo (**nicht deployt**), am Handy per Button importiert; Reisen im `localStorage` des Handys (§4.5)
- Datentransfer Mac ⇄ Handy: per Button über Dateien (iCloud Drive, AirDrop, Mail) — keine automatische Synchronisierung
- Das Deployment enthält nur die App-Hülle, keine persönlichen Daten
- Herkunft: Praxisprojekt im Agentic-Coding-Kurs, danach dauerhafte private Nutzung

---

## 2. Problem Definition

### 2.1 Nutzerproblem

**Wer**: Ich selbst (Sarah) — reist viel, hat einen großen, stabilen Bestand eigener Dinge. Später: Partner und Freunde mit eigenen Beständen.

**Was**: Vor jeder Reise muss eine Packliste neu zusammengestellt werden. Der Bestand an Items ist fix, aber welche davon mitkommen, hängt von Reiseziel, Saison, Aktivitäten und Verkehrsmittel ab.

**Wann**: Vor jeder Reise, mehrfach pro Jahr.

**Wo**: Am Schreibtisch beim Planen; die Liste wird danach unterwegs am Handy benutzt.

**Warum (Root Cause)**: Zwei Ursachen greifen ineinander.
1. Die vorhandene Excel-Tabelle modelliert Items und Tags in **einer** flachen Achse. Dadurch kann sie nur filtern, nicht auswählen — jede Reise endet in manuellem Streichen.
2. Die Entscheidung "was kommt mit" liegt komplett im Kopf. Genau dort entstehen die Lücken: Man vergisst nicht die Liste, man vergisst ein Item, weil kein System es erzwingt.

**Impact**: Zeitverlust vor jeder Reise; vergessene Gegenstände, die unterwegs teuer oder ärgerlich nachgekauft werden müssen.

### 2.2 Bestehende Lösung (Status quo)

Eine Excel-Tabelle:

| | Winter | Sommer | Festival | Allgemein | Kleidung | Technik | Kosmetik | Medizin | Schuhe | Tauchen | Camping |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-Shirt | | X | X | | X | | | | | | |
| Wanderschuhe | X | | | | | | | | X | | X |

Pro Tag existiert eine Formel-Spalte, die alle Items mit diesem Tag auflistet. Danach manuell: relevante Spalten kopieren, Irrelevantes streichen.

**Gap**: Die Tabelle kennt keine Reise und keine Mengen. Sie liefert Bausteine, keine Antwort.

### 2.3 Der zentrale Modellierungsfehler

Die Spalten der Tabelle mischen **zwei Achsen**:

| Achse | Bedeutung | Beispiele | Rolle im System |
|---|---|---|---|
| **Kategorie** | Was für ein Ding ist das? | Kleidung, Schuhe, Technik, Medizin, Tauchausrüstung | **Gruppierung** der fertigen Liste |
| **Kontext** | Wo bin ich / was mache ich? | Winter, Tauchen, Flugzeug, Hotel, Allgemein | **Filter** der Auswahl |

Diese Trennung ist der Kern des Produkts. Kategorien sagen, *wie die Liste sortiert wird*; Kontexte sagen, *was überhaupt darauf gehört*. Sobald die Achsen getrennt sind, folgt die Auswahllogik fast von selbst.

---

## 3. Solution Overview

### 3.1 Kernidee

Der Item-Katalog ist **fest und gepflegt**. Die Reise ist der **variable Input**. Die Packliste ist eine **Ableitung** — keine Handarbeit.

Der Nutzer beschreibt eine Reise (Ziel, Zeitraum, Saison, Aktivitäten, Verkehrsmittel). Die App leitet daraus Kontext-Tags ab, schneidet sie mit den Tags des Katalogs, berechnet Mengen und gruppiert das Ergebnis nach Kategorie.

Für unbekannte Aktivitäten lässt sich ein neuer Tag frei eintippen — die App ist damit nicht auf die heute bekannten Kontexte beschränkt.

### 3.2 Entschiedene Grundsatzfragen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Auswahllogik | **Regelbasiert**, kein LLM im MVP | Deterministisch, offline, kostenlos, testbar. Bei einem festen Katalog mit sauberen Tags ist ein LLM zum Auswählen nicht nötig — es macht das Ergebnis nur unvorhersagbar. LLM bleibt als optionale Verfeinerung auf der Roadmap. |
| Reise-Input | **Formular + manuell nachjustierbare Tags** | Ersetzt die Excel-Denkarbeit, lässt aber Sonderfälle zu. |
| Migration | **Excel/CSV-Import im MVP** | Ohne Import startet der Nutzen erst nach wochenlanger Handpflege. |
| Mengen | **Dauerbasiert** | Löst "zu wenig Unterwäsche für 10 Tage" — ein realer Fehlerfall, der mit Ja/Nein-Logik bestehen bleibt. |

### 3.3 In Scope (MVP)

| # | Feature | Priorität |
|---|---|---|
| F1 | Item-Katalog mit zwei Achsen (Kategorie + Kontext-Tags) | P0 |
| F2 | Mengenregeln pro Item | P0 |
| F3 | Reise-Formular mit automatischer Tag-Ableitung | P0 |
| F4 | Regel-Engine: Auswahl + Mengenberechnung | P0 |
| F5 | Ergebnisliste, gruppiert nach Kategorie, abhakbar | P0 |
| F6 | Manuelles Nachjustieren pro Reise (ohne Katalogänderung) | P0 |
| F7 | Excel/CSV-Import des bestehenden Bestands | P0 |
| F8 | Freie neue Tags/Aktivitäten im Reise-Formular anlegen | P0 |
| F9 | Verkehrsmittel als Tag-Quelle (kein Regelwerk) | P0 |
| F10 | Liste als Text/Markdown exportieren | P1 |
| F11 | Reise speichern und später wieder öffnen | P1 |
| F12 | Nach-der-Reise-Retro: "Was hat gefehlt?" | P1 |
| F13 | Katalog ins Gerät holen — aus dem Daten-Repo oder per Datei (US-09) | P0 |
| F14 | Reise-Daten aus dem Gerät herausbringen (US-10) | P0 |
| F15 | Katalog und Reisen über das private Daten-Repo abgleichen (US-11) | P0 |

**Pflegeweg im MVP**: Der Katalog wird **nicht** über eine UI bearbeitet, sondern im privaten Daten-Repo — Import-Skript für den Erstaufbau, danach gezielte Änderungen an `katalog.json` (§3.6). Der Grund ist die Größe: 333 Items, deren Mengenregeln nach dem Import fast alle noch auf `einmal` stehen. Diese Arbeit ist Bulk-Arbeit und gehört in ein Skript, nicht in hunderte Klicks. Das Ventil für Einzelfälle bleibt US-05 (Overrides pro Reise).

### 3.4 Out of Scope (MVP)

- **Mehrbenutzer in der Vollform** — getrennte Kataloge pro Person (FF-04), Zuständigkeiten pro Item (FF-05), gemeinsame Verbrauchsgüter (FF-06). Das **Fundament** dagegen steht seit `version: 2`: ein Personen-Register, Teilnehmer je Reise, eine Packliste pro Person (§4.6). Was fehlt, ist der Teil, der ohne gemeinsame Liste nicht zu haben ist — siehe FF-05/FF-06.
- **LLM-gestützte Auswahl oder Vorschläge**
- **Vorschlagen von Items, die man noch nicht im Katalog hat** ("besitzt du eine Tauchmaske?")
- **Tag-Verwaltung** (umbenennen, zusammenführen, löschen über viele Items)
- **Wetter-API, Gewichts-/Gepäcklimits, Packen nach Tasche, Sharing, PWA/Offline**
- **Benutzerkonten, Server-Prozess, Datenbank** — das Hosting ist statisch (§3.6), kein laufender Dienst
- **Katalog-Editor in der UI** — Item-CRUD, Mengenregel-Editor mit Live-Vorschau (FR3) und Tag-Verwaltung kommen in der ersten Überarbeitung nach dem MVP (FF-16)
- **Synchronisierung im Hintergrund** — der Abgleich mit dem Daten-Repo läuft **nur auf Knopfdruck** (§4.5). Nicht beim Start, nicht im Hintergrund, nie blockierend: gepackt wird unterwegs ohne Netz
- **Automatisches Zusammenführen zweier Fassungen derselben Reise** — es gibt keine Feld-Merge-Regel und keinen Zeitstempel im Datenmodell. Gleiche `id` wird ersetzt, Neues angehängt. Ob drüben inzwischen etwas anderes liegt, erkennt der Sync über die `sha` der Contents-API, nicht über die Daten (§4.5)
- **Katalogänderungen vom Handy** (Stufe C) — der Katalog ist am Handy read-only; geschrieben wird er am Mac im Daten-Repo. Erst mit FF-16 sinnvoll
- **Katalog im Deployment** — der Build enthält nur die App-Hülle; der Katalog liegt in einem **privaten** Repo (§3.6)

### 3.5 MVP-Definition

**Kernumfang**: alle P0-Features — F1–F9, dazu die neuen F13 (Katalog-Import) und F14 (Daten-Export).
**Fertig, wenn**: Eine echte vergangene Reise im Formular eingegeben wird und die generierte Liste ohne manuelles Hinzufügen fehlender Kern-Items zum Packen taugt.
**Lernziele**: Trägt das Zwei-Achsen-Modell wirklich? Sind die Mengenregeln ausdrucksstark genug? Wie viel Nacharbeit bleibt realistisch?

### 3.6 Technische Architektur

**Entschieden am 2026-10-07, Datentransfer nachgeschärft am 2026-10-08, auf zwei Repos umgestellt am 2026-10-08.** Leitfrage war: Braucht diese App ein Backend? Nein — und diese Antwort bestimmt jede weitere Entscheidung.

Die App hat genau zwei Aufgaben, die man auslagern *könnte*: **Persistenz** und die **Regel-Engine**. Die Engine ist eine reine Funktion über den Katalog (Tag-Schnittmenge plus Mengenformel) und rechnet bei 333 Items in unter einer Millisekunde — sie gehört in den Browser. Für die Persistenz braucht es keine Transaktionen, keine Mehrbenutzer und keine Geheimnisse. Damit fällt jeder Server-Anteil weg: ein getrenntes Frontend/Backend oder ein Python-Backend würde nur einen zweiten Prozess hinzufügen, den man starten muss, bevor die App funktioniert — für null Gegenwert.

| Baustein | Entscheidung | Begründung |
|---|---|---|
| Auslieferung | Statisch gehostet (**GitHub Pages**), kein Backend-Prozess | Reine Browser-App. Ein Workflow baut und veröffentlicht `dist/` — kostenlos, HTTPS, URL fürs Handy. Kein Laptop muss dafür laufen. Die App routet über `location.hash`, deshalb braucht Pages keine `404.html`-Krücke für Deep-Links |
| Build | **Vite** | Dev-Server mit Hot-Reload plus Bundler, ohne Framework-Zwang |
| UI | **Vanilla JS** | Die Engine ist eine reine Funktion, der Rest ist Formular- und Listen-Handling über fünf Ansichten. Ein UI-Framework wäre hier Ballast |
| **Inhalt des Deployments** | **Nur die App-Hülle** — kein Katalog, keine Reisen | Die Deploy-URL ist damit öffentlich und trotzdem unbedenklich: sie enthält nichts Persönliches (O11) |
| **Repos** | **Zwei**: die App-Hülle (öffentlich) und ein **privates** Daten-Repo | Der Katalog enthält **Gesundheitsdaten** — Medikamentennamen stehen als Items darin. Das App-Repo soll öffentlich sein, also dürfen Katalog und `import/` nicht darin liegen (§4.5) |
| Datentransfer | **GitHub-Contents-API auf Knopfdruck** (`src/sync.js`), fein granuliertes PAT im `localStorage` | Kein Server, kein Proxy: `api.github.com` erlaubt CORS inklusive Preflight für authentifizierte `PUT` (gemessen). Der Abgleich ist ein Knopf, nie ein Hintergrundvorgang |
| Katalog-Transport | **Datei per Button** *und* Sync: `katalog.json` kommt aus dem Daten-Repo oder über die Dateiauswahl aus iCloud Drive | iOS-Safari hat **keine** File System Access API — ein Schreibweg in iCloud existiert dort nicht. Bei fehlendem Netz ist die Datei der einzige Weg, deshalb bleibt sie erhalten |
| Datenspeicherung am Handy | **`localStorage`** für Katalog **und** Reisen | Die Arbeitskopie. Eine Speicherquelle, ein Importweg, und der Sync liest und schreibt immer nur von hier |
| Datenrückweg | Wenn Sync: `reisen.json` im Daten-Repo. Sonst: **Share-Sheet** (`navigator.share`) → iCloud Drive, AirDrop oder Mail | Beide Wege bleiben — ohne Token oder ohne Netz ist der Export der Notausgang |
| Katalog-Pflege | **Daten-Repo + Import-Skript**, keine UI im MVP | Bulk-Arbeit an 333 Items gehört in Skript und git, nicht in Klicks (§3.3) |
| Offline | Nicht im MVP | Ohne Service Worker braucht die Seite Netz. Der Markdown-Export (F10) ist der Offline-Pfad; PWA bleibt FF-12 |

**Warum Python trotzdem vorkommt — aber nicht als Backend.** Der einzige Ort, an dem Python hier glänzt, ist der **Excel-Import** (§6): Semikolon als Trennzeichen, UTF-8-Umlaute, Formel-Spalten mit doppelten Spaltennamen. Das ist ein **einmaliges Migrationsskript** `quellen/ → katalog.json`, kein laufender Dienst.

**Projektstruktur** — das App-Repo enthält nur die Hülle:

```
packliste/                       öffentlich
├─ index.html
├─ src/
│  ├─ main.js        App-Start — Katalog da? sonst Aufforderung; Zustand und Router
│  ├─ engine.js      Regel-Engine + Mengenformel — reine Funktionen, testbar ohne DOM
│  ├─ store.js       localStorage lesen/schreiben, Validierung, Datei-Import, Backup
│  ├─ sync.js        GitHub-Contents-API — reine Funktionen plus injizierbarer Netzrand
│  └─ ui/            die Ansichten; syncUi.js trägt Einstellungen und Konfliktdialog
└─ tests/
   ├─ fixtures/
   │  └─ katalog.synthetisch.json   erfundener Katalog: alle 11 Kategorien, alle 3 Regeln
   └─ smoke.html     Rauchtest im echten Browser

packliste-daten/                 privat — hier liegt der Schatz
├─ katalog.json     der echte Katalog (262 Items, inkl. Medizin)
├─ reisen.json      entsteht beim ersten Hochschieben
└─ import/          mapping.json, erwartungen.json, import.mjs — aus dem Katalog abgeleitet
```

**`daten/` und `import/` liegen bewusst nicht im App-Repo.** Beide enthalten den echten Bestand: der Katalog die Item-Namen samt Medikamenten, `import/mapping.json` die Zuordnung der Quelltabelle darauf. In einem öffentlichen Repo wären sie über die Deploy-URL, das Repo selbst und jeden Fork abrufbar, und ein einmal veröffentlichter Stand lässt sich nicht zurückholen. Sie liegen deshalb in einem **privaten** Repo, auf das ein fein granuliertes Token beschränkt ist (§4.5).

**Warum nicht ein Secret Gist.** „Secret" heißt bei GitHub nur *nicht gelistet* — jeder mit der URL liest mit, und GitHub sagt selbst, ein privater Gist existiere nicht. Dazu kommt: ein Gist-Token gilt für **alle** Gists. Ein Repo-Token lässt sich dagegen auf genau ein Repo beschränken.

**Wo die App im MVP läuft**: Weil Reisen am Handy entstehen (Stufe A), ist die Browser-App im MVP **praktisch ein Handy-Werkzeug**. Am Mac passiert in dieser Zeit: Import-Skript starten, `katalog.json` im Daten-Repo bearbeiten, committen. Die File System Access API — der Schreibweg aus 1.2 — wird erst mit dem Katalog-Editor (FF-16) gebraucht und kommt im MVP nicht vor.

**Konsequenz für die Pflege**: Katalogänderungen laufen im **Daten-Repo** über `katalog.json` und einen Commit. Damit sie am Handy ankommen, wird dort „Aus GitHub holen" gedrückt (§4.5). Am Handy ist der Katalog **read-only**.

**Verworfene Alternativen** stehen in Anhang C.

---

## 4. Datenmodell

### 4.1 Item

```
Item {
  id: string
  name: string                    // "Wandersocken"
  kategorie: string               // genau eine — siehe Anhang B
  tags: string[]                  // Kontext-Tags: ["Winter", "Camping"]
  menge: Mengenregel
  nicht_mit: string[]             // Ausschluss-Tags (siehe 5.3)
  notiz?: string
  im_besitz: boolean              // für spätere Vorschlags-Features
}
```

**Regeln**
- `kategorie` ist genau eine — sie bestimmt nur die Gruppierung.
- `tags` sind beliebig viele, frei als String, ohne feste Taxonomie. `"Allgemein"` ist ein normaler Tag mit Sonderbedeutung (siehe 5.1).
- Kategorien und Tags sind **Strings, keine Enums**. Neue Tags entstehen durch Eintippen. Das hält das Schema offen für Aktivitäten, die es heute noch nicht gibt.

### 4.2 Mengenregel

Drei Varianten, decken alle realistischen Fälle ab:

| Variante | Felder | Beispiel | Ergebnis bei 10 Tagen |
|---|---|---|---|
| `einmal` | — | Zahnbürste | 1 |
| `fest` | `n` | Badehose | n |
| `pro_tage` | `n`, `pro_tage`, `max` | T-Shirt: 1 pro 3 Tage, max 6 | 4 |

**Formel**: `menge = min(ceil(reisetage / pro_tage) * n, max)`

Der Editor zeigt die Rohfelder direkt — `n`, `pro_tage`, `max` — ohne Assistenten. Dazu läuft eine Live-Vorschau: „= 4 Stück für 10 Tage". Rohfelder zum Einstellen, Vorschau zum Fehlerfangen.

**Verbrauchsmaterial** (Sonnencreme, Shampoo, Zahnpasta) nutzt `fest`. Verbrauch wird nicht pro Tag hochgerechnet — eine Packung reicht für eine Reise. Bei sehr langen Reisen wird die Zahl manuell erhöht. Das deckt den realen Fall ab, ohne ein Verbrauchsmodell zu brauchen.

### 4.3 Reise

```
Reise {
  id: string
  name: string                    // "Tauchurlaub Ägypten"
  ziel?: string
  von: date
  bis: date                       // -> reisetage
  saison: "Winter" | "Sommer" | "Übergangszeit"
  aktivitaeten: string[]          // ["Tauchen", "Schnorcheln"]
  verkehrsmittel: "Flugzeug" | "Auto" | "Zug"
  unterkunft: "Camping" | "Ferienwohnung" | "Hotel" | "Hostel" | "Freunde"
  zusatz_tags: string[]           // manuell ergänzt/entfernt
  teilnehmer: Teilnehmer[]        // leer = Reise ohne Personen (§4.6)
}

Teilnehmer {
  person_id: string               // zeigt auf einen Eintrag in `personen` (§4.5)
  aktivitaeten: string[]          // NUR für diese Person, z. B. ["Fotografie"]
}
```

`teilnehmer` ist der **einzige** personenbezogene Teil der Reise. Das Geschlecht steht an der Person im Register, nicht hier: es gilt für alle ihre Reisen. Die Aktivitäten stehen hier, nicht an der Person — was jemand auf *dieser* Reise tut, sagt die Reise.

Eine Reise ohne `teilnehmer` ist der Altbestand und verhält sich wie vor dem Personen-Feature (§4.6).

**Verkehrsmittel und Unterkunft sind keine Sonderfälle, sondern Tag-Quellen.** Es gibt kein Regelwerk und keine Warnungen: `Flugzeug` ist ein Tag wie jeder andere, und Items wie Nackenkissen, Wollsocken oder der 1-L-Zip-Beutel tragen ihn. Wer mit dem Auto fährt, bekommt diese Items einfach nicht — und dafür alle Items mit Tag `Auto`. Dasselbe gilt für die Unterkunft: Wer im Hotel schläft, braucht kein Handtuch und keinen Föhn.

Die **abgeleiteten Reise-Tags** sind die Vereinigung aus:
`{saison} ∪ aktivitaeten ∪ {verkehrsmittel} ∪ {unterkunft} ∪ zusatz_tags ∪ {"Allgemein"}`

### 4.4 Packliste (Ergebnis)

Die Packliste ist eine **Momentaufnahme**, kein Live-View. Beim Erzeugen wird sie materialisiert, damit manuelles Nachjustieren (F6) und Abhaken (F5) nicht bei jedem Render verloren gehen.

```
Packliste {
  reise_id: string
  person_id: string | null        // null = Liste für die Reise als Ganzes
  erzeugt_am: datetime
  positionen: [
    { item_id, menge, gepackt: boolean, manuell_hinzugefuegt: boolean }
  ]
}
```

Der Schlüssel einer Packliste ist ab `version: 2` das **Paar** `(reise_id, person_id)` — nicht die Reise allein. Eine Reise mit zwei Personen hat zwei Listen; über `reise_id` allein wäre die zweite die erste. `person_id: null` ist der Altbestand: eine Liste von vor dem Personen-Feature oder die eine Liste einer Reise ohne Teilnehmer. Alten Listen wird beim Laden **kein** `person_id` angedichtet — das änderte ihre Identität; Leser nehmen `p.person_id ?? null`.

### 4.5 Persistenz

Kein Server-Prozess, keine DB, keine Konten. Die Trennung nach Wert bleibt — sie zeigt sich in **zwei Datensätzen mit sehr verschiedenem Lebenslauf**:

| Datensatz | Inhalt | Master liegt | Am Gerät |
|---|---|---|---|
| `katalog.json` | `items` | **privates Daten-Repo** | `localStorage`, Arbeitskopie |
| `reisen.json` | `personen`, `reisen`, `packlisten` | **privates Daten-Repo** | `localStorage`, Arbeitskopie |

```json
// katalog.json  — im privaten Daten-Repo, NICHT im App-Repo, NICHT deployt
{ "version": 1, "items": [ ... ] }

// reisen.json  — im privaten Daten-Repo; entsteht beim ersten Hochschieben
{ "version": 2, "personen": [ ... ], "reisen": [ ... ], "packlisten": [ ... ] }
```

**Eine Naht für alle Lesewege.** `personen` kam mit `version: 2` dazu, und es gibt vier Stellen, an denen ein Reise-Datensatz von außen hereinkommt: der `localStorage`, die Import-Datei (US-10), der Sync (§4.5) und das Ersetzen beim Import. Jede davon, die die Felder selbst aufzählt, verliert `personen` still — drei davon taten das. Sie gehen deshalb alle durch **`normalisiereDaten`** in `store.js`, das fehlende Felder auffüllt: `personen: []`, `reise.teilnehmer: []`. Die Version wird nirgends verzweigt; der Bump ist ein Signal an den Menschen, kein Schutz — die Arbeit macht die Normalisierung, und sie wirkt unabhängig von der Version. Eine Migrationsmaschinerie gibt es bewusst nicht, alles ist additiv.

Daraus folgt die Regel für neuen Code: **kein Feld eines Reise-Datensatzes von Hand zusammenbauen.** Wer `{ version, reisen, packlisten }` schreibt, hat das nächste Feld schon vergessen.

Der Known-Loss: eine **alte App-Version** auf einem zweiten Gerät kennt `personen` nicht und verwirft es beim Hochschieben. Der Versions-Bump verhindert das nicht. Bewusst akzeptiert (§11).

**Warum getrennt**: Der Katalog ist der einzige Teil, dessen Verlust echte Arbeit kostet. Reisen und Packlisten sind Ableitungen. Getrennt gehalten kann ein schiefgelaufener Schreibvorgang auf einer Packliste den Katalog nicht beschädigen.

**`localStorage` ist die Arbeitskopie, das Repo ist der Master.** Diese Reihenfolge ist keine Formsache, sondern trägt den ganzen Entwurf: gepackt wird unterwegs, im Zug, im Flugzeug, ohne Netz. Der Sync wird **nie** beim Start ausgelöst, **nie** im Hintergrund und **nie** blockierend. Ohne Netz läuft die App vollständig aus dem `localStorage`; der Abgleich ist ein ausdrücklicher Knopf, den man drückt, wenn man Netz hat.

#### Der Abgleich (US-11)

| Handgriff | Ablauf |
|---|---|
| **Katalog holen** | `GET katalog.json` → `validiereKatalog` → `speichereKatalog`. Erst prüfen, dann übernehmen — wie bei US-09 |
| **Reisen hochschieben** | `GET reisen.json` (frische `sha`) → `PUT` mit dem hiesigen Stand. Liegt drüben eine Reise, die es hier nicht gibt, wird **vorher gefragt** |
| **Reisen holen** | `GET` → `validiereDaten` → über die `id` zusammenführen → `setzeDaten` |

**Der Katalog geht nur in eine Richtung.** Er wird am Mac bearbeitet; die App hat keinen Grund, ihn zu schreiben. Damit schrumpft die Schreibfläche des Tokens auf `reisen.json` — und der Schreibweg ist der Teil, der schiefgehen kann.

**Zusammengeführt wird über die `id`, nicht über Felder.** Gleiche `id` wird ersetzt, Neues angehängt, Hiesiges bleibt — das gilt für Reisen und für Personen (das Register wird über die `person_id` zusammengeführt). Eine Packliste gehört zu genau einer Reise **und einer Person** und wird als Ganzes ersetzt, nicht positionenweise gemischt — sonst verlöre man beim Holen den Abhak-Stand. Ihr Schlüssel ist deshalb das Paar aus `reise_id` und `person_id`: mit `reise_id` allein überschriebe die zweite Person still die Liste der ersten. Kommt eine Reise ohne Packliste herein, bleibt die hiesige erhalten. **Es gibt keinen Zeitstempel im Datenmodell**: wer zuletzt geschrieben hat, entscheidet der Sync nicht aus den Daten, sondern über die `sha` der Contents-API.

**Der Konflikt wird erkannt, nicht überschrieben.** Die API verlangt beim Schreiben die `sha` der zuletzt gelesenen Fassung; passt sie nicht mehr, antwortet sie mit `409`/`422` und **es wird nichts geschrieben**. Die App zeigt dann drei Wege: *von drüben holen* (führt zusammen), *meinen Stand hochschieben* (ersetzt, bewusst), *nichts tun*. Das ist der ganze Konfliktmechanismus — er braucht weder Server noch Schemaänderung, weil die `sha` die Erkennung trägt.

**Das Token ist ein Passwort.** Ein fein granuliertes PAT, beschränkt auf das eine private Daten-Repo, Berechtigung `Contents: Read and write`. Es liegt **nur** im `localStorage` des Geräts — nie im Code, nie im Build, nie in einer Meldung, nie in einem Log. Wer das entsperrte Gerät in die Hand bekommt, kommt daran; deshalb ein Ablaufdatum und im Verdachtsfall: bei GitHub widerrufen. Die alte `gh`-Anmeldung am Mac ist dafür **nicht** geeignet — sie trägt `repo`-Scope über alle Repositories.

#### Der Preis — bewusst akzeptiert

- **Das Token läuft ab.** Dann scheitert der Sync mit einem `401`, und die Meldung benennt genau das. Bis ein neues Token eingetragen ist, bleiben beide Dateiwege.
- **Das private Repo wird der neue Single Point of Failure.** Ohne Token oder ohne Netz gibt es den Sync nicht. Deshalb werden die Dateiwege (US-09, US-10) **nicht** entfernt — sie sind der Notausgang.
- **Der Katalog am Handy kann verschwinden.** iOS räumt Script-Storage von Websites, die 7 Tage nicht geöffnet wurden. Dann fehlt der Katalog und die App zeigt die Aufforderung. **Kein Datenverlust** — der Master liegt im Repo — aber ein erneutes Holen.
- **Ein Gerät ohne Netz beim ersten Start hat keinen Katalog.** Der leere Zustand bietet deshalb beide Wege an (GitHub **und** Datei), sonst wäre ein frisches Gerät offline aufgeschmissen.

Drei Nebeneffekte, die den Aufwand sofort rechtfertigen:
- Beide Datensätze stehen **unter Versionskontrolle** (git). Die Historie ist lesbar (Zeilen-Diffs pro Item), Backups kosten nichts, und ein Fehlgriff lässt sich mit `git checkout` zurücknehmen.
- Die Deploy-URL enthält weiterhin nichts Persönliches — der Katalog liegt woanders, also bleibt es bei „öffentlich und trotzdem unbedenklich" (O11).
- Getrennte Kataloge pro Person (FF-04) brauchen später nur eine weitere `katalog-<person>.json` — die Reise-Daten bleiben unberührt.

Jede Struktur trägt `version` für spätere Migrationen. Vor jedem Schreiben wird die Vorgängerversion als Backup gesichert.

**Ein zweiter Preis, mit dem Personen-Feature:** `reisen.json` wächst mit jeder Person um eine Liste. Das 1-MB-Limit der Contents-API (`sync.js`) ist die Grenze; sie wird geprüft und **vor** dem Senden gemeldet, es gibt also keinen stillen Verlust — aber sie rückt näher. Bei zwei Personen und einer Handvoll Reisen ist sie weit weg.

---

### 4.6 Personen

Zwei Menschen, eine Reise. Bisher war das nicht abbildbar: es gab **eine** Packliste pro Reise und keinen Begriff von Personen. Das Fundament dafür steht jetzt — die Unterschiede zwischen zwei Menschen sind genau zwei:

| Unterschied | Wo er steht | Wie er wirkt |
|---|---|---|
| **Geschlecht** | an der Person, im globalen Register | als Katalog-Tag `Damen` / `Herren` (§5.1) |
| **eigene Aktivitäten** | an der Person *in dieser Reise* (`teilnehmer`) | als ganz normale Aktivitäts-Tags |

**Personen sind ein globales Register**, keine Eigenschaft einer Reise: `daten.personen = [{ id, name, geschlecht }]`. Wer mitfährt, verweist über `person_id` darauf. Zweimal dieselbe Person auf zwei Reisen heißt also: zwei Verweise, ein Eintrag — das Geschlecht wird einmal gepflegt.

**Aktivitäten sind reisebezogen.** Was jemand auf *dieser* Reise tut (Fotografie, Arbeit), steht am Teilnehmer, nicht an der Person. Sonst müsste man pro Reise doch wieder überschreiben. Ein späteres `person.standard_aktivitaeten` als Vorbelegung bleibt möglich und wäre additiv.

**Wie das Geschlecht auf die Auswahl wirkt.** Der Katalog taggt geschlechtsspezifische Items — `Binden` trägt `Herren` in `nicht_mit`, `Badehose` ebenso. Die Person fügt ihrem Tag-Satz ihr Geschlechts-Tag hinzu; dadurch greift der Ausschluss bei der jeweils anderen Person. Die Begründung für diese Schreibweise steht in §5.1.

**Zwei Listen, zwei Fortschritte.** Eine Reise mit zwei Teilnehmern hat zwei Packlisten, jede mit eigenem Abhak-Stand. Das ist keine Darstellungsfrage: wer gepackt hat, will wissen, ob *sein* Koffer fertig ist. Der Fortschritt einer Liste zählt nur ihre eigenen Häkchen, und die Startansicht zeigt eine Zeile je Person.

**Adressen.** Die Liste einer Person liegt unter `#/liste/:reiseId/:personId`. Die alte Adresse `#/liste/:reiseId` bleibt gültig und landet auf der ersten Person. Die Reise selbst kennt keine Person in ihrer Adresse — sie beschreibt die Reise, nicht den Menschen.

**Eine Person löschen entfernt keine Listen.** Sie fällt aus dem Register und aus allen Reisen, aber die erzeugten Listen bleiben im Bestand: sie sind eine Momentaufnahme (§4.4), und wer gerade packt, soll sie nicht unter den Händen verlieren. Sie sind über ihre Reise weiterhin erreichbar.

**Was hier bewusst noch offen ist:** „wer bringt was mit" (FF-05) und gemeinsame Verbrauchsgüter (FF-06) — Handtuch, Zahnpasta, ein Zelt für zwei. Solange das fehlt, steht jedes Item auf beiden Listen, und wer die Zahnpasta einpackt, muss es selbst wissen. Das ist die ehrliche Grenze dieses Fundaments.

---

## 5. Auswahllogik

### 5.1 Algorithmus

```
tripTags = {saison} ∪ aktivitaeten ∪ {verkehrsmittel} ∪ {unterkunft} ∪ zusatz_tags ∪ {"Allgemein"}

für jedes item im Katalog:
    wenn item.nicht_mit ∩ tripTags ≠ ∅   -> überspringen
    wenn item.tags ∩ tripTags ≠ ∅        -> aufnehmen
    sonst                                -> überspringen

    menge = nach Mengenregel(item, reisetage)

gruppieren nach item.kategorie
sortieren: Kategorien in fester Reihenfolge, Items alphabetisch
```

`"Allgemein"` ist implizit in jeder Reise enthalten — das ist das Fundament, auf dem alles andere aufsetzt (Zahnbürste, Ladegerät, Reisepass). Es lässt sich nicht abwählen: in der Reihe der abgeleiteten Tags steht es zwar mit, aber nicht als Schalter, sondern still — kein Antippen, kein ↺.

**Mit einer Person** kommt deren Geschlechts-Tag dazu, und ihre eigenen Aktivitäten:

```
tripTagsFuerPerson = tripTags(reise) ∪ teilnehmer.aktivitaeten ∪ {Geschlechtstag}
```

Die Aktivitäten der Person werden **nach** `entfernte_tags` hinzugefügt und gewinnen damit: sie sind die ausdrückliche Angabe dieser Person, ein Streichen an der Reise gilt für sie nicht. `Damen`/`Herren` stehen **nicht** in `TAG_GRUPPEN` — sie sind kein Reise-Kontext, sondern eine Personen-Eigenschaft, und tauchen deshalb in keinem Chip und keiner Vorschlagsliste des Reise-Formulars auf.

#### Das Geschlecht steht in `nicht_mit`, nicht in `tags`

Ein geschlechtsspezifisches Item trägt das **andere** Geschlecht als Ausschluss:

```
Item "Binden"   { tags: ["Allgemein"],            nicht_mit: ["Herren"] }
Item "Bikini"   { tags: ["Sommer", "Strand"],     nicht_mit: ["Herren"] }
Item "Badehose" { tags: ["Sommer", "Strand"],     nicht_mit: ["Damen"]  }
```

Das ist nicht Geschmack, sondern Notwendigkeit — die andere Schreibweise ist kaputt. Trüge `Badehose` stattdessen `tags: ["Herren"]`, wäre sie auf **jeder** Reise des Mannes dabei, auch auf der Winterreise. Trüge sie `["Sommer", "Strand", "Herren"]`, wäre sie im Sommer bei **allen** dabei, auch bei der Frau: die Auswahl ist eine Oder-Verknüpfung über die Tags, ein „Herren **und** Sommer" lässt sich darin nicht ausdrücken.

Der Ausschluss dagegen kombiniert sich sauber mit allem anderen: `nicht_mit` hat Vorrang vor den positiven Tags (§5.3), also bleibt „nur für ihn" mit „nur im Sommer" verträglich. Möglich ist das, weil das Geschlechts-Tag der Person im Tag-Satz liegt — für Ben greift `nicht_mit: ["Herren"]`, für Anna nicht.

Die Pflegeregel für den Katalog lautet damit: **ein Geschlecht gehört immer in `nicht_mit`, nie in `tags`.**

Eine Reise ohne Teilnehmer hat kein Geschlechts-Tag, also greift auch kein Ausschluss: die Liste enthält dann beide Geschlechter-Items. Das ist der Altbestand (§4.6) und die richtige Voreinstellung — lieber zu viel als ein fehlendes Medikament.

### 5.2 Beispiel

Reise: 10 Tage, Saison `Sommer`, Aktivität `Tauchen`, Verkehrsmittel `Flugzeug`, Unterkunft `Ferienwohnung`
→ `tripTags = {Sommer, Tauchen, Flugzeug, Ferienwohnung, Allgemein}`

| Item | Kategorie | Tags | Ergebnis |
|---|---|---|---|
| T-Shirt | Kleidung | Sommer, Allgemein | ✅ 4× (1/3 Tage, max 6) |
| Badehose | Kleidung | Sommer, Tauchen | ✅ 2× |
| Tauchanzug | Tauchausrüstung | Tauchen | ✅ 1× |
| Nackenkissen | Haushalt & Sonstiges | Flugzeug | ✅ 1× |
| Zip-Beutel 1 l | Taschen & Ordnung | Flugzeug | ✅ 1× |
| Wanderschuhe | Schuhe | Winter, Camping | ❌ kein Treffer |
| Zahnbürste | Kosmetik & Pflege | Allgemein | ✅ 1× |
| Sonnencreme | Kosmetik & Pflege | Sommer, Flugzeug | ✅ 1× |

Die letzten beiden Zeilen zeigen, warum Verkehrsmittel-als-Tag besser ist als ein Warnsystem: Die Flugzeug-Regel "Flüssigkeiten nur im 1-L-Beutel" steckt nicht in Sonderlogik, sondern darin, dass Sonnencreme und Zip-Beutel beide das Tag `Flugzeug` tragen. Kein Regelwerk, keine Warnung — nur Tags.

### 5.3 Ausschluss-Tags

Ein Item kann Tags haben, die es **aktiv ausschließen**:

```
Item "Binden" { tags: ["Allgemein"], nicht_mit: ["Herren"] }
```

**Wann das gebraucht wird**: Positive Tags reichen weiter, als es zunächst scheint. Ein Handtuch, das nur `Camping` und `Ferienwohnung` trägt, landet bei einer Hotelreise ohnehin nicht auf der Liste — es braucht kein `nicht_mit: ["Hotel"]`. Der Ausschluss wird erst gebraucht, wenn ein Item **notwendigerweise** einen breiten Tag trägt, in einer bestimmten Situation aber trotzdem nicht mitkommt. `Binden` ist genau dieser Fall: `Allgemein` muss es tragen, damit es auf jede Reise geht — für einen Mann ist es trotzdem nichts. Dass der Ausschluss greift, liegt daran, dass das Geschlechts-Tag der Person im Tag-Satz liegt (§5.1).

**Stand im Katalog**: Ausschlüsse gibt es heute nur für das Geschlecht (§5.1). Der Fall „breiter Tag, falsche Situation" kam mit dem Tag `Städtetrip` in den Katalog und ging mit ihm wieder (Version 1.10): `Badehose` war auf einem Städtetrip im Sommer Ballast, aber `Sommer` muss sie tragen. Die Regel bleibt, der Bedarf ist derzeit gedeckt.

**Priorität**: P1, nicht P0. Das Feld wird im Datenmodell von Anfang an vorgesehen, damit keine Migration nötig wird; die UI dafür kommt erst, wenn der Bedarf beim Pflegen des echten Katalogs auftritt.

---

## 6. Excel-Import

Der Import ist der Übergang vom Status quo in die App und damit der Punkt mit dem höchsten Migrationsrisiko.

### 6.1 Mapping

Die Excel-Spalten werden wie folgt gelesen:

| Spaltentyp | Beispiel | Ziel |
|---|---|---|
| Kategorie-Spalte | Kleidung, Technik, Kosmetik, Medizin, Schuhe | `item.kategorie` |
| Kontext-Spalte | Winter, Sommer, Festival, Allgemein, Tauchen, Camping | `item.tags` |
| Item-Spalte | Spalte mit dem Item-Namen | `item.name` |

Eine Zuordnungstabelle (welche Spalte ist Kategorie, welche ist Kontext) wird beim Import einmalig bestätigt und danach gespeichert.

### 6.2 Regeln

- **Ein X pro Kategorie-Spalte** → diese wird zur `kategorie`.
- **Mehrere X in Kategorie-Spalten** → Konflikt. Erste Spalte gewinnt, der Fall landet im Import-Report.
- **Kein X in einer Kategorie-Spalte** → `kategorie = "Sonstiges"`, landet im Report.
- **Mengenregel** → beim Import `einmal` als Default; der Nutzer pflegt die Ausnahmen danach gezielt nach.
- **Tag `Tauchen`** → Items mit diesem Tag bekommen beim Import *nicht* automatisch die Kategorie `Tauchausrüstung`. Der Report listet sie zur manuellen Prüfung, weil in der Spalte `Tauchen` auch Dinge stecken können, die keine Ausrüstung sind (Netzbeutel, Handtuch, Booties).

### 6.3 Vorbereitung der Quelldatei

Zwei Fallen, die vor dem ersten Import geklärt sein müssen:

**Formel-Spalten ausschließen.** Die Excel-Tabelle enthält zusätzlich zu den Tag-Spalten je eine Formel-Spalte pro Tag ("Automation", die Items auflistet). Diese Spalten tragen dieselben Namen wie die Tag-Spalten und würden beim Einlesen als Duplikate erscheinen. Der Importer lässt deshalb Spalten einzeln auswählen und markiert Namensdubletten sichtbar.

**Trennzeichen.** Deutsches Excel exportiert CSV standardmäßig mit **Semikolon** und Dezimalkomma, nicht mit Komma. Der Importer erkennt beide Trennzeichen automatisch. Export als **CSV UTF-8**, damit Umlaute (ä, ö, ü, ß) in Item-Namen und Tags nicht kaputtgehen.

### 6.4 Import-Report

Der Import endet mit einer Zusammenfassung: Anzahl importierter Items, Konflikte, Items ohne Kategorie, unbekannte Spalten. Der Report ist Pflicht — ein stiller Fehlimport vergiftet den ganzen Katalog, und das fällt erst Wochen später auf.

**Wichtig**: Der Import läuft auf einer Kopie. Die Original-Excel bleibt unangetastet.

---

## 7. User Stories

### US-01 — Katalog pflegen *(nicht im MVP — erste Überarbeitung, siehe FF-16)*
> Als Nutzerin möchte ich Items mit Kategorie, Tags und Mengenregel anlegen und bearbeiten, damit mein Bestand die Wahrheit über meine Dinge ist.

> **Im MVP ersetzt durch**: Pflege über das Repo — Import-Skript beim Erstaufbau, danach gezielte Änderungen an `katalog.json` im Daten-Repo (§3.3, §3.6). Die Akzeptanzkriterien unten beschreiben das Zielbild der ersten Überarbeitung.

**Akzeptanzkriterien**
- [ ] Item anlegen mit Name, genau einer Kategorie, beliebig vielen Tags
- [ ] Mengenregel über drei Varianten wählbar, mit Vorschau des Ergebnisses
- [ ] Item bearbeiten und löschen
- [ ] Liste aller Items, filterbar nach Kategorie und Tag

### US-02 — Bestand importieren
> Als Nutzerin möchte ich meine Excel-Tabelle einmalig importieren, damit ich nicht alles von Hand abtippe.

**Akzeptanzkriterien**
- [ ] CSV/Excel-Datei auswählbar
- [ ] Spalten-Zuordnung wird vorgeschlagen und ist korrigierbar
- [ ] Import-Report zeigt Konflikte und Lücken
- [ ] Import bricht bei Fehlern ab, ohne den Katalog zu verändern

### US-03 — Reise beschreiben
> Als Nutzerin möchte ich eine Reise in einem Formular beschreiben, damit die App weiß, was ich brauche.

**Akzeptanzkriterien**
- [ ] Felder: Name, Ziel, Zeitraum, Saison, Aktivitäten, Verkehrsmittel, Unterkunft
- [ ] Reisetage werden aus dem Zeitraum berechnet und angezeigt
- [ ] Abgeleitete Tags sind sichtbar und einzeln entfernbar
- [ ] Neuen Tag/Aktivität frei eintippen und für die Reise verwenden
- [ ] Auswahl der Saison/Aktivität als Vorschlagsliste plus Freitext

### US-04 — Packliste erzeugen
> Als Nutzerin möchte ich auf Knopfdruck eine Packliste bekommen, damit ich nicht mehr selbst auswähle.

**Akzeptanzkriterien**
- [ ] Liste enthält alle Items, deren Tags zur Reise passen
- [ ] Mengen sind berechnet und sichtbar
- [ ] Gruppierung nach Kategorie in fester Reihenfolge
- [ ] Leere Kategorien werden ausgeblendet
- [ ] Erzeugung dauert unter 200 ms

### US-05 — Liste nachjustieren
> Als Nutzerin möchte ich die Liste pro Reise anpassen können, ohne meinen Katalog zu verändern, damit Sonderfälle möglich sind.

**Akzeptanzkriterien**
- [ ] Item aus der Liste entfernen (nur diese Reise)
- [ ] Item zur Liste hinzufügen, auch wenn Tags nicht passen
- [ ] Menge einer Position ändern
- [ ] Manuell geänderte Positionen sind als solche erkennbar
- [ ] **Katalog bleibt unverändert**

### US-06 — Abhaken
> Als Nutzerin möchte ich Items beim Packen abhaken, damit ich weiß, was noch fehlt.

**Akzeptanzkriterien**
- [ ] Checkbox pro Position, Zustand bleibt erhalten
- [ ] Fortschritt sichtbar (gepackt / gesamt)
- [ ] Abgehakte Positionen bleiben sichtbar (nicht ausblenden)

### US-07 — Liste mitnehmen
> Als Nutzerin möchte ich die Liste als Text exportieren, damit ich sie am Handy beim Packen dabeihabe.

**Akzeptanzkriterien**
- [ ] Export als Markdown-Checkliste in die Zwischenablage
- [ ] Gruppierung und Mengen bleiben erhalten
- [ ] Nur ungepackte Positionen exportierbar

### US-08 — Retrospektive *(im MVP nur das Freitextfeld)*
> Als Nutzerin möchte ich nach der Reise festhalten, was gefehlt hat, damit die Liste beim nächsten Mal besser ist.

> **Eingeschränkt im MVP**: Das Freitextfeld bleibt. „Aus einem Eintrag direkt ein Item anlegen" setzt einen schreibenden Katalog-Editor voraus und wandert mit FF-16 — im MVP wird das Item per Commit im Daten-Repo angelegt (die Tags der Reise stehen im Retro-Eintrag dafür bereit).

**Akzeptanzkriterien**
- [ ] Freitextfeld "Was hat gefehlt?" an einer Reise
- [ ] Aus einem Eintrag direkt ein Item anlegen, vorbelegt mit den Tags dieser Reise *(erst mit FF-16)*
- [ ] Vermerk, aus welcher Reise das Item stammt *(erst mit FF-16)*

### US-09 — Katalog ins Gerät holen
> Als Nutzerin möchte ich meinen Katalog mit einem Button ins Gerät holen, damit die App unterwegs weiß, was ich besitze.

**Akzeptanzkriterien**
- [ ] „Aus GitHub holen" lädt `katalog.json` aus dem privaten Daten-Repo
- [ ] Alternativ öffnet die Dateiauswahl die Dateien; iCloud Drive ist direkt erreichbar — dieser Weg funktioniert **ohne Netz** und ohne Token
- [ ] Die Datei wird geprüft (Format, `version`, Pflichtfelder) und erst dann übernommen
- [ ] Bei ungültiger Datei: verständliche Meldung, **bestehender Katalog bleibt unangetastet**
- [ ] Nach dem Holen zeigt die App die Item-Anzahl und die Menge der übernommenen Regeln
- [ ] Fehlt der Katalog (erster Start oder nach einer Räumung), zeigt die App eine Aufforderung statt einer leeren Liste — mit **beiden** Wegen

### US-10 — Daten sichern
> Als Nutzerin möchte ich meine Reisen mit einem Button als Datei exportieren, damit meine Arbeit nicht nur im Browser eines Geräts liegt.

**Akzeptanzkriterien**
- [ ] Export-Button übergibt die Reise-Daten an das Teilen-Menü des Systems
- [ ] iCloud Drive, AirDrop und Mail sind ohne Zusatzarbeit wählbar
- [ ] Der Export ist eine gültige Datei, die US-09 wieder einlesen kann
- [ ] Der Export verändert nichts am lokalen Bestand
- [ ] Der Dateiweg bleibt neben dem Sync bestehen — ohne Netz oder ohne Token ist er der Notausgang

### US-11 — Zwischen Geräten abgleichen
> Als Nutzerin möchte ich Katalog und Reisen zwischen Handy und Mac abgleichen, ohne dass dabei etwas verloren geht.

**Akzeptanzkriterien**
- [ ] Der Abgleich läuft **nur auf Knopfdruck** — nie beim Start, nie im Hintergrund
- [ ] Ohne Netz oder ohne Token meldet die App das verständlich und läuft aus dem `localStorage` weiter
- [ ] Repo und Token sind in der App einstellbar; das Token liegt nur im `localStorage` und wird **nie** zurück ins DOM geschrieben
- [ ] Ein Token lässt sich löschen, ohne das Repo zu vergessen
- [ ] Hochschieben liest vorher die `sha` und schreibt mit ihr; liegt drüben inzwischen etwas anderes, wird **nichts** geschrieben und der Konflikt gemeldet
- [ ] Liegt drüben eine Reise, die es hier nicht gibt, wird vor dem Hochschieben gefragt
- [ ] Holen führt über die `id` zusammen: gleiche Reise wird ersetzt, neue kommen dazu, hiesige bleiben
- [ ] Ein unbrauchbarer Stand drüben lässt den hiesigen Bestand unangetastet
- [ ] Eine Fehlermeldung enthält **nie** das Token
- [ ] Nach einem Konflikt sind **beide** Stände noch vollständig da, und es gibt drei Wege: holen, hochschieben, nichts tun

---

## 8. Funktionale Anforderungen

| ID | Anforderung | Prio |
|---|---|---|
| FR1 | Items anlegen, lesen, bearbeiten, löschen | P0 — im MVP über `katalog.json` im Daten-Repo (§3.6); UI-Editor folgt als FF-16 |
| FR2 | Item hat genau eine Kategorie und beliebig viele Tags | P0 |
| FR3 | Drei Mengenregel-Varianten; Editor-Vorschau „= 4 Stück für 10 Tage" | P0 — Varianten P0, Editor-Vorschau erst mit FF-16. Die *berechnete* Menge bleibt in der fertigen Liste sichtbar (FR7, FR8) |
| FR4 | Reise-Formular mit automatischer Tag-Ableitung | P0 |
| FR5 | Freitext-Tags im Formular anlegen | P0 |
| FR6 | Regel-Engine mit Tag-Schnittmenge und Ausschluss | P0 |
| FR7 | Mengenberechnung aus Reisedauer | P0 |
| FR8 | Gruppierte, abhakbare Ausgabe | P0 |
| FR9 | Reise-lokale Overrides am Katalog vorbei | P0 |
| FR10 | Excel/CSV-Import mit Report | P0 |
| FR11 | Datenhaltung: `localStorage` als Arbeitskopie, privates Daten-Repo als Master | P0 |
| FR12 | Export als Markdown | P1 |
| FR13 | Verkehrsmittel fließt als Tag in `tripTags` ein | P0 |
| FR14 | Reise speichern, laden, duplizieren | P1 |
| FR15 | Retro-Eintrag, der ein Item erzeugt | P1 — Item-Erzeugung setzt FF-16 voraus; im MVP nur das Freitextfeld (US-08) |
| FR16 | Item-Suche und Filter | P2 — mit FF-16 |
| FR17 | Katalog ins Gerät holen — aus dem Daten-Repo oder per Dateiauswahl, in beiden Fällen validiert | P0 |
| FR18 | Reise-Daten als Datei exportieren (Share-Sheet) | P0 |
| FR19 | Leerer-Zustand-Ansicht, die zum Holen auffordert — mit beiden Wegen | P0 |
| FR20 | Sync-Einstellungen (Repo, fein granuliertes Token) im `localStorage`; das Token wird **nie** ins DOM zurückgeschrieben und ist löschbar, ohne das Repo zu vergessen | P0 |
| FR21 | Reisen hochschieben: vorher `sha` lesen, damit schreiben, bei Abweichung nichts schreiben und den Konflikt melden | P0 |
| FR22 | Reisen holen und über die `id` zusammenführen (gleiche ersetzt, neue dazu, hiesige bleibt) | P0 |
| FR23 | Einen unbrauchbaren Stand drüben abweisen, ohne den hiesigen Bestand anzutasten | P0 |
| FR24 | Sync-Fehler als verständlicher deutscher Satz; **ohne Netz läuft die App weiter** und keine Meldung enthält das Token | P0 |

---

## 9. Nicht-funktionale Anforderungen

| Bereich | Anforderung |
|---|---|
| Sprache | UI komplett Deutsch, keine Internationalisierung |
| Plattform | Reine Browser-App; im MVP **am Handy** bedienbar (iOS Safari). Die Katalogpflege am Mac kommt erst mit FF-16 und braucht dort Chrome (File System Access API, §3.6) |
| Betrieb | Statisch gehostet (§3.6), kein Server-Prozess, kein Login. Die App ist ohne laufenden Laptop nutzbar |
| Datenschutz | Keine Telemetrie. **Genau ein externer Aufruf**: `api.github.com` beim Sync, und nur auf Knopfdruck (FR21–FR24). Alle Daten bleiben im `localStorage` des Geräts. **Das Deployment enthält nur die App-Hülle** — kein Katalog, keine Reisen. Die Deploy-URL ist damit öffentlich und trotzdem unbedenklich (O11, entschieden) |
| Geheimnis | Das Token liegt **nur** im `localStorage`; es steht nicht im Code, nicht im Build, nicht in einer Meldung, nicht in einem Log und nie in einer URL. Es ist auf ein privates Repo beschränkt und läuft ab (§4.5) |
| Offline | **Der Sync blockiert nie.** Ohne Netz startet die App, zeigt alle Reisen und Listen und meldet den fehlenden Sync als Satz, nicht als Ausnahme. Der Dateiweg (FR17, FR18) braucht kein Netz |
| Performance | Listen-Erzeugung < 200 ms bei 500 Items |
| Zuverlässigkeit | Backup der JSON vor jedem Schreiben; Export als Notausgang |
| Bedienbarkeit | Am Handy einhändig bedienbar; Touch-Ziele ≥ 44 px |
| Barrierefreiheit | Ausreichender Kontrast; Abhaken auch ohne Maus |

---

## 10. Erfolgsmetriken

| Metrik | Baseline | Ziel | Messung |
|---|---|---|---|
| Zeit bis fertige Packliste | ~20 min | < 2 min | Stoppuhr, 3 Reisen |
| Vergessene Items | unbekannt | 0 | Retro-Einträge pro Reise |
| Listen ohne manuelle Nacharbeit | — | > 80 % | `manuell_hinzugefuegt`-Anteil pro Liste |
| Nachträge pro Reise | — | sinkend | Verlauf über Reisen |
| Katalog-Abdeckung | — | wachsend | Items mit gepflegter Mengenregel |

Bewusst keine Vanity-Metriken: Bei einem Solo-Werkzeug zählt nur, ob das eigene Packen besser wird. Die ehrlichste Zahl ist "vergessene Items pro Reise" — und die kennt nur die Retrospektive (US-08).

---

## 11. Risiken

| Risiko | Wahrsch. | Impact | Gegenmaßnahme |
|---|---|---|---|
| Excel-Import liefert Müll | Hoch | Hoch | Import-Report, Trockenlauf, Original unangetastet lassen |
| Übermodellierung der Tags | Mittel | Mittel | Tags bleiben Strings; Kategorien bleiben eine flache Liste |
| Regel-Engine stößt an Grenzen | Mittel | Mittel | Overrides pro Reise (US-05) als Ventil, nicht als Regel-Erweiterung |
| Datenverlust des Katalogs | Niedrig | Hoch | Katalog und `import/` liegen im privaten Daten-Repo (git), Backup vor jedem Schreiben, Export als Notausgang |
| **Token läuft ab** | Hoch | Mittel | Fein granulierte PATs haben ein Ablaufdatum. Der Sync scheitert dann mit `401`; die Meldung benennt genau das, und beide Dateiwege bleiben |
| **Token kompromittiert** | Niedrig | Hoch | Auf **ein** privates Repo beschränkt und mit `Contents: Read and write` statt `repo`. Im Verdachtsfall bei GitHub widerrufen — der Verlust kostet dann nur den Sync, nicht die Daten. Das Token steht nie in einer Meldung oder einem Log |
| **Sync-Konflikt** | Mittel | Mittel | Die `sha` verhindert stilles Überschreiben (FR21). Nach einem Konflikt sind beide Stände da und die Entscheidung liegt beim Menschen |
| **Zwei Geräte, ein Stand** | Mittel | Mittel | Hochschieben ersetzt die Datei drüben. Liegt dort eine Reise, die es hier nicht gibt, wird vorher gefragt — die `sha` allein fängt das nicht, weil sie nur gleichzeitige Schreibvorgänge erkennt |
| **Veröffentlichter Stand lässt sich nicht zurückholen** | Niedrig | Hoch | Katalog und `import/` kommen gar nicht erst ins öffentliche Repo. Ein einmal veröffentlichter Stand wäre über Forks und Archive unentfernbar |
| Scope Creep durch Future Features | Hoch | Mittel | Dieses Dokument; Future Features bleiben ausgeschlossen |
| Migrationsaufwand frustriert vor dem ersten Nutzen | Mittel | Hoch | Import ist P0 — Nutzen muss in Woche 2 erreichbar sein |
| Kategorien tragen nicht (11 sind zu viele oder zu wenige) | Mittel | Mittel | Kategorien sind reine Strings; Umbenennen und Zusammenführen ist ein Datensatz-Fix, kein Umbau. Erste Bewährung: der Import der echten Tabelle |

---

## 12. Zeitplan

Solo, Abendarbeit, parallel zum Kurs. Vier Wochen bis nutzbarer MVP.

| Woche | Meilenstein | Ergebnis | Fertig, wenn |
|---|---|---|---|
| 1 | Fundament + Katalog | Vite-Setup, JSON-Schema, `engine.js` mit Tests, `katalog.json` aus dem Import-Skript | Die Engine wählt aus 333 echten Items korrekt aus — testbar ohne eine einzige Ansicht |
| 2 | Reise-Formular + Persistenz | Katalog-Import (US-09), Leerer-Zustand (FR19), Reise anlegen, Tag-Ableitung, `store.js` (localStorage, Backup, Share-Export), Deployment der App-Hülle | Eine Reise ist **am Handy** beschreibbar, überlebt einen Neustart und lässt sich als Datei sichern |
| 3 | Ausgabe | Gruppierte Liste, Mengen sichtbar, Abhaken | Eine echte Reise erzeugt eine brauchbare Liste |
| 4 | Feinschliff | Markdown-Export, Retro-Freitext, Overrides, Katalogpflege über Repo erproben | Erste echte Reise wird damit gepackt |

**Verschiebung gegenüber 1.1**: Der Katalog-Editor fällt aus Woche 1 heraus (FF-16). Woche 1 wird dadurch nicht kleiner, sondern **risikoärmer** — die Engine ist eine reine Funktion und lässt sich gegen den echten Katalog testen, bevor eine einzige Ansicht existiert. Der Import rückt von Woche 2 auf Woche 1 vor, weil er den Katalog liefert, gegen den getestet wird.

**Erster echter Einsatz**: Ende Woche 4. Das ist der Zeitpunkt, an dem sich zeigt, ob das Modell trägt.

---

## 13. Offene Fragen

| # | Frage | Entscheidung |
|---|---|---|
| O1 | Eine JSON-Datei oder eine pro Entität? | ✅ **Getrennt gehalten**, aber in zwei Medien: `katalog.json` als versionierte Datei (wertvoll), Reisen und Packlisten im `localStorage` (regenerierbar). Siehe §4.5 |
| O2 | Wie wird eine Mengenregel editiert? | ✅ **Zielbild gelöst, aber nicht im MVP.** Drei Radiobuttons, genau einer aktiv; bei `fest` und `pro_tage` werden die Zahlenfelder eingeblendet — **Rohfelder, kein Assistent.** Dazu Live-Vorschau „= 4 Stück für 10 Tage". Im MVP wird die Regel direkt in `katalog.json` gesetzt; der Editor ist FF-16 |
| O3 | Kann ein Item mehrere Kategorien haben? | ✅ **Nein, genau eine.** Diving-Gear bekommt die eigene Kategorie `Tauchausrüstung` |
| O4 | Ausschluss-Tags schon im MVP? | ✅ **Feld jetzt, UI später** — wie in §5.3 |
| O5 | Packliste als Snapshot oder live berechnet? | ✅ **Snapshot.** Sonst gehen Overrides (F6) und Häkchen (F5) bei jedem Render verloren |
| O6 | Verbrauchsmaterial pro Tag rechnen? | ✅ **Nein.** `fest` genügt — siehe §4.2 |
| O7 | Verkehrsmittel: Sperre, Warnung oder Tag? | ✅ **Tag.** Kein Regelwerk, keine Warnungen — siehe §4.3 |
| O8 | Kategorien im Import aus Spalten oder Mapping-Tabelle? | Offen — technische Detailfrage, wird beim Import-Spike entschieden. Blockiert nichts |
| O9 | Grundreihenfolge der Kategorien in der Ausgabe? | ✅ **Die Reihenfolge aus Anhang B.1**: Dokumente & Wertsachen zuerst, Sonstiges zuletzt |
| O10 | Tags in der UI gruppiert darstellen? | ✅ **Ja, gruppiert** (Klima, Verkehr, Aktivität, Unterkunft). Gespeichert wird flach — die Gruppierung ist reine Darstellung und ändert das Datenmodell nicht |
| O11 | Wie wird `katalog.json` vor fremdem Zugriff geschützt? | ✅ **Entschieden: durch ein privates Repo.** Der Katalog liegt in einem **privaten** Daten-Repo, nicht im App-Repo und nicht im Deployment. Weil er Medikamente nennt, ist das kein „erübrigt sich" mehr, sondern eine echte Anforderung. Das öffentliche App-Repo trägt nur die Hülle; die Deploy-URL darf damit öffentlich sein, und es braucht weder Passwort noch Cloudflare Access (§4.5) |
| O12 | Gist oder privates Repo als Datenspeicher? | ✅ **Privates Repo.** „Secret" heißt bei GitHub nur *nicht gelistet* — jeder mit der URL liest mit. Dazu gilt ein Gist-Token für **alle** Gists, ein fein granuliertes Repo-Token dagegen für genau eines |
| O13 | Braucht der Sync eine Merge-Regel? | ✅ **Nein, aber ein `sha`.** Zusammengeführt wird über die `id` (gleiche ersetzt, Neues dazu) — das ist keine Feld-Merge-Regel und braucht keinen Zeitstempel. Ob drüben inzwischen etwas anderes liegt, erkennt die `sha` der Contents-API, nicht die Daten (§4.5) |
| O14 | Wie wird das Geschlecht einer Person abgebildet — neues Item-Feld oder Tag? | ✅ **Als Tag** (`Damen`/`Herren`), kein neues Feld am Item. Ein Feld hätte die Auswahllogik (§5.1) um eine zweite, andersartige Achse erweitert; als Tag fügt es sich in die bestehende Oder-Verknüpfung ein. **Aber in `nicht_mit`, nicht in `tags`** — die Begründung steht in §5.1 und ist keine Geschmacksfrage: als positives Tag ließe sich „nur für ihn" nicht mit einer Saison kombinieren |
| O15 | Wo lebt eine Person — global oder je Reise? | ✅ **Global.** Ein Register `daten.personen`; die Reise verweist nur über `person_id` (§4.6). Sonst müsste man dieselbe Person auf jeder Reise neu anlegen und ihr Geschlecht mehrfach pflegen |
| O16 | Gehören die eigenen Aktivitäten an die Person oder an die Reise? | ✅ **An die Reise** (`teilnehmer.aktivitaeten`). Was jemand auf *dieser* Reise tut, ist keine Personeneigenschaft. Eine Vorbelegung an der Person bleibt als additives `person.standard_aktivitaeten` möglich |

**Nur noch eine Frage ist wirklich offen** (O8), und sie ist technisch statt fachlich — sie wird beim Import-Spike entschieden und blockiert nichts. Das fachliche Fundament steht.
---

## 14. Future Features (bewusst nicht im MVP)

Nach Wert für das Kernproblem geordnet — nicht nach Umsetzungsaufwand.

### Erste Überarbeitung — direkt nach dem MVP

**FF-16 · Katalog-Editor in der UI** *(aus dem MVP verschoben — siehe US-01, FR1, FR3, FR15)*
Item-CRUD, Mengenregel-Editor mit Live-Vorschau (FR3), Liste filterbar nach Kategorie und Tag. Bringt einen Schreibweg für den Katalog ins Spiel: Chrome auf macOS über die File System Access API, direktes Schreiben in `katalog.json` des **Daten-Repos**, Backup vor jedem Schreiben — oder der Weg über die Contents-API, den `src/sync.js` schon bereitstellt.

**Was der Sync dafür schon mitbringt**: die Contents-API samt Validierung und Konflikterkennung liegt fertig in `src/sync.js`; ein Katalog-Push wäre derselbe Weg wie `schiebeReisen`. Was fehlt, ist die Bedienung (FR3), nicht der Transport.

**Zieht zwei Fragen mit sich**, die dann zu entscheiden sind: Wird der Katalog am Handy dadurch schreibbar (Stufe C), und wie werden Items zusammengeführt (`import/erwartungen.json` ist mit dem Umzug ins private Repo aus dem öffentlichen Testpfad heraus). Die Live-Vorschau wird erst mit ihm möglich. Und der Retro-Direktweg (US-08/FR15) setzt ihn voraus.

**Warum verschoben**: Der Erstaufbau des Katalogs ist Bulk-Arbeit an 333 Items und gehört in ein Skript. Für die ersten echten Reisen genügt das Repo als Pflegeweg. Der Editor lohnt sich erst, wenn der Katalog steht und Einzeländerungen häufig werden.

**Was ohne ihn fehlt**: die Live-Vorschau der Mengenregel (§4.2), der Direktweg Retro → Item (US-08/FR15) und die Tag-Verwaltung (FF-11).

### Stufe 1 — macht das Werkzeug mit der Zeit besser

**FF-01 · Retrospektive als Lernschleife** *(teilweise in MVP als US-08)*
Nach jeder Reise erfassen, was gefehlt hat, und daraus Katalog-Einträge erzeugen. Das ist das einzige Feature, das die Kernbeschwerde "ich vergesse Dinge" dauerhaft adressiert statt nur einmalig. Ausbaustufe: Muster erkennen — "bei Tauchen fehlt dir dreimal etwas aus Medizin" → Vorschlag, ein Tag zu ergänzen.

**FF-02 · Item-Vorschläge mit Besitz-Abfrage**
Die App kennt typische Items pro Aktivität (aus einem mitgelieferten Katalog oder per LLM). Wenn eine Reise den Tag `Tauchen` hat und kein Tauch-Item im Katalog liegt: "Besitzt du eine Tauchmaske?" → bei Ja wird ein Item mit `im_besitz: true` angelegt. Genau hier zahlt sich das bereits vorgesehene Feld `im_besitz` aus.

**FF-03 · LLM-gestützte Verfeinerung**
Das Regel-Ergebnis geht an ein LLM mit der Frage: "Fehlt hier etwas für diese Reise?" Die Regeln bleiben die Quelle der Wahrheit — das LLM ergänzt nur Vorschläge. Damit bleibt das System reproduzierbar, und der LLM-Einsatz ist ein Add-on statt einer Abhängigkeit.

### Stufe 2 — Mehrbenutzer

*Das Fundament dieser Stufe steht seit `version: 2` (§4.6): ein Personen-Register, Teilnehmer je Reise, eine Packliste pro Person mit eigenem Fortschritt. Was hier noch steht, baut darauf auf.*

**FF-04 · Getrennte Kataloge pro Person**
Jede Person hat ihren eigenen Bestand. Voraussetzung dafür, dass Partner und Freunde mitmachen.
*Heute gilt ein gemeinsamer Katalog mit `im_besitz` — wer ein Item nicht besitzt, sieht es trotzdem.*

**FF-05 · Geteilte Reisen mit Zuständigkeiten**
Eine Reise, mehrere Personen, pro Item eine Zuordnung "wer bringt das mit". Löst das Doppelt-Packen von Dingen, die nur einmal gebraucht werden (Föhn, Reiseapotheke, Tauchlampe).
*Fundament steht (§4.6): Personen, Teilnehmer und getrennte Listen gibt es. Offen ist die Zuordnung selbst — sie setzt eine gemeinsame Sicht auf beide Listen voraus, und die gibt es noch nicht.*

**FF-06 · Gemeinsame Verbrauchsgüter**
Sonnencreme, Shampoo: eine Person bringt, alle nutzen. Verbindet sich mit FF-05.
*Bis dahin steht jedes Item auf beiden Listen (§4.6).*

### Stufe 3 — Komfort

**FF-07 · Vorlagen aus vergangenen Reisen**
"Standard-Sommer-Tauchurlaub" als wiederverwendbares Profil.

**FF-08 · Wetter-Integration**
Saison und Items automatisch aus Ziel und Reisezeitraum ableiten.

**FF-09 · Gewichts- und Gepäcklimits**
Gepäckregeln der Airline hinterlegen, Gewicht pro Item, laufende Summe. Verbindet sich mit FF-13.

**FF-10 · Packen nach Tasche**
Zuordnung Item → Tasche, plus Checkliste pro Tasche.

**FF-11 · Tag-Verwaltung**
Tags umbenennen, zusammenführen, löschen über viele Items.

**FF-12 · PWA / Offline**
Liste ohne Netz am Handy, echte Checkbox-Interaktion unterwegs. Wird wichtig, sobald das Tool produktiv genutzt wird — beim Tauchen gibt es selten WLAN. **Zweiter Grund seit 1.3**: Als installierte Web-App ist der Speicher nach meinem Kenntnisstand von der 7-Tage-Räumung ausgenommen — das würde den Katalog am Handy dauerhaft halten und den Re-Import aus §4.5 ersparen (noch zu verifizieren).

**FF-13 · Ausgabeformate**
PDF, Druck, Kalender-Export (Packen einen Tag vorher erinnern).

**FF-14 · Erinnerungen**
"Deine Reise startet in 3 Tagen — Liste ist zu 60 % abgehakt."

**FF-15 · Packhistorie und Statistiken**
Welche Items kommen nie mit? Was wurde noch nie benutzt? → Katalog ausdünnen.

---

## 15. Anhang

### A. Glossar

| Begriff | Bedeutung |
|---|---|
| **Item** | Ein konkreter, physischer Gegenstand im Besitz des Nutzers |
| **Kategorie** | Typ des Items — bestimmt die Gruppierung der Liste |
| **Kontext-Tag** | Ort, Zeit oder Aktivität — bestimmt die Auswahl |
| **Reise** | Beschreibung einer konkreten Fahrt |
| **Packliste** | Materialisiertes Ergebnis der Auswahl für eine Reise |
| **Mengenregel** | Vorschrift, die aus der Reisedauer eine Stückzahl macht |

### B. Kategorien und Tags

> **Status: abgestimmt (2026-10-07).** Spalte *Quelle*: `Excel` = war in der Tabelle vorhanden, `neu` = Ergänzung.

#### B.1 Kategorien

Reihenfolge = Anzeigereihenfolge. Essentials zuerst, Ausrüstung in der Mitte, Sonstiges am Ende.

| # | Kategorie | Quelle | Anmerkung |
|---|---|---|---|
| 1 | **Dokumente & Wertsachen** | neu | **Wichtigste Lücke der bisherigen Tabelle.** Reisepass, Impfpass, Versicherung, Tickets, Führerschein, Bargeld, Karten. Das Vergessen dieser Dinge ist der teuerste Fehlerfall überhaupt — deshalb oben |
| 2 | Kleidung | Excel | Größte Kategorie; bleibt vorerst eine |
| 3 | Schuhe | Excel | Zu Recht separat — braucht viel Platz, eigener Packschritt |
| 4 | Kosmetik & Pflege | Excel | Um Hygiene erweitert (Duschgel, Zahnbürste, Handtuch) |
| 5 | Medizin | Excel | Persönliche Medikamente **und** Reiseapotheke in einer Kategorie. Meist reiseunabhängig → häufig Tag `Allgemein` |
| 6 | Technik | Excel | Ladegeräte, Adapter, Powerbank, Kamera, Laptop |
| 7 | **Tauchausrüstung** | neu | Ausdrücklicher Wunsch. Nimmt Tauchanzug, Maske, Flossen, Booties, **Tauchcomputer, Lampe** auf |
| 8 | **Campingausrüstung** | neu | Zelt, Schlafsack, Isomatte, Kocher, Lampe. War als Tag vorhanden, aber ohne Kategorie |
| 9 | **Taschen & Ordnung** | neu | Rucksack, Kulturbeutel, Tagesrucksack, Packwürfel, **Zip-Beutel**. Die Behälter selbst sind Packgüter |
| 10 | Verpflegung | neu | Snacks, Trinkflasche, Tee, Kaffee. Relevant für Camping, Flug, Zug |
| 11 | Haushalt & Sonstiges | neu | Catch-all: Wäscheleine, Nähzeug, Schirm, Taschenmesser |

**11 Kategorien.** Alle Entscheidungen sind getroffen; die Liste ist gefroren.

#### B.2 Kontext-Tags

Gespeichert als flache Strings; gruppiert nur für die Darstellung im Formular.

| Gruppe | Tags | Quelle |
|---|---|---|
| **Basis** | Allgemein, Reiseapotheke | Excel + neu |
| **Klima / Saison** | Winter, Sommer, Übergangszeit, Regen | Excel + neu (Übergangszeit, Regen) |
| **Verkehrsmittel** | Flugzeug, Auto, Zug | neu |
| **Aktivität** | Tauchen, Festival, Wandern, Strand, Ski, Arbeit, Fotografie, UW-Fotografie | Excel + neu |
| **Unterkunft** | Camping, Ferienwohnung, Hotel, Hostel, Freunde | Excel + neu |
| **Person** | Damen, Herren — **nicht in `TAG_GRUPPEN`** | neu (§4.6) |

`Camping` liegt unter **Unterkunft**, nicht unter Aktivität — man übernachtet beim Camping, das ist die Variable, die die Ausrüstung bestimmt. `Zelt` als eigener Tag entfällt damit.

`Damen` und `Herren` stehen bewusst **nicht** in der Tabelle der Reise-Kontexte: sie gehören zu einer Person, nicht zu einer Reise. Sie stehen in `PERSON_TAGS` und tauchen in keinem Chip und keiner Vorschlagsliste des Reise-Formulars auf. Im Katalog wirken sie ausschließlich in `nicht_mit` — die Begründung steht in §5.1.

Eine **Anlass**-Gruppe entfällt ersatzlos.

**Begründungen zu den neu vorgeschlagenen Tags**

| Tag | Warum |
|---|---|
| **Reiseapotheke** | Hat die Kategorie `Medizin` von `Allgemein` gelöst. Die 47 Medizin-Items waren ein Drittel jeder Packliste (47 von 151 Positionen auf einer typischen Reise) — eine Reiseapotheke packt man aber nicht in dieser Breite ein. Der Tag steht unter **Basis**, weil er wie `Allgemein` die Grundausstattung beschreibt, nicht einen Anlass |
| **Übergangszeit** | Zwischen Winter und Sommer liegt der Großteil der Reisen. Ohne diesen Tag gibt es für milde Reisen keine saubere Auswahl — man landet bei Winter oder Sommer und packt falsch |
| **Regen** | Regenjacke, Schirm, wasserdichte Schuhe. Trifft jede Jahreszeit und ist unabhängig von der Saison |
| **Flugzeug / Auto / Zug** | Ausdrücklicher Wunsch. Ersetzt jedes Verkehrsmittel-Regelwerk durch Tags (§4.3) |
| **Wandern** | Sehr häufige Aktivität; eigene Ausrüstung (Stöcke, Blasenpflaster, Rucksack) |
| **Strand** | Handtuch, Strandtasche, Sonnenschutz, Schnorchel — überschneidet sich mit Sommer, aber nicht deckungsgleich |
| **Ski** | Wintersport braucht völlig eigenes Gerät; ohne diesen Tag ist `Winter` zu grob |
| **Arbeit** | Laptop, Businesskleidung, Adapter — eigene Anforderung |
| **Fotografie** | Kamera, Objektive, Speicherkarten, Stativ — Fotografie **an Land** |
| **UW-Fotografie** | Unterwasser-Fotografie. Eigener Tag, weil die Ausrüstung eine andere ist: Gehäuse, Arme, Blitz, Fiberkabel und Ladegerät der UW-Kamera kommen nur beim Tauchen mit, während Kamera und Speicherkarte auf beide Reisen gehen. Ein Item trägt daher `Fotografie`, `UW-Fotografie` oder beide |
| **Ferienwohnung** | Selbstversorgung: Küchenausstattung, Wäscheleine, Einkaufsbeutel. Ein Hotel braucht davon nichts |
| **Hotel** | Gegenstück zur Ferienwohnung: keine Küche, dafür Handtücher und Föhn vorhanden. Handtuch und Föhn werden deshalb einfach *nicht* mit `Hotel` getaggt — sie brauchen kein `nicht_mit` |
| **Hostel** | Wie Hotel, plus Schloss für Schließfach, Ohrstöpsel, Flip-Flops für Gemeinschaftsduschen |
| **Freunde** | Übernachtung bei Bekannten: Geschenk, kein Handtuch nötig, dafür weniger Gepäck |

**Bewusst nicht aufgenommen**: `Tropen`, `Winterurlaub`, `Business` — noch zu spekulativ. Tags lassen sich jederzeit frei eintippen (F3); wenn ein Tag nach drei Reisen immer noch fehlt, kommt er in diese Liste.

#### B.3 Bezug zum Import

Der Import nutzt die Spalten der Excel-Tabelle: die Kategorie-Spalten (`Kleidung`, `Technik`, `Kosmetik`, `Medizin`, `Schuhe`) befüllen `item.kategorie`, alle übrigen Spalten werden zu Tags.

Dabei entstehen zwei Lücken, die der Import-Report (F7) ausweisen muss:
- Items ohne X in einer Kategorie-Spalte → `Sonstiges`, manuell nachpflegen
- Items mit Tag `Tauchen` → Kategorie prüfen, da `Tauchausrüstung` erst nach dem Import entsteht

### C. Entschiedene und verworfene Alternativen

| Verworfen | Warum |
|---|---|
| LLM entscheidet über die Packliste | Nicht reproduzierbar, langsam, teuer, API-Abhängigkeit — ohne Mehrwert bei festem Katalog mit sauberen Tags |
| Flache Tag-Liste wie im Excel | Kann nur filtern, nicht auswählen. Wäre der Status quo mit neuer Oberfläche |
| Datenbank im MVP | Für Einzelnutzer mit lokaler Datei kein Nutzen, nur Betriebsaufwand |
| Mengen als Ja/Nein | Lässt den realen Fehlerfall "zu wenig für 10 Tage" bestehen |
| Tags als feste Enum-Liste | Hätte genau das Feature verhindert, das der Nutzer ausdrücklich will: unbekannte Aktivitäten eintippen |
| Getrenntes Frontend/Backend | Kein Mehrbenutzerbetrieb, kein geteilter Zustand, keine Geheimnisse, die nur serverseitig liegen dürften. Ein zweiter Prozess wäre reiner Zusatzaufwand |
| Python-Backend (FastAPI/Flask) | Rechnet nichts, was der Browser nicht rechnet. Python bleibt allein beim einmaligen Import-Skript (§3.6) |
| Heroku | Seit Nov 2022 kein Free Tier, und es will einen laufenden Server, den diese App nicht braucht. Statisches Hosting ist das passende Werkzeug |
| Lokaler Server auf dem Laptop | Hätte echte Dateien mit dem Handy verbunden, aber nur solange der Laptop läuft und im selben WLAN ist — genau der Fall, den das Packen unterwegs ausschließt |
| `localStorage` für den Katalog | Nicht versionierbar, kein `git diff`, kein Undo, und auf iOS räumungsgefährdet. Der Schatz gehört in eine Datei (§4.5) |
| UI-Framework (React/Svelte/Vue) | Fünf Ansichten, deren Kern eine reine Funktion ist. Vanilla JS reicht und spart eine Abhängigkeit |
| Katalog-Editor im MVP | Bulk-Arbeit an 333 Items gehört in ein Skript. Der Editor lohnt sich erst, wenn der Katalog steht (FF-16) |
| Katalog im Deployment (Weg 1) | Hätte das Handy automatisch aktuell gehalten, aber `katalog.json` wäre über die Deploy-URL für jeden abrufbar — und ein Zugriffsschutz hätte auf iOS einen Login-Schritt gekostet. Der Import per Button ist der billigere Preis (O11) |
| **Secret Gist als Datenspeicher** | „Secret" heißt bei GitHub nur *nicht gelistet* — jeder mit der URL liest mit; ein privater Gist existiert nicht. Dazu deckt ein Gist-Token **alle** Gists ab, ein fein granuliertes Repo-Token genau eines. Ein Link, der einmal in einem Repo, Bundle oder Verlauf steht, ist nicht mehr zurückzuholen (O12) |
| **Proxy für die GitHub-API** | Für nötig gehalten, dann gemessen: `api.github.com` erlaubt CORS inklusive Preflight für authentifizierte `PUT` (`allow-origin: *`). Ein Proxy hätte einen Server hinzugefügt, den diese App sonst nirgends braucht |
| **Katalog-Push aus der App** | Die App hat keinen Grund, den Katalog zu schreiben — bearbeitet wird er am Mac. Ohne Katalog-Push schrumpft die Schreibfläche des Tokens auf `reisen.json`, und das ist der Teil, der schiefgehen kann |
| **Merge-Regel pro Reise** | Nicht nötig, solange Reisen an einem Gerät entstehen. Zusammengeführt wird über die `id`, und ob drüben etwas anderes liegt, sagt die `sha` — dafür braucht es keinen Zeitstempel im Datenmodell |
| Automatische Synchronisierung / Merge | Braucht einen Server *oder* eine Merge-Regel. Beides unnötig, solange Reisen nur am Handy entstehen (Stufe A) |
| **Reisen in beide Richtungen ohne Nachfrage** | Seit 1.7 gehen Reisen sehr wohl in beide Richtungen — aber als ausdrücklicher Knopf, nicht im Hintergrund. Wer hochschiebt, entscheidet; und wenn drüben eine Reise liegt, die es hier nicht gibt, wird vorher gefragt. Das ist das Stück Stufe B, das ohne Merge-Regel zu haben ist |
| Verzeichnis `public/` für den Katalog | Vite kopiert `public/` unverändert in den Build — der Katalog wäre damit ungewollt deployt. Er liegt deshalb ganz außerhalb des App-Repos (§3.6) |
| Git-Repo in iCloud Drive | iCloud und git vertragen sich nicht; Sync-Konflikte beschädigen `.git`. iCloud ist der Transport, nicht das Repository |

---

## 16. Änderungshistorie

| Version | Datum | Änderung |
|---|---|---|
| 1.10 | 2026-10-09 | **Tag `Städtetrip` entfällt.** Er trug genau ein Item (`Schirm`) und diente dort allein dem Ausschluss-Fall aus §5.3 — ohne ihn ist die Liste der Reise-Kontexte ehrlicher, und §5.3 zeigt sein Beispiel jetzt am Geschlecht (`Binden`), dem einzigen Ausschluss, den der Katalog heute wirklich braucht. `Devil Sticks` und `Poi` hängen nur noch an `Festival` statt an `Camping`/`Festival`: es sind Jongliergeräte, keine Zeltausrüstung. Nachtrag zu 1.9: die Geschlechts-Markierung im Katalog ist inzwischen erfolgt — 16 Items tragen `Damen` bzw. `Herren` in `nicht_mit`, die Notiz in 1.9 („steht noch aus") ist damit erledigt |
| 1.9 | 2026-10-08 | **Personen — das Fundament für zwei Menschen auf einer Reise.** Neues globales Register `daten.personen` (`{id, name, geschlecht}`) und `reise.teilnehmer` (`{person_id, aktivitaeten}`); eine Reise mit zwei Teilnehmern ergibt **zwei** Packlisten, jede mit eigenem Fortschritt. Datenstand `version: 2`, neuer §4.6, neuer Tag-Ort `PERSON_TAGS` in Anhang B.2, O14–O16. **Der Schlüssel einer Packliste ist jetzt das Paar `(reise_id, person_id)`** — über `reise_id` allein überschriebe die zweite Person still die Liste der ersten. Alle vier Nähte, über die ein Reise-Datensatz hereinkommt (`localStorage`, Import-Datei, Sync, Ersetzen beim Import), gehen jetzt durch `normalisiereDaten`; drei davon zählten die Felder vorher selbst auf und hätten `personen` verloren. Alte Stände bleiben ohne Migration lesbar, alten Listen wird kein `person_id` angedichtet. **Geschlecht als Tag, aber in `nicht_mit`:** als positives Tag ließe sich „nur für ihn" nicht mit „nur im Sommer" kombinieren — `Badehose` wäre auf der Winterreise oder bei allen dabei (§5.1). Die Liste einer Person liegt unter `#/liste/:reiseId/:personId`, die alte Adresse bleibt gültig. Das Löschen einer Person entfernt keine Listen. FF-05/FF-06 bleiben offen und sind jetzt als solche benannt. Katalogseitig steht die Geschlechts-Markierung noch aus — bis dahin greift kein Ausschluss, und beide Geschlechter-Items kommen mit |
| 1.8 | 2026-10-08 | **Auslieferung von Vercel auf GitHub Pages umgestellt.** Vercel lieferte unter der Projekt-Domain eine fremde Next.js-App aus, während die eigenen Deployments seit Stunden als „blocked" scheiterten — der Wirt war nicht mehr nachvollziehbar. Pages liegt im selben Repo wie der Code, das Deployment steht als Datei darin statt in einem Dashboard. Zwei Eigenheiten, die dabei zu beachten sind: Projekt-Seiten liegen unter `/packliste/`, deshalb setzt `vite.config.js` ein `base` — **nur beim Bauen**, damit Entwicklungsserver, Rauchtest und die absoluten Fixture-Pfade unverändert bleiben. Und weil die App über `location.hash` routet, braucht es keine `404.html`-Krücke für Deep-Links. Kopfzeile dieses Dokuments von 1.2 auf den Stand der Historie gezogen |
| 1.7 | 2026-10-08 | **Zwei Repos statt einem.** Das App-Repo wird öffentlich und enthält nur noch die Hülle; Katalog und `import/` ziehen in ein **privates** Daten-Repo, weil der Katalog Gesundheitsdaten enthält (Medikamentennamen) und `mapping.json` echte Item-Namen — ein einmal veröffentlichter Stand ist nicht zurückzuholen. Datentransfer um **US-11** ergänzt: Abgleich über die GitHub-Contents-API auf Knopfdruck, fein granuliertes PAT nur im `localStorage`. Der Katalog geht nur noch **eine** Richtung (App liest, schreibt nie); Reisen gehen hoch und werden ausdrücklich geholt. Konflikte erkennt die `sha` der Contents-API — **keine** Merge-Regel, kein Zeitstempel im Datenmodell (O12, O13). `localStorage` ist jetzt ausdrücklich Arbeitskopie statt Master; der Sync blockiert nie. Neuer §4.5, FR20–FR24, F15, §9 um Geheimnis und Offline erweitert, §11 um Token, Konflikt und Veröffentlichung. O11 von „Schutz erübrigt sich" auf „privates Repo" korrigiert. Der Secret-Gist-Weg und ein API-Proxy sind als verworfen dokumentiert. Tests: erfundener Fixture-Katalog im öffentlichen Repo, der echte Katalog wird zusätzlich getestet, wenn er lokal liegt |
| 1.6 | 2026-10-08 | Tags aufgeräumt. Neuer Tag **`UW-Fotografie`** in Anhang B.2 (Gruppe **Aktivität**): Unterwasser-Foto-Gerät (Gehäuse, Box, Auftriebskörper, Glasfaserkabel, Kleinteile, UW-Kamera, Ladegerät) hing an `Tauchen`, während Kamera und Zubehör an `Fotografie` hingen — auf einer Tauchreise kam so das Gehäuse ohne Kamera mit. Jetzt trägt das reine UW-Gerät nur `UW-Fotografie`; Kamera, SD Karte, Festplatte, Blitz, Arme, Diffusor, Fisheye, Schellen, GoPro und das Ladegerät der Kamera tragen beides und kommen auf Land- wie UW-Fotoreisen. `Flugzeug` war mit einem einzigen Item leer: `Nackenkissen` und ein Beutel (**Allgemein** weg, sie kommen nur auf Flugreisen mit), `Wollsocken` und `Sonnencreme` tragen es zusätzlich (PRD §4.3, §5.2). `Handtuch` verliert `Allgemein` (schickte es auch ins Hotel, das laut B.2 keins braucht) und hängt jetzt an `Strand`/`Camping`/`Ferienwohnung`/`Hostel`. `Ohrstöpsel` von `Allgemein` auf `Hostel`/`Camping`. Wirkungslose Doppel-Tags entfernt, wo `Allgemein` schon alles abdeckt (`Hausschuhe`, `Taschentücher`, `Wasserbehälter`). `Poncho` zusätzlich an `Strand`. Die fünf Kleidungsstücke mit `Tauchen` bleiben als Trocki-Unterzeug — PRD §6.2 verlangt hier bewusst Handarbeit, kein Automatismus |
| 1.5 | 2026-10-08 | Neuer Tag `Reiseapotheke` in Anhang B.2 (Gruppe **Basis**). Die Kategorie `Medizin` hängt nicht mehr an `Allgemein`: ihre 47 Items trugen ein Drittel jeder Packliste bei und kommen jetzt nur noch mit, wenn der Tag gewählt wird. Die Actionkamera verliert `Sport` und hängt an `Fotografie`, das Sportoberteil an `Allgemein`. `mapping.json` und `erwartungen.json` bleiben bewusst auf ihrem Stand — sie beschreiben den Lauf des stillgelegten Imports, nicht mehr den Katalog, und können Löschungen und Umbenennungen ohnehin nicht abbilden. Sie sind ab jetzt historisch |
| 1.4 | 2026-10-08 | Katalog interaktiv überarbeitet. Tag `Sport` aus Anhang B.2 entfernt — er trug nur zwei Items (eine Actionkamera und ein Sportoberteil), und beide kamen über andere Tags ohnehin mit; die im PRD genannten Laufschuhe und Fitnesszeug wurden nie in den Katalog aufgenommen. `daten/katalog.json` wird ab jetzt **von Hand gepflegt**: der Excel-Import ist einmal gelaufen und danach totgelegt (`import.mjs --write` gesperrt, `npm run katalog` entfernt), weil `mapping.json` keine Umbenennungen, Löschungen oder Tag-Korrekturen kennt und die Pflegearbeit sonst überschreiben würde. Katalog 265 → 262 Items: `Jacke`, `Pulli`, `Schal`, `Schuhe`, `Strumpfkopf` gelöscht, fünf Items umbenannt, zwei dünne Kopfbedeckungen ergänzt |
| 1.3 | 2026-10-08 | Datentransfer entschieden (O11 → Weg 2, Stufe A). Der Katalog wird **nicht deployt**; das Deployment enthält nur die App-Hülle, damit braucht die öffentliche Deploy-URL keinen Zugriffsschutz. Katalog und Reisen liegen am Handy im `localStorage`; der Katalog kommt per Import-Button (US-09) aus iCloud Drive, Reisen gehen per Share-Sheet als Backup zurück (US-10). Keine automatische Synchronisierung, keine Merge-Regel — Reisen entstehen nur am Handy. Neuer Abschnitt zu den Datenrichtungen (§4.5), neue Anforderungen FR17–FR19, US-09/US-10 ergänzt. Die File System Access API wandert mit FF-16 aus dem MVP (am Mac wird der Katalog in dieser Zeit per Editor bearbeitet). Katalog-Verzeichnis `public/` → `daten/`, damit Vite ihn nicht in den Build kopiert. §9, §12, FF-12 und Anhang C angepasst |
| 1.2 | 2026-10-07 | Technische Architektur entschieden und als §3.6 aufgenommen: statisches Hosting, Vite + Vanilla JS, kein Backend. Persistenz umgestellt (§4.5): `katalog.json` bleibt versionierte Datei im Repo (Schreiben per File System Access API, Chrome/macOS), Reisen und Packlisten wandern in `localStorage`. Katalog-Editor aus dem MVP in die erste Überarbeitung verschoben (US-01, FR1, FR3 → FF-16); Katalogpflege im MVP über Repo und Import-Skript (§3.3). US-08/FR15 eingeschränkt, da der Retro-Direktweg den Editor voraussetzt. Zeitplan und NFR angepasst. O2 präzisiert, O11 (Zugriffsschutz für `katalog.json`) neu aufgenommen |
| 1.1 | 2026-10-07 | Verkehrsmittel von Regelwerk auf Tag umgestellt (F9). Persistenz auf zwei Dateien aufgeteilt (§4.5). `Camping` von Aktivität zu Unterkunft verschoben, `Anlass`-Gruppe entfernt. Kategorie `Tauchausrüstung` ergänzt, `Medikamente`/`Reiseapotheke` zu `Medizin` zusammengeführt. Katalog auf 11 Kategorien und 5 Tag-Gruppen gefroren (Anhang B). `nicht_mit` präzisiert: positive Tags decken mehr ab als zunächst angenommen (§5.3). O1–O7, O9, O10 entschieden |
| 1.0 | 2026-10-07 | Erster Entwurf |
