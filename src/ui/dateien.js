/**
 * dateien.js — der Weg der Daten rein und raus (US-09, US-10, PRD §4.5).
 *
 * Die Richtungen sind im MVP bewusst asymmetrisch:
 *   Mac  → Handy   katalog.json auswählen und einmal importieren
 *   Handy → Mac    Reisen als Backup über das Share-Sheet
 *
 * In beide Richtungen gilt: erst prüfen, dann übernehmen. Ein ungültiger
 * Import lässt den bestehenden Bestand unangetastet (US-09).
 */

import { leseJsonDatei, validiereKatalog, speichereKatalog, validiereDaten, fuegeReisenZusammen, zeitstempel } from '../store.js';

/** Prüft und übernimmt eine Katalog-Datei. */
export async function importiereKatalog(datei, aktionen) {
  const gelesen = await leseJsonDatei(datei);
  if (!gelesen.ok) {
    aktionen.melde(gelesen.fehler[0], 'fehler');
    return aktionen.render();
  }

  const geprueft = validiereKatalog(gelesen.daten);
  if (!geprueft.ok) {
    aktionen.zeigeFehler(geprueft.fehler, `Katalog "${datei.name}" nicht übernommen.`);
    return aktionen.render();
  }

  if (!speichereKatalog(geprueft.katalog)) {
    aktionen.melde('Der Katalog konnte nicht gespeichert werden — der Speicher des Browsers ist voll oder gesperrt.', 'fehler');
    return aktionen.render();
  }

  aktionen.setzeKatalog(geprueft.katalog);

  const s = geprueft.statistik;
  const gepflegt = s.regeln.fest + s.regeln.pro_tage;
  aktionen.melde(
    `Katalog übernommen: ${s.items} Items, ${s.kategorien} Kategorien, ${s.tags} Tags. ` +
      `Mengenregeln: ${s.regeln.einmal}× einmal, ${gepflegt}× gepflegt (fest/pro Tag).`,
    'ok'
  );
  aktionen.render();
}

/** Prüft und übernimmt eine Reise-Datei (Rückweg von US-10). */
export async function importiereReisen(datei, aktionen, ersetzen) {
  const gelesen = await leseJsonDatei(datei);
  if (!gelesen.ok) {
    aktionen.melde(gelesen.fehler[0], 'fehler');
    return aktionen.render();
  }

  const geprueft = validiereDaten(gelesen.daten);
  if (!geprueft.ok) {
    aktionen.zeigeFehler(geprueft.fehler, `Datei "${datei.name}" nicht übernommen.`);
    return aktionen.render();
  }

  const neu = geprueft.daten.reisen.length;
  if (ersetzen && !confirm(`Die ${neu} Reisen aus der Datei ersetzen alles, was gerade auf diesem Gerät liegt. Fortfahren?`)) {
    return;
  }

  if (ersetzen) {
    // `geprueft.daten` ist die vollständige Form (store.js, normalisiereDaten) —
    // hier keine Felder nachbauen, sonst fiele `personen` beim Ersetzen weg.
    aktionen.setzeDaten(geprueft.daten);
    aktionen.melde(`${neu} Reisen wiederhergestellt.`, 'ok');
  } else {
    // Zusammenführen über die `id` — dieselbe Regel wie beim Sync (PRD §3.4,
    // §4.5), deshalb liegt sie in store.js und nicht hier.
    const { daten, dazu } = fuegeReisenZusammen(aktionen.daten, geprueft.daten);
    aktionen.setzeDaten(daten);
    aktionen.melde(`${neu} Reisen gelesen, davon ${dazu} neu.`, 'ok');
  }
  aktionen.render();
}

/** Name der Katalog-Backup-Datei. */
export function katalogDateiname() {
  return `katalog-${zeitstempel()}.json`;
}

/** Name der Reise-Backup-Datei. */
export function reisenDateiname() {
  return `packliste-reisen-${zeitstempel()}.json`;
}
