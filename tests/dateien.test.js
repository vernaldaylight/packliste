/**
 * Tests des Datei-Imports in der UI-Schicht (US-09, US-10, PRD §4.5).
 *
 * `store.test.js` prüft `fuegeReisenZusammen` selbst — hier geht es um die
 * Verdrahtung darüber: dass „Reisen ergänzen" den hiesigen Bestand als
 * Grundlage bekommt und ihn nicht durch die Datei ersetzt. Genau das war
 * einmal kaputt, weil `aktionen.daten` immer `undefined` war.
 *
 * Kein DOM nötig: die Ansicht wird hier nicht gezeichnet, `aktionen` ist eine
 * Attrappe. `localStorage` braucht store.js trotzdem — daher dieselbe kleine
 * Attrappe wie in store.test.js, vor dem Import.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
  _karte: new Map(),
  getItem(k) {
    return this._karte.has(k) ? this._karte.get(k) : null;
  },
  setItem(k, v) {
    this._karte.set(k, String(v));
  },
  removeItem(k) {
    this._karte.delete(k);
  },
};
globalThis.DOMException ??= class extends Error {};

const { importiereReisen } = await import('../src/ui/dateien.js');

/** Eine Datei, wie sie der Datei-Wähler liefert. */
function dateiMit(inhalt, name = 'packliste-reisen.json') {
  return { name, text: async () => JSON.stringify(inhalt) };
}

/** Eine `aktionen`-Attrappe, die die Übernahme mitschreibt. */
function baueAktionen() {
  return {
    uebernommen: null,
    meldungen: [],
    setzeDaten(daten) {
      this.uebernommen = daten;
    },
    melde(text, art) {
      this.meldungen.push([text, art]);
    },
    zeigeFehler(fehler) {
      this.meldungen.push([fehler.join(' '), 'fehler']);
    },
    render() {},
  };
}

const hiesig = {
  version: 2,
  personen: [{ id: 'p1', name: 'Ich', geschlecht: null }],
  reisen: [{ id: 'r1', name: 'Hiesige Reise', teilnehmer: [] }],
  packlisten: [{ reise_id: 'r1', person_id: null, positionen: [] }],
};

test('ergänzen: die hiesige Reise bleibt, die fremde kommt dazu', async () => {
  const aktionen = baueAktionen();
  const datei = dateiMit({ version: 2, reisen: [{ id: 'r2', name: 'Fremde Reise', teilnehmer: [] }] });

  await importiereReisen(datei, aktionen, hiesig, false);

  const ids = aktionen.uebernommen.reisen.map((r) => r.id).sort();
  assert.deepEqual(ids, ['r1', 'r2'], 'keine der beiden Reisen darf verloren gehen');
  assert.equal(aktionen.uebernommen.packlisten.length, 1, 'die hiesige Packliste bleibt erhalten');
  assert.match(aktionen.meldungen.at(-1)[0], /1 neu/, 'genau eine Reise ist neu');
});

test('ergänzen einer bereits bekannten Reise zählt sie nicht als neu', async () => {
  const aktionen = baueAktionen();
  const datei = dateiMit({ version: 2, reisen: [{ id: 'r1', name: 'Hiesige Reise, neuer Name', teilnehmer: [] }] });

  await importiereReisen(datei, aktionen, hiesig, false);

  assert.deepEqual(aktionen.uebernommen.reisen.map((r) => r.id), ['r1']);
  assert.match(aktionen.meldungen.at(-1)[0], /0 neu/);
});
