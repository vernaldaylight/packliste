# Packliste — Product Requirements Document

**Version**: 1.1
**Datum**: 2026-10-07
**Autor**: Sarah
**Status**: Abgestimmt — bereit für die Umsetzung
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
- Solo-Projekt, Web-Frontend, kein Backend, keine Datenbank
- Persistenz: zwei lokale JSON-Dateien (`katalog.json`, `reisen.json`)
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

### 3.4 Out of Scope (MVP)

- **Mehrbenutzer** — getrennte Kataloge pro Person, geteilte Reisen. Architektur soll es nicht verbauen (Item-Katalog als eigene Entität), aber es wird nicht gebaut.
- **LLM-gestützte Auswahl oder Vorschläge**
- **Vorschlagen von Items, die man noch nicht im Katalog hat** ("besitzt du eine Tauchmaske?")
- **Tag-Verwaltung** (umbenennen, zusammenführen, löschen über viele Items)
- **Wetter-API, Gewichts-/Gepäcklimits, Packen nach Tasche, Sharing, PWA/Offline**
- **Benutzerkonten, Server, Datenbank, Deployment**

### 3.5 MVP-Definition

**Kernumfang**: alle P0-Features — F1–F9.
**Fertig, wenn**: Eine echte vergangene Reise im Formular eingegeben wird und die generierte Liste ohne manuelles Hinzufügen fehlender Kern-Items zum Packen taugt.
**Lernziele**: Trägt das Zwei-Achsen-Modell wirklich? Sind die Mengenregeln ausdrucksstark genug? Wie viel Nacharbeit bleibt realistisch?

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
}
```

**Verkehrsmittel und Unterkunft sind keine Sonderfälle, sondern Tag-Quellen.** Es gibt kein Regelwerk und keine Warnungen: `Flugzeug` ist ein Tag wie jeder andere, und Items wie Nackenkissen, Wollsocken oder der 1-L-Zip-Beutel tragen ihn. Wer mit dem Auto fährt, bekommt diese Items einfach nicht — und dafür alle Items mit Tag `Auto`. Dasselbe gilt für die Unterkunft: Wer im Hotel schläft, braucht kein Handtuch und keinen Föhn.

Die **abgeleiteten Reise-Tags** sind die Vereinigung aus:
`{saison} ∪ aktivitaeten ∪ {verkehrsmittel} ∪ {unterkunft} ∪ zusatz_tags ∪ {"Allgemein"}`

### 4.4 Packliste (Ergebnis)

Die Packliste ist eine **Momentaufnahme**, kein Live-View. Beim Erzeugen wird sie materialisiert, damit manuelles Nachjustieren (F6) und Abhaken (F5) nicht bei jedem Render verloren gehen.

```
Packliste {
  reise_id: string
  erzeugt_am: datetime
  positionen: [
    { item_id, menge, gepackt: boolean, manuell_hinzugefuegt: boolean }
  ]
}
```

### 4.5 Persistenz

Kein Server, keine DB, keine Konten. **Zwei lokale JSON-Dateien** statt einer:

| Datei | Inhalt | Charakter |
|---|---|---|
| `katalog.json` | `items` | **Der Schatz.** Stunden Handarbeit, nicht regenerierbar |
| `reisen.json` | `reisen`, `packlisten` | Wegwerfbar, jederzeit neu erzeugbar |

```json
// katalog.json
{ "version": 1, "items": [ ... ] }

// reisen.json
{ "version": 1, "reisen": [ ... ], "packlisten": [ ... ] }
```

**Warum getrennt und nicht eine Datei**: Der Katalog ist der einzige Teil, dessen Verlust echte Arbeit kostet. Reisen und Packlisten sind Ableitungen. Getrennt gespeichert kann ein schiefgelaufener Schreibvorgang auf einer Packliste den Katalog nicht beschädigen.

Zwei Nebeneffekte, die den Aufwand sofort rechtfertigen:
- `katalog.json` kommt **unter Versionskontrolle** (git). Die Historie ist lesbar (Zeilen-Diffs pro Item), Backups kosten nichts, und ein Fehlgriff lässt sich mit `git checkout` zurücknehmen.
- Getrennte Kataloge pro Person (FF-04) brauchen später nur eine weitere `katalog-<person>.json` — die Reise-Datei bleibt unberührt.

Jede Datei trägt `version` für spätere Migrationen. Vor jedem Schreiben wird die Vorgängerversion als Backup gesichert.

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

`"Allgemein"` ist implizit in jeder Reise enthalten — das ist das Fundament, auf dem alles andere aufsetzt (Zahnbürste, Ladegerät, Reisepass).

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
Item "Badehose" { tags: ["Sommer", "Strand"], nicht_mit: ["Städtetrip"] }
```

