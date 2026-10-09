/**
 * Tests der Persistenz und des Datentransfers (PRD §4.5, US-09, US-10).
 *
 * Der wichtigste Fall steht in US-09: "Bei ungültiger Datei: verständliche
 * Meldung, bestehender Katalog bleibt unangetastet". Genau das prüfen die
 * Tests unten — eine kaputte Datei darf niemals etwas überschreiben.
 *
 * `localStorage` gibt es in Node nicht; die Attrappe unten ist absichtlich
 * klein und wirft im selben Moment wie das Original, wenn der Speicher voll ist.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/* --- localStorage-Attrappe, muss vor dem Import von store.js stehen ------- */

function baueSpeicher({ voll = false } = {}) {
  const karte = new Map();
  return {
    getItem: (k) => (karte.has(k) ? karte.get(k) : null),
    setItem: (k, v) => {
      if (voll) throw new DOMException('QuotaExceededError');
      karte.set(k, String(v));
    },
    removeItem: (k) => karte.delete(k),
    clear: () => karte.clear(),
    _karte: karte,
  };
}

globalThis.localStorage = baueSpeicher();
globalThis.DOMException ??= class extends Error {};

const {
  validiereKatalog,
  validiereDaten,
  katalogStatistik,
  ladeKatalog,
  speichereKatalog,
  entferneKatalog,
  katalogBackupVorhanden,
  ladeDaten,
  speichereDaten,
  leereDaten,
  fuegeReisenZusammen,
  neueId,
  listenSchluessel,
  findePackliste,
  SCHLUESSEL,
} = await import('../src/store.js');

const { erzeugePackliste, gruppiere, alsMarkdown, neuePosition, fortschritt, tripTags, reisetage } = await import(
  '../src/engine.js'
);

const HIER = dirname(fileURLToPath(import.meta.url));

/**
 * Prüfgegenstand ist der Fixture-Katalog: erfundene Items, aber alle elf
 * Kategorien und alle drei Mengenregeln. Die Struktur-Tests brauchen einen
 * gültigen Katalog, nicht die echten Item-Namen — der echte liegt seit dem
 * Umzug in einem privaten Repo (PRD §4.5) und ist hier nicht mehr vorhanden.
 */
const katalogRoh = JSON.parse(readFileSync(resolve(HIER, 'fixtures/katalog.synthetisch.json'), 'utf8'));

/** Die private Arbeitskopie am Mac, falls vorhanden — sonst `null`. */
function ladeEchtenKatalog() {
  const kandidaten = [
    resolve(HIER, '../daten/katalog.json'),
    resolve(HIER, '../../packliste-daten/katalog.json'),
  ];
  for (const pfad of kandidaten) {
    try {
      return JSON.parse(readFileSync(pfad, 'utf8'));
    } catch {
      /* nächster Kandidat */
    }
  }
  return null;
}

const echterKatalog = ladeEchtenKatalog();
const nurMitEchtemKatalog = echterKatalog ? false : 'keine private Arbeitskopie gefunden (Daten-Repo packliste-daten, PRD §4.5)';

beforeEach(() => {
  globalThis.localStorage = baueSpeicher();
});

/* --- Katalog prüfen (US-09) ------------------------------------------------ */

test('der Fixture-Katalog wird angenommen', () => {
  const p = validiereKatalog(katalogRoh);
  assert.ok(p.ok, `abgelehnt: ${p.fehler.join(' | ')}`);
  assert.equal(p.katalog.items.length, katalogRoh.items.length);
  assert.equal(p.statistik.items, katalogRoh.items.length);
});

test('Nicht-JSON-Objekte werden abgelehnt, ohne zu werfen', () => {
  for (const mist of [null, [], 'text', 42, undefined]) {
    const p = validiereKatalog(mist);
    assert.equal(p.ok, false);
    assert.ok(p.fehler.length > 0);
    assert.equal(p.katalog, null);
  }
});

