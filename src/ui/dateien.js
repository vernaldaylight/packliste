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

import { leseJsonDatei, validiereKatalog, speichereKatalog, validiereDaten, zeitstempel } from '../store.js';

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
    aktionen.setzeDaten({ version: 1, reisen: geprueft.daten.reisen, packlisten: geprueft.daten.packlisten });
    aktionen.melde(`${neu} Reisen wiederhergestellt.`, 'ok');
  } else {
    // Zusammenführen ohne Merge-Logik (PRD §3.4): gleiche id wird ersetzt,
    // alles andere angehängt. Reisen entstehen nur am Handy, echte Konflikte
    // gibt es deshalb nicht.
    const vorhanden = aktionen.daten.reisen.slice();
    const nachId = new Map(vorhanden.map((r) => [r.id, r]));
    let dazu = 0;
    for (const r of geprueft.daten.reisen) {
      if (!nachId.has(r.id)) dazu++;
      nachId.set(r.id, r);
    }
    const listeIds = new Set(geprueft.daten.packlisten.map((p) => p.reise_id));
    aktionen.setzeDaten({
      version: 1,
      reisen: [...nachId.values()],
      packlisten: [
        ...aktionen.daten.packlisten.filter((p) => !listeIds.has(p.reise_id)),
        ...geprueft.daten.packlisten,
      ],
    });
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
