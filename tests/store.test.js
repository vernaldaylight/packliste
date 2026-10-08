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
  neueId,
  SCHLUESSEL,
} = await import('../src/store.js');

const { erzeugePackliste, gruppiere, alsMarkdown, neuePosition, fortschritt, tripTags, reisetage } = await import(
  '../src/engine.js'
);

const HIER = dirname(fileURLToPath(import.meta.url));
const katalogRoh = JSON.parse(readFileSync(resolve(HIER, '../daten/katalog.json'), 'utf8'));

beforeEach(() => {
  globalThis.localStorage = baueSpeicher();
});

/* --- Katalog prüfen (US-09) ------------------------------------------------ */

test('der echte katalog.json wird angenommen', () => {
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
  assert.equal(s.kategorien, 11, 'PRD Anhang B.1 friert elf Kategorien ein');
  assert.equal(
    s.regeln.einmal + s.regeln.fest + s.regeln.pro_tage,
    s.items,
    'jedes Item hat genau eine Mengenregel'
  );
  assert.ok(s.tags > 10);
});

/* --- Reisen und Packlisten ------------------------------------------------- */

test('leerer Zustand: ohne gespeicherte Daten kommt eine leere Struktur', () => {
  const d = ladeDaten();
  assert.deepEqual(d, { version: 1, reisen: [], packlisten: [] });
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
  assert.deepEqual(ladeDaten(), { version: 1, reisen: [], packlisten: [] });
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

test('kompletter Durchlauf: aus dem echten Katalog wird eine brauchbare Liste', () => {
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
  assert.ok(liste.positionen.length > 50);

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

test('Overrides überleben: abhaken, Menge ändern, entfernen, hinzufügen (US-05, US-06)', () => {
  const katalog = validiereKatalog(katalogRoh).katalog;
  const reise = {
    id: 'r1',
    name: 'Kurztrip',
    von: '2026-06-01',
    bis: '2026-06-03',
    saison: 'Sommer',
    aktivitaeten: [],
    verkehrsmittel: 'Zug',
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