test('fehlende Pflichtfelder werden benannt', () => {
  const p = validiereKatalog({
    version: 1,
    items: [
      { id: 'a', name: 'Gut', kategorie: 'Kleidung', tags: [], menge: { art: 'einmal' } },
      { id: 'b', kategorie: 'Kleidung', tags: [], menge: { art: 'einmal' } }, // name fehlt
      { id: 'c', name: 'Ohne Kategorie', tags: [], menge: { art: 'einmal' } },
      { id: 'd', name: 'Ohne Tags', kategorie: 'Kleidung', menge: { art: 'einmal' } },
      { id: 'e', name: 'Ohne Menge', kategorie: 'Kleidung', tags: [] },
    ],
  });
  assert.equal(p.ok, false);
  assert.equal(p.katalog, null);
  const alles = p.fehler.join(' ');
  assert.match(alles, /name fehlt/);
  assert.match(alles, /kategorie fehlt/);
  assert.match(alles, /tags fehlen/);
  assert.match(alles, /menge fehlt/);
});

test('doppelte ids und unbekannte Mengenregeln werden abgelehnt', () => {
  const p = validiereKatalog({
    version: 1,
    items: [
      { id: 'gleich', name: 'A', kategorie: 'Kleidung', tags: [], menge: { art: 'einmal' } },
      { id: 'gleich', name: 'B', kategorie: 'Kleidung', tags: [], menge: { art: 'einmal' } },
      { id: 'x', name: 'C', kategorie: 'Kleidung', tags: [], menge: { art: 'manchmal' } },
    ],
  });
  assert.equal(p.ok, false);
  assert.match(p.fehler.join(' '), /doppelte id/);
  assert.match(p.fehler.join(' '), /unbekannte Mengenregel/);
});

test('fehlende version und leere Item-Liste werden abgelehnt', () => {
  assert.equal(validiereKatalog({ items: [] }).ok, false);
  assert.equal(validiereKatalog({ version: 1, items: [] }).ok, false);
});

/* --- Katalog speichern, inklusive Backup (PRD §9) -------------------------- */

test('ein geprüfter Katalog überlebt Speichern und Laden', () => {
  const p = validiereKatalog(katalogRoh);
  assert.ok(speichereKatalog(p.katalog));

  const geladen = ladeKatalog();
  assert.equal(geladen.items.length, p.katalog.items.length);
  assert.equal(geladen.items[0].name, p.katalog.items[0].name);
});

test('ein zweiter Import legt die Vorgängerversion ins Backup', () => {
  const erster = validiereKatalog(katalogRoh).katalog;
  speichereKatalog(erster);
  assert.ok(!katalogBackupVorhanden(), 'vor dem zweiten Schreiben gibt es noch nichts zu sichern');

  const kleiner = { version: 1, items: [erster.items[0]] };
  speichereKatalog(kleiner);
  assert.ok(katalogBackupVorhanden(), 'die erste Fassung muss jetzt im Backup liegen');

  assert.equal(ladeKatalog().items.length, 1);
  assert.equal(JSON.parse(localStorage.getItem(SCHLUESSEL.backupKatalog)).items.length, erster.items.length);
});

test('ein unbrauchbarer gespeicherter Katalog führt zur Import-Aufforderung, nicht zum Absturz', () => {
  localStorage.setItem(SCHLUESSEL.katalog, '{kaputt');
  assert.equal(ladeKatalog(), null);

  localStorage.setItem(SCHLUESSEL.katalog, JSON.stringify({ version: 1, items: [{ id: 'x' }] }));
  assert.equal(ladeKatalog(), null, 'unvollständige Items dürfen nicht durchrutschen');
});

test('Katalog entfernen lässt das Backup stehen', () => {
  speichereKatalog(validiereKatalog(katalogRoh).katalog);
  speichereKatalog({ version: 1, items: [validiereKatalog(katalogRoh).katalog.items[0]] });
  entferneKatalog();
  assert.equal(ladeKatalog(), null);
  assert.ok(katalogBackupVorhanden());
});

/* --- Kennzahlen (PRD §10) -------------------------------------------------- */