**Wann das gebraucht wird**: Positive Tags reichen weiter, als es zunächst scheint. Ein Handtuch, das nur `Camping` und `Ferienwohnung` trägt, landet bei einer Hotelreise ohnehin nicht auf der Liste — es braucht kein `nicht_mit: ["Hotel"]`. Der Ausschluss wird erst gebraucht, wenn ein Item **notwendigerweise** einen breiten Tag trägt, in einer bestimmten Situation aber trotzdem nicht mitkommt. Die Badehose oben ist genau dieser Fall: `Sommer` muss sie tragen, damit sie im Sommerurlaub dabei ist — aber auf einem Städtetrip im Sommer ist sie Ballast.

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

### US-01 — Katalog pflegen
> Als Nutzerin möchte ich Items mit Kategorie, Tags und Mengenregel anlegen und bearbeiten, damit mein Bestand die Wahrheit über meine Dinge ist.

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

### US-08 — Retrospektive
> Als Nutzerin möchte ich nach der Reise festhalten, was gefehlt hat, damit die Liste beim nächsten Mal besser ist.

**Akzeptanzkriterien**
- [ ] Freitextfeld "Was hat gefehlt?" an einer Reise
- [ ] Aus einem Eintrag direkt ein Item anlegen, vorbelegt mit den Tags dieser Reise
- [ ] Vermerk, aus welcher Reise das Item stammt

---

## 8. Funktionale Anforderungen

| ID | Anforderung | Prio |
|---|---|---|
| FR1 | Items anlegen, lesen, bearbeiten, löschen | P0 |
| FR2 | Item hat genau eine Kategorie und beliebig viele Tags | P0 |
| FR3 | Drei Mengenregel-Varianten mit Vorschau | P0 |
| FR4 | Reise-Formular mit automatischer Tag-Ableitung | P0 |
| FR5 | Freitext-Tags im Formular anlegen | P0 |
| FR6 | Regel-Engine mit Tag-Schnittmenge und Ausschluss | P0 |
| FR7 | Mengenberechnung aus Reisedauer | P0 |
| FR8 | Gruppierte, abhakbare Ausgabe | P0 |
| FR9 | Reise-lokale Overrides am Katalog vorbei | P0 |
| FR10 | Excel/CSV-Import mit Report | P0 |
| FR11 | Datenhaltung in lokaler JSON-Datei | P0 |
| FR12 | Export als Markdown | P1 |
| FR13 | Verkehrsmittel fließt als Tag in `tripTags` ein | P0 |
| FR14 | Reise speichern, laden, duplizieren | P1 |
| FR15 | Retro-Eintrag, der ein Item erzeugt | P1 |
| FR16 | Item-Suche und Filter | P2 |

---

## 9. Nicht-funktionale Anforderungen

| Bereich | Anforderung |
|---|---|
| Sprache | UI komplett Deutsch, keine Internationalisierung |
| Plattform | Web-Frontend, moderner Browser; am Handy bedienbar |
| Betrieb | Läuft lokal, kein Server, kein Login |
| Datenschutz | Alle Daten bleiben lokal; keine Telemetrie, keine externen Aufrufe |
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
| Datenverlust des Katalogs | Niedrig | Hoch | Getrennte `katalog.json`, Backup vor jedem Schreiben, `katalog.json` unter git, Export als Notausgang |
| Scope Creep durch Future Features | Hoch | Mittel | Dieses Dokument; Future Features bleiben ausgeschlossen |
| Migrationsaufwand frustriert vor dem ersten Nutzen | Mittel | Hoch | Import ist P0 — Nutzen muss in Woche 2 erreichbar sein |
| Kategorien tragen nicht (11 sind zu viele oder zu wenige) | Mittel | Mittel | Kategorien sind reine Strings; Umbenennen und Zusammenführen ist ein Datensatz-Fix, kein Umbau. Erste Bewährung: der Import der echten Tabelle |

---

## 12. Zeitplan

Solo, Abendarbeit, parallel zum Kurs. Vier Wochen bis nutzbarer MVP.