test('katalogStatistik zählt Kategorien, Tags und Regeln', () => {
  const s = katalogStatistik(validiereKatalog(katalogRoh).katalog);
  assert.equal(s.items, katalogRoh.items.length);

  // Gegen die Erwartung aus dem Fixture gerechnet, nicht gegen eine feste Zahl —
  // geprüft wird, DASS gezählt wird. Die PRD-Konformität des echten Katalogs
  // prüft der Test weiter unten.
  const erwarteteKategorien = new Set(katalogRoh.items.map((i) => i.kategorie)).size;
  const erwarteteTags = new Set(katalogRoh.items.flatMap((i) => i.tags)).size;
  assert.equal(s.kategorien, erwarteteKategorien);
  assert.equal(s.tags, erwarteteTags);
  assert.equal(erwarteteKategorien, 11, 'der Fixture deckt PRD Anhang B.1 vollständig ab');

  assert.equal(
    s.regeln.einmal + s.regeln.fest + s.regeln.pro_tage,
    s.items,
    'jedes Item hat genau eine Mengenregel'
  );
  assert.ok(s.gepflegt > 0, 'der Fixture enthält gepflegte Mengenregeln');
});

/* --- Der echte Katalog, falls die private Arbeitskopie vorliegt ------------- */

test('echter Katalog: elf Kategorien und ein gepflegtes Tag-Vokabular (PRD Anhang B.1)', { skip: nurMitEchtemKatalog }, () => {
  const s = katalogStatistik(validiereKatalog(echterKatalog).katalog);
  assert.equal(s.kategorien, 11, 'PRD Anhang B.1 friert elf Kategorien ein');
  assert.ok(s.tags > 10, `nur ${s.tags} Tags — Tag-Vokabular geschrumpft?`);
  assert.ok(s.items > 200, `nur ${s.items} Items`);
});

/* --- Reisen und Packlisten ------------------------------------------------- */

test('leerer Zustand: ohne gespeicherte Daten kommt eine leere Struktur', () => {
  const d = ladeDaten();
  assert.deepEqual(d, { version: 2, personen: [], reisen: [], packlisten: [] });
});

test('Reisen überleben Speichern und Laden', () => {
  const daten = leereDaten();
  daten.reisen.push({ id: 'r1', name: 'Testreise', von: '2026-08-01', bis: '2026-08-10' });
  daten.packlisten.push({ reise_id: 'r1', erzeugt_am: new Date().toISOString(), positionen: [] });
  speichereDaten(daten);

  const wieder = ladeDaten();
  assert.equal(wieder.reisen.length, 1);
  assert.equal(wieder.reisen[0].name, 'Testreise');
  assert.equal(wieder.packlisten.length, 1);
});

test('vor jedem Schreiben liegt die Vorgängerversion im Backup', () => {
  const daten = leereDaten();
  daten.reisen.push({ id: 'r1', name: 'Erste' });
  speichereDaten(daten);

  daten.reisen.push({ id: 'r2', name: 'Zweite' });
  speichereDaten(daten);

  const backup = JSON.parse(localStorage.getItem(SCHLUESSEL.backupDaten));
  assert.equal(backup.reisen.length, 1, 'das Backup muss den Stand vor dem zweiten Schreiben haben');
  assert.equal(ladeDaten().reisen.length, 2);
});

test('ein gesperrter Speicher wirft mit einem verständlichen Satz', () => {
  globalThis.localStorage = baueSpeicher({ voll: true });
  assert.throws(() => speichereDaten(leereDaten()), /Speicher des Browsers ist voll/);
});

test('kaputte gespeicherte Daten werden als leerer Bestand behandelt', () => {
  localStorage.setItem(SCHLUESSEL.daten, 'nicht mal json');
  assert.deepEqual(ladeDaten(), { version: 2, personen: [], reisen: [], packlisten: [] });
});

/* --- Zusammenführen (US-10 und Sync, PRD §4.5) ----------------------------- */

/*
 * Dieselbe Regel trägt zwei Wege: den Datei-Import (US-10) und den Sync. Sie
 * liegt deshalb in store.js und nicht in der UI. Der teure Fehlerfall steht im
 * zweiten Test: ein fremder Stand ohne Packliste darf den lokalen Abhak-Stand
 * nicht wegwerfen.
 */

test('fuegeReisenZusammen: gleiche id ersetzt, neue kommen dazu', () => {
  const bestand = { version: 1, reisen: [{ id: 'a', name: 'Alt' }], packlisten: [] };
  const neu = { version: 1, reisen: [{ id: 'a', name: 'Neu' }, { id: 'b', name: 'Zusatz' }], packlisten: [] };

  const { daten, dazu } = fuegeReisenZusammen(bestand, neu);
  assert.equal(dazu, 1, 'nur b ist wirklich neu');
  assert.equal(daten.reisen.length, 2);
  assert.equal(daten.reisen.find((r) => r.id === 'a').name, 'Neu');
  assert.equal(daten.version, 2, 'das Ergebnis trägt den aktuellen Stand, die Eingaben dürfen alt sein');
});

test('fuegeReisenZusammen: eine fremde Reise ohne Packliste lässt den lokalen Abhak-Stand stehen', () => {
  const bestand = {
    version: 1,
    reisen: [{ id: 'a', name: 'Tauchurlaub' }],
    packlisten: [{ reise_id: 'a', positionen: [{ item_id: 'x', menge: 1, gepackt: true }] }],
  };
  const neu = { version: 1, reisen: [{ id: 'a', name: 'Tauchurlaub' }], packlisten: [] };

  const { daten } = fuegeReisenZusammen(bestand, neu);
  assert.equal(daten.packlisten.length, 1, 'die lokale Liste darf nicht verschwinden');
  assert.equal(daten.packlisten[0].positionen[0].gepackt, true);
});

test('fuegeReisenZusammen: eine mitgelieferte Liste ersetzt genau ihre Reise', () => {
  const bestand = {
    version: 1,
    reisen: [{ id: 'a' }, { id: 'b' }],
    packlisten: [
      { reise_id: 'a', positionen: [{ item_id: 'x', gepackt: true }] },
      { reise_id: 'b', positionen: [{ item_id: 'y', gepackt: true }] },
    ],
  };
  const neu = { version: 1, reisen: [{ id: 'a' }], packlisten: [{ reise_id: 'a', positionen: [{ item_id: 'x', gepackt: false }] }] };

  const { daten } = fuegeReisenZusammen(bestand, neu);
  assert.equal(daten.packlisten.length, 2);
  assert.equal(daten.packlisten.find((p) => p.reise_id === 'a').positionen[0].gepackt, false, 'a wird ersetzt');
  assert.equal(daten.packlisten.find((p) => p.reise_id === 'b').positionen[0].gepackt, true, 'b bleibt unberührt');
});

test('fuegeReisenZusammen verträgt einen leeren Bestand in beide Richtungen', () => {
  const leer = { version: 1, reisen: [], packlisten: [] };
  const voll = { version: 1, reisen: [{ id: 'a' }], packlisten: [{ reise_id: 'a', positionen: [] }] };

  assert.equal(fuegeReisenZusammen(leer, voll).daten.reisen.length, 1);
  assert.equal(fuegeReisenZusammen(voll, leer).daten.reisen.length, 1, 'nichts zu mischen heißt: nichts verlieren');
  assert.equal(fuegeReisenZusammen(null, voll).daten.reisen.length, 1, 'auch ohne Bestand darf es nicht werfen');
});

/* --- Personen (PRD §4.6) --------------------------------------------------- */

/*
 * Der teure Fehlerfall steht im ersten Test: eine Reise hat zwei Listen, und ein
 * Merge über `reise_id` allein hielte nur eine davon. Der zweite ist der
 * Altbestand — er darf durch das neue Feld nicht unlesbar werden.
 */

test('Personen überleben Speichern und Laden', () => {
  const daten = leereDaten();
  daten.personen.push({ id: 'p1', name: 'Anna', geschlecht: 'weiblich' });
  speichereDaten(daten);

  const wieder = ladeDaten();
  assert.deepEqual(wieder.personen, [{ id: 'p1', name: 'Anna', geschlecht: 'weiblich' }]);
});