| Woche | Meilenstein | Ergebnis | Fertig, wenn |
|---|---|---|---|
| 1 | Datenmodell + Katalog | JSON-Schema, Item-CRUD, Persistenz | Items lassen sich anlegen und überleben einen Neustart |
| 2 | Import + Reise-Formular | Excel-Import, Reise anlegen | Echter Bestand ist drin, Reise ist beschreibbar |
| 3 | Engine + Ausgabe | Auswahllogik, Mengen, gruppierte Liste | Eine echte Reise erzeugt eine brauchbare Liste |
| 4 | Feinschliff | Abhaken, Export, Retro, Overrides | Erste echte Reise wird damit gepackt |

**Erster echter Einsatz**: Ende Woche 4. Das ist der Zeitpunkt, an dem sich zeigt, ob das Modell trägt.

---

## 13. Offene Fragen

| # | Frage | Entscheidung |
|---|---|---|
| O1 | Eine JSON-Datei oder eine pro Entität? | ✅ **Zwei**: `katalog.json` (wertvoll) und `reisen.json` (regenerierbar). Siehe §4.5 |
| O2 | Wie wird eine Mengenregel editiert? | ✅ **Gelöst.** Drei Radiobuttons, genau einer aktiv; bei `fest` und `pro_tage` werden die Zahlenfelder eingeblendet — **Rohfelder, kein Assistent.** Dazu Live-Vorschau „= 4 Stück für 10 Tage" |
| O3 | Kann ein Item mehrere Kategorien haben? | ✅ **Nein, genau eine.** Diving-Gear bekommt die eigene Kategorie `Tauchausrüstung` |
| O4 | Ausschluss-Tags schon im MVP? | ✅ **Feld jetzt, UI später** — wie in §5.3 |
| O5 | Packliste als Snapshot oder live berechnet? | ✅ **Snapshot.** Sonst gehen Overrides (F6) und Häkchen (F5) bei jedem Render verloren |
| O6 | Verbrauchsmaterial pro Tag rechnen? | ✅ **Nein.** `fest` genügt — siehe §4.2 |
| O7 | Verkehrsmittel: Sperre, Warnung oder Tag? | ✅ **Tag.** Kein Regelwerk, keine Warnungen — siehe §4.3 |
| O8 | Kategorien im Import aus Spalten oder Mapping-Tabelle? | Offen — technische Detailfrage, wird beim Import-Spike entschieden. Blockiert nichts |
| O9 | Grundreihenfolge der Kategorien in der Ausgabe? | ✅ **Die Reihenfolge aus Anhang B.1**: Dokumente & Wertsachen zuerst, Sonstiges zuletzt |
| O10 | Tags in der UI gruppiert darstellen? | ✅ **Ja, gruppiert** (Klima, Verkehr, Aktivität, Unterkunft). Gespeichert wird flach — die Gruppierung ist reine Darstellung und ändert das Datenmodell nicht |

**Nur noch eine Frage ist wirklich offen** (O8), und sie ist technisch statt fachlich. Das fachliche Fundament steht.

---

## 14. Future Features (bewusst nicht im MVP)

Nach Wert für das Kernproblem geordnet — nicht nach Umsetzungsaufwand.

### Stufe 1 — macht das Werkzeug mit der Zeit besser

**FF-01 · Retrospektive als Lernschleife** *(teilweise in MVP als US-08)*
Nach jeder Reise erfassen, was gefehlt hat, und daraus Katalog-Einträge erzeugen. Das ist das einzige Feature, das die Kernbeschwerde "ich vergesse Dinge" dauerhaft adressiert statt nur einmalig. Ausbaustufe: Muster erkennen — "bei Tauchen fehlt dir dreimal etwas aus Medizin" → Vorschlag, ein Tag zu ergänzen.

**FF-02 · Item-Vorschläge mit Besitz-Abfrage**
Die App kennt typische Items pro Aktivität (aus einem mitgelieferten Katalog oder per LLM). Wenn eine Reise den Tag `Tauchen` hat und kein Tauch-Item im Katalog liegt: "Besitzt du eine Tauchmaske?" → bei Ja wird ein Item mit `im_besitz: true` angelegt. Genau hier zahlt sich das bereits vorgesehene Feld `im_besitz` aus.