test('ein Stand ohne personen bleibt gültig und wird aufgefüllt', () => {
  // So sieht der Bestand auf einem Gerät aus, das die alte App-Version hat.
  localStorage.setItem(
    SCHLUESSEL.daten,
    JSON.stringify({
      version: 1,
      reisen: [{ id: 'r1', name: 'Tauchurlaub', von: '2026-08-01', bis: '2026-08-10' }],
      packlisten: [{ reise_id: 'r1', erzeugt_am: '2026-08-01T00:00:00.000Z', positionen: [] }],
    })
  );

  const d = ladeDaten();
  assert.deepEqual(d.personen, []);
  assert.deepEqual(d.reisen[0].teilnehmer, []);
  assert.equal(d.reisen[0].name, 'Tauchurlaub', 'die Reise bleibt, wie sie war');
  assert.equal(d.packlisten[0].person_id, undefined, 'einer alten Liste wird kein person_id angedichtet');
});

test('ein Saison-String aus dem Altbestand wird zu einer Liste (1.10)', () => {
  // Genau der Fall, den ein zweites Gerät mit alter App-Version erzeugt: dort
  // steht `saison` noch als Einzelwert. Die Umstellung passiert beim Laden,
  // damit die Engine nur eine Form kennen muss.
  localStorage.setItem(
    SCHLUESSEL.daten,
    JSON.stringify({
      version: 1,
      reisen: [
        { id: 'r1', name: 'Tauchurlaub', saison: 'Sommer' },
        { id: 'r2', name: 'Regenwinter', saison: ['Winter', 'Regen'] },
        { id: 'r3', name: 'Ohne Saison' },
      ],
      packlisten: [],
    })
  );

  const d = ladeDaten();
  assert.deepEqual(d.reisen[0].saison, ['Sommer'], 'der Einzelwert wird zur Ein-Element-Liste');
  assert.deepEqual(d.reisen[1].saison, ['Winter', 'Regen'], 'eine Liste bleibt eine Liste');
  assert.deepEqual(d.reisen[2].saison, [], 'ohne Angabe ist die Auswahl leer');
});

test('findePackliste unterscheidet die Personen derselben Reise', () => {
  const listeAnna = { reise_id: 'r1', person_id: 'p1', positionen: [] };
  const listeBen = { reise_id: 'r1', person_id: 'p2', positionen: [] };
  const alt = { reise_id: 'r1', positionen: [] }; // ohne person_id

  const alle = [alt, listeAnna, listeBen];
  assert.equal(findePackliste(alle, 'r1', 'p1'), listeAnna);
  assert.equal(findePackliste(alle, 'r1', 'p2'), listeBen);
  assert.equal(findePackliste(alle, 'r1', null), alt);
  assert.equal(findePackliste(alle, 'r1', 'p-geloescht'), null);
  assert.equal(findePackliste([], 'r1', null), null);
});

test('listenSchluessel hält null und "" auseinander', () => {
  assert.equal(listenSchluessel('r1', null), listenSchluessel('r1', undefined));
  assert.notEqual(listenSchluessel('r1', null), listenSchluessel('r1', 'p1'));
  assert.notEqual(listenSchluessel('r1', 'p1'), listenSchluessel('r1', 'p2'));
  // Zwei Reisen mit gleicher Person bleiben zwei Listen.
  assert.notEqual(listenSchluessel('r1', 'p1'), listenSchluessel('r2', 'p1'));
});

test('fuegeReisenZusammen: zwei Listen derselben Reise bleiben beide erhalten', () => {
  const bestand = { version: 2, personen: [], reisen: [], packlisten: [] };
  const neu = {
    version: 2,
    personen: [
      { id: 'p1', name: 'Anna' },
      { id: 'p2', name: 'Ben' },
    ],
    reisen: [{ id: 'r1', name: 'Tauchurlaub', teilnehmer: [{ person_id: 'p1' }, { person_id: 'p2' }] }],
    packlisten: [
      { reise_id: 'r1', person_id: 'p1', positionen: [{ item_id: 'bikini', gepackt: true }] },
      { reise_id: 'r1', person_id: 'p2', positionen: [{ item_id: 'badehose', gepackt: false }] },
    ],
  };

  const { daten } = fuegeReisenZusammen(bestand, neu);
  assert.equal(daten.packlisten.length, 2, 'die zweite Person darf die erste nicht überschreiben');
  assert.equal(findePackliste(daten.packlisten, 'r1', 'p1').positionen[0].gepackt, true);
  assert.equal(findePackliste(daten.packlisten, 'r1', 'p2').positionen[0].item_id, 'badehose');
  assert.deepEqual(daten.personen.map((p) => p.id), ['p1', 'p2']);
});

test('fuegeReisenZusammen: eine Person ersetzt nur ihre eigene Liste', () => {
  const bestand = {
    version: 2,
    personen: [{ id: 'p1', name: 'Anna' }],
    reisen: [{ id: 'r1', name: 'Tauchurlaub' }],
    packlisten: [
      { reise_id: 'r1', person_id: 'p1', positionen: [{ item_id: 'x', gepackt: false }] },
      { reise_id: 'r1', person_id: 'p2', positionen: [{ item_id: 'y', gepackt: true }] },
    ],
  };
  const neu = {
    version: 2,
    personen: [{ id: 'p2', name: 'Benjamin' }],
    reisen: [{ id: 'r1', name: 'Tauchurlaub' }],
    packlisten: [{ reise_id: 'r1', person_id: 'p1', positionen: [{ item_id: 'x', gepackt: true }] }],
  };

  const { daten } = fuegeReisenZusammen(bestand, neu);
  assert.equal(findePackliste(daten.packlisten, 'r1', 'p1').positionen[0].gepackt, true, 'p1 wird ersetzt');
  assert.equal(findePackliste(daten.packlisten, 'r1', 'p2').positionen[0].gepackt, true, 'p2 bleibt unberührt');
  assert.equal(daten.personen.find((p) => p.id === 'p2').name, 'Benjamin', 'gleiche id ersetzt die Person');
  assert.equal(daten.personen.find((p) => p.id === 'p1').name, 'Anna');
});

test('fuegeReisenZusammen: eine alte Liste ohne person_id bleibt ihre eigene', () => {
  // Kein `person_id` heißt `null` — nicht „passt auf alle". Sonst überschriebe
  // die Altliste beim Holen die Liste der ersten Person.
  const bestand = {
    version: 2,
    reisen: [{ id: 'r1' }],
    packlisten: [{ reise_id: 'r1', person_id: 'p1', positionen: [{ item_id: 'a' }] }],
  };
  const neu = {
    version: 2,
    reisen: [{ id: 'r1' }],
    packlisten: [{ reise_id: 'r1', positionen: [{ item_id: 'alt' }] }],
  };

  const { daten } = fuegeReisenZusammen(bestand, neu);
  assert.equal(daten.packlisten.length, 2);
  assert.equal(findePackliste(daten.packlisten, 'r1', 'p1').positionen[0].item_id, 'a');
  assert.equal(findePackliste(daten.packlisten, 'r1', null).positionen[0].item_id, 'alt');
});

test('validiereDaten nimmt personen, teilnehmer und person_id an', () => {
  const datei = {
    version: 2,
    personen: [{ id: 'p1', name: 'Anna', geschlecht: 'weiblich' }],
    reisen: [{ id: 'r1', name: 'Tauchurlaub', teilnehmer: [{ person_id: 'p1', aktivitaeten: ['Fotografie'] }] }],
    packlisten: [
      { reise_id: 'r1', person_id: 'p1', positionen: [] },
      { reise_id: 'r1', person_id: null, positionen: [] },
    ],
  };
  const p = validiereDaten(datei);
  assert.ok(p.ok);
  assert.deepEqual(p.daten.personen, datei.personen);
  assert.deepEqual(p.daten.reisen[0].teilnehmer, datei.reisen[0].teilnehmer);
});