**FF-03 · LLM-gestützte Verfeinerung**
Das Regel-Ergebnis geht an ein LLM mit der Frage: "Fehlt hier etwas für diese Reise?" Die Regeln bleiben die Quelle der Wahrheit — das LLM ergänzt nur Vorschläge. Damit bleibt das System reproduzierbar, und der LLM-Einsatz ist ein Add-on statt einer Abhängigkeit.

### Stufe 2 — Mehrbenutzer

**FF-04 · Getrennte Kataloge pro Person**
Jede Person hat ihren eigenen Bestand. Voraussetzung dafür, dass Partner und Freunde mitmachen.

**FF-05 · Geteilte Reisen mit Zuständigkeiten**
Eine Reise, mehrere Personen, pro Item eine Zuordnung "wer bringt das mit". Löst das Doppelt-Packen von Dingen, die nur einmal gebraucht werden (Föhn, Reiseapotheke, Tauchlampe).

**FF-06 · Gemeinsame Verbrauchsgüter**
Sonnencreme, Shampoo: eine Person bringt, alle nutzen. Verbindet sich mit FF-05.

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
Liste ohne Netz am Handy, echte Checkbox-Interaktion unterwegs. Wird wichtig, sobald das Tool produktiv genutzt wird — beim Tauchen gibt es selten WLAN.

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
| **Basis** | Allgemein | Excel |
| **Klima / Saison** | Winter, Sommer, Übergangszeit, Regen | Excel + neu (Übergangszeit, Regen) |
| **Verkehrsmittel** | Flugzeug, Auto, Zug | neu |
| **Aktivität** | Tauchen, Festival, Wandern, Strand, Ski, Städtetrip, Arbeit, Fotografie, Sport | Excel + neu |
| **Unterkunft** | Camping, Ferienwohnung, Hotel, Hostel, Freunde | Excel + neu |

`Camping` liegt unter **Unterkunft**, nicht unter Aktivität — man übernachtet beim Camping, das ist die Variable, die die Ausrüstung bestimmt. `Zelt` als eigener Tag entfällt damit.

Eine **Anlass**-Gruppe entfällt ersatzlos.

**Begründungen zu den neu vorgeschlagenen Tags**

| Tag | Warum |
|---|---|
| **Übergangszeit** | Zwischen Winter und Sommer liegt der Großteil der Reisen. Ohne diesen Tag gibt es für milde Reisen keine saubere Auswahl — man landet bei Winter oder Sommer und packt falsch |
| **Regen** | Regenjacke, Schirm, wasserdichte Schuhe. Trifft jede Jahreszeit und ist unabhängig von der Saison |
| **Flugzeug / Auto / Zug** | Ausdrücklicher Wunsch. Ersetzt jedes Verkehrsmittel-Regelwerk durch Tags (§4.3) |
| **Wandern** | Sehr häufige Aktivität; eigene Ausrüstung (Stöcke, Blasenpflaster, Rucksack) |
| **Strand** | Handtuch, Strandtasche, Sonnenschutz, Schnorchel — überschneidet sich mit Sommer, aber nicht deckungsgleich |
| **Ski** | Wintersport braucht völlig eigenes Gerät; ohne diesen Tag ist `Winter` zu grob |
| **Städtetrip** | Anderes Packverhalten als Strand oder Wandern: bequeme Schuhe, Tagesrucksack, wenig Gepäck |
| **Arbeit** | Laptop, Businesskleidung, Adapter — eigene Anforderung |
| **Fotografie** | Kamera, Objektive, Speicherkarten, Stativ |
| **Sport** | Laufschuhe, Fitnesszeug für Hotel/Urlaub |
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

---

## 16. Änderungshistorie

| Version | Datum | Änderung |
|---|---|---|
| 1.1 | 2026-10-07 | Verkehrsmittel von Regelwerk auf Tag umgestellt (F9). Persistenz auf zwei Dateien aufgeteilt (§4.5). `Camping` von Aktivität zu Unterkunft verschoben, `Anlass`-Gruppe entfernt. Kategorie `Tauchausrüstung` ergänzt, `Medikamente`/`Reiseapotheke` zu `Medizin` zusammengeführt. Katalog auf 11 Kategorien und 5 Tag-Gruppen gefroren (Anhang B). `nicht_mit` präzisiert: positive Tags decken mehr ab als zunächst angenommen (§5.3). O1–O7, O9, O10 entschieden |
| 1.0 | 2026-10-07 | Erster Entwurf |