test('validiereDaten lehnt kaputte Personen und Teilnehmer ab', () => {
  const reise = { id: 'r1', name: 'Tauchurlaub' };
  const faelle = [
    [{ reisen: [reise], personen: 'keine Liste' }, /"personen" ist keine Liste/],
    [{ reisen: [reise], personen: [{ name: 'ohne id' }] }, /Person #1: id fehlt/],
    [{ reisen: [reise], personen: [{ id: 'p1' }] }, /Person #1: name fehlt/],
    [{ reisen: [{ ...reise, teilnehmer: 'keine Liste' }] }, /"teilnehmer" ist keine Liste/],
    [{ reisen: [{ ...reise, teilnehmer: [{ aktivitaeten: [] }] }] }, /Teilnehmer #1: person_id fehlt/],
    [{ reisen: [reise], packlisten: [{ person_id: 'p1' }] }, /Packliste #1: reise_id fehlt/],
    [{ reisen: [reise], packlisten: [{ reise_id: 'r1', person_id: 7 }] }, /person_id ist weder Text noch null/],
  ];

  for (const [datei, muster] of faelle) {
    const p = validiereDaten(datei);
    assert.equal(p.ok, false, `hätte abgelehnt werden müssen: ${JSON.stringify(datei)}`);
    assert.match(p.fehler.join(' '), muster);
  }
});

/* --- Reise-Datei prüfen (US-10) -------------------------------------------- */

test('der eigene Export ist wieder einlesbar (US-10)', () => {
  const daten = { version: 1, reisen: [{ id: 'r1', name: 'Tauchurlaub', von: '2026-08-01', bis: '2026-08-10' }], packlisten: [] };
  const alsDatei = JSON.parse(JSON.stringify(daten)); // was exportiert wird
  const p = validiereDaten(alsDatei);
  assert.ok(p.ok);
  assert.equal(p.daten.reisen[0].name, 'Tauchurlaub');
});

test('eine Reise-Datei ohne reisen-Liste wird abgelehnt', () => {
  assert.equal(validiereDaten({ version: 1 }).ok, false);
  assert.equal(validiereDaten([{ id: 'r1', name: 'x' }]).ok, false);
  assert.equal(validiereDaten({ reisen: [{ name: 'ohne id' }] }).ok, false);
});

/* --- Der Durchlauf: Katalog + Reise -> Liste -> Ausgabe -------------------- */

test('kompletter Durchlauf: Katalog + Reise -> Liste -> speichern -> laden', () => {
  const katalog = validiereKatalog(katalogRoh).katalog;

  const reise = {
    id: neueId(),
    name: 'Tauchurlaub Ägypten',
    ziel: 'Hurghada',
    von: '2026-10-01',
    bis: '2026-10-10',
    saison: 'Sommer',
    aktivitaeten: ['Tauchen'],
    verkehrsmittel: 'Flugzeug',
    unterkunft: 'Ferienwohnung',
    zusatz_tags: [],
    entfernte_tags: [],
  };

  assert.equal(reisetage(reise.von, reise.bis), 10);

  const liste = erzeugePackliste(katalog, reise);
  assert.ok(liste.positionen.length > 5, `nur ${liste.positionen.length} Positionen`);

  // Speichern und wieder laden — die Momentaufnahme muss stabil sein
  const daten = leereDaten();
  daten.reisen.push(reise);
  daten.packlisten.push(liste);
  speichereDaten(daten);

  const wieder = ladeDaten();
  const liste2 = wieder.packlisten[0];
  const gruppen = gruppiere(katalog, liste2.positionen);
  assert.ok(gruppen.length > 5, 'mehrere Kategorien');
  assert.equal(
    gruppen[0].kategorie,
    'Dokumente & Wertsachen',
    'Essentials stehen oben (Anhang B.1, O9)'
  );
});

test('echter Katalog: der Durchlauf ergibt eine volle Liste', { skip: nurMitEchtemKatalog }, () => {
  const katalog = validiereKatalog(echterKatalog).katalog;
  const reise = {
    id: 'echt-durchlauf',
    name: 'Tauchurlaub Ägypten',
    von: '2026-10-01',
    bis: '2026-10-10',
    saison: 'Sommer',
    aktivitaeten: ['Tauchen'],
    verkehrsmittel: 'Flugzeug',
    unterkunft: 'Ferienwohnung',
  };

  const liste = erzeugePackliste(katalog, reise);
  assert.ok(liste.positionen.length > 50, `nur ${liste.positionen.length} Positionen`);
  assert.ok(gruppiere(katalog, liste.positionen).length > 5);
  assert.ok(liste.positionen.every((p) => Number.isInteger(p.menge) && p.menge >= 1));
});

test('Overrides überleben: abhaken, Menge ändern, entfernen, hinzufügen (US-05, US-06)', () => {
  const katalog = validiereKatalog(katalogRoh).katalog;
  const reise = {
    id: 'r1',
    name: 'Kurztrip',
    von: '2026-06-01',
    bis: '2026-06-03',
    saison: 'Sommer',
    aktivitaeten: [],
    verkehrsmittel: 'Flugzeug',
    unterkunft: 'Hotel',
  };

  const liste = erzeugePackliste(katalog, reise);
  const vorher = liste.positionen.length;

  // abhaken
  liste.positionen[0].gepackt = true;
  // Menge ändern
  liste.positionen[1].menge = 7;
  liste.positionen[1].manuell_geaendert = true;
  // entfernen
  const weg = liste.positionen[2].item_id;
  liste.positionen = liste.positionen.filter((p) => p.item_id !== weg);
  // hinzufügen, obwohl die Tags nicht passen
  const extra = katalog.items.find((i) => !tripTags(reise).has(i.tags[0])) ?? katalog.items[0];
  liste.positionen.push(neuePosition(extra, 3));

  assert.equal(liste.positionen.length, vorher);
  assert.equal(liste.positionen[1].menge, 7);
  assert.ok(liste.positionen.at(-1).manuell_hinzugefuegt);

  const daten = leereDaten();
  daten.reisen.push(reise);
  daten.packlisten.push(liste);
  speichereDaten(daten);

  const zurueck = ladeDaten().packlisten[0];
  assert.equal(zurueck.positionen[0].gepackt, true, 'das Häkchen muss den Neustart überleben');
  assert.equal(zurueck.positionen[1].menge, 7);
  assert.ok(!zurueck.positionen.some((p) => p.item_id === weg), 'das entfernte Item bleibt weg');
  assert.ok(zurueck.positionen.at(-1).manuell_hinzugefuegt);
});

test('überlebte Position ohne Item im Katalog bricht die Ausgabe nicht', () => {
  const katalog = validiereKatalog(katalogRoh).katalog;
  const positionen = [{ item_id: 'gibt-es-nicht', menge: 1, gepackt: false }];
  assert.deepEqual(gruppiere(katalog, positionen), []);
  const md = alsMarkdown(katalog, { name: 'X' }, positionen);
  assert.match(md, /Nichts zu packen/);
});

test('Markdown-Ausgabe enthält die Kategorien in Anhang-B.1-Reihenfolge', () => {
  const katalog = validiereKatalog(katalogRoh).katalog;
  const reise = {
    id: 'r1',
    name: 'Sortierprobe',
    von: '2026-06-01',
    bis: '2026-06-05',
    saison: 'Sommer',
    aktivitaeten: ['Tauchen'],
    verkehrsmittel: 'Flugzeug',
    unterkunft: 'Camping',
  };
  const liste = erzeugePackliste(katalog, reise);
  const md = alsMarkdown(katalog, reise, liste.positionen);

  const reihenfolge = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.ok(reihenfolge.length > 3);
  assert.equal(reihenfolge[0], 'Dokumente & Wertsachen');
  assert.equal(
    reihenfolge.at(-1),
    'Haushalt & Sonstiges',
    'Sonstiges steht am Ende — es sei denn, es fehlt ganz'
  );
});

test('fortschritt im echten Durchlauf', () => {
  const katalog = validiereKatalog(katalogRoh).katalog;
  const reise = { id: 'r1', von: '2026-06-01', bis: '2026-06-03' };
  const liste = erzeugePackliste(katalog, reise);
  liste.positionen.slice(0, 10).forEach((p) => (p.gepackt = true));
  const s = fortschritt(liste.positionen);
  assert.equal(s.gepackt, 10);
  assert.equal(s.gesamt, liste.positionen.length);
  assert.ok(s.anteil > 0 && s.anteil < 1);
});
