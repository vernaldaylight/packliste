/**
 * ansichtKatalog.js — Katalog holen und sichern, Reisen sichern (US-09, US-10).
 *
 * Diese Ansicht ist die einzige, die auch ohne Katalog funktioniert — sie ist
 * der Weg zurück, wenn iOS den Script-Storage geräumt hat (PRD §4.5).
 *
 * Der Katalog ist am Handy read-only: geändert wird er am Mac im Daten-Repo und
 * per Commit (PRD §3.6). Die Sync-Handgriffe liegen in `syncUi.js`.
 */

import { h, karte, dateiWaehler } from './dom.js';
import {
  katalogStatistik,
  ladeKatalog,
  entferneKatalog,
  katalogBackupVorhanden,
  teileDatei,
  datenBackupVorhanden,
} from '../store.js';
import { importiereKatalog, importiereReisen, katalogDateiname, reisenDateiname } from './dateien.js';
import { KATEGORIEN } from '../engine.js';
import { karteSync, karteKonflikt, zieheKatalog, zieheReisen, schiebeReisenStand } from './syncUi.js';

export function ansichtKatalog(zustand) {
  const { katalog, daten, aktionen, konflikt, laden } = zustand;
  if (!katalog) return ohneKatalog(zustand);

  const s = katalogStatistik(katalog);
  const gepflegt = s.regeln.fest + s.regeln.pro_tage;
  // `laden` ist das Flag aus dem Zustand, NICHT `aktionen.lade` — das ist die
  // Methode. Wer hier die Methode prüft, sperrt nie einen Knopf.
  const laeuft = Boolean(laden);

  return h(
    'div',
    { class: 'stapel' },
    h('h1', {}, 'Katalog & Daten'),

    karteKonflikt({ konflikt, daten, aktionen, laden }),

    karte(
      'Katalog',
      h('p', { class: 'klein' }, `Version ${katalog.version} · Stand dieses Geräts`),
      h(
        'ul',
        { class: 'daten-liste' },
        zeile('Items', s.items),
        zeile('Kategorien', `${s.kategorien} von ${KATEGORIEN.length}`),
        zeile('Verschiedene Tags', s.tags),
        zeile('Mengenregeln', `${s.regeln.einmal}× einmal · ${gepflegt}× gepflegt`)
      ),
      h(
        'p',
        { class: 'feld-hinweis' },
        `Katalog-Abdeckung: ${s.items === 0 ? 0 : Math.round((gepflegt / s.items) * 100)} % der Items haben eine gepflegte Mengenregel. ` +
          'Der Rest steht auf „einmal" und wird am Mac im Daten-Repo nachgezogen.'
      ),
      h('h3', { class: 'unter-titel' }, 'Verteilung'),
      h(
        'ul',
        { class: 'daten-liste' },
        ...s.kategorienListe.map(([k, n]) => zeile(k, n))
      ),
      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          { class: 'knopf', disabled: laeuft, onclick: () => zieheKatalog(aktionen) },
          'Aus GitHub holen'
        ),
        dateiWaehler('.json,application/json', (d) => importiereKatalog(d, aktionen), 'Anderen Katalog importieren …'),
        h('button', { class: 'knopf', onclick: () => exportiereKatalog(katalog, aktionen) }, 'Katalog sichern'),
        h(
          'button',
          {
            class: 'knopf knopf-gefahr',
            onclick: () => {
              if (!confirm('Katalog von diesem Gerät entfernen? Die Datei im Projekt bleibt unangetastet — du kannst sie jederzeit wieder importieren.')) return;
              entferneKatalog();
              aktionen.setzeKatalog(null);
              aktionen.melde('Katalog entfernt. Reisen und Packlisten sind noch da.', 'info');
              aktionen.render();
            },
          },
          'Katalog entfernen'
        )
      ),
      h(
        'p',
        { class: 'feld-hinweis' },
        'Ein neuer Import ersetzt den Katalog komplett. Die Kategorie eines Items kann sich dadurch ändern — Reisen und Packlisten bleiben, wie sie sind.'
      )
    ),

    karte(
      'Reisen (US-10)',
      h(
        'p',
        {},
        `${daten.reisen.length} Reisen, ${daten.packlisten.length} Packlisten. Sie liegen in diesem Browser und — wenn du schiebst — im privaten Daten-Repo.`
      ),
      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          {
            class: 'knopf knopf-haupt',
            disabled: daten.reisen.length === 0 || laeuft,
            onclick: () => schiebeReisenStand(aktionen, daten),
          },
          'Hochschieben'
        ),
        h(
          'button',
          { class: 'knopf', disabled: laeuft, onclick: () => zieheReisen(aktionen, daten) },
          'Holen'
        )
      ),
      h(
        'p',
        { class: 'feld-hinweis' },
        '„Hochschieben" legt den hiesigen Stand drüben ab und ersetzt, was dort liegt — liegt dort eine Reise, die es hier nicht gibt, wird vorher gefragt. ' +
          '„Holen" führt zusammen: gleiche Reise wird ersetzt, neue kommen dazu, hiesige bleiben.'
      ),

      h('h3', { class: 'unter-titel' }, 'Ohne Netz: Datei'),
      h('p', { class: 'klein' }, 'Beide Wege bleiben — der Sync braucht Netz, die Datei nicht.'),
      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          {
            class: 'knopf',
            disabled: daten.reisen.length === 0,
            onclick: async () => {
              const ergebnis = await teileDatei(JSON.stringify({ ...daten, exportiert_am: new Date().toISOString() }, null, 2), reisenDateiname(), 'Packliste — Reisen');
              if (ergebnis === 'geteilt' || ergebnis === 'heruntergeladen') {
                aktionen.melde(ergebnis === 'geteilt' ? 'Reisen geteilt.' : 'Reisen als Datei gespeichert.', 'ok');
                aktionen.render();
              } else if (ergebnis === 'fehler') {
                aktionen.melde('Export ging nicht. Der Bestand ist unverändert.', 'fehler');
                aktionen.render();
              }
            },
          },
          'Reisen exportieren'
        ),
        dateiWaehler('.json,application/json', (d) => importiereReisen(d, aktionen, false), 'Reisen hinzufügen …'),
        dateiWaehler('.json,application/json', (d) => importiereReisen(d, aktionen, true), 'Bestand ersetzen …')
      ),
      h('p', { class: 'feld-hinweis' }, 'Der Export verändert nichts am lokalen Bestand. „Hinzufügen" ergänzt, „Ersetzen" überschreibt.'),
      datenBackupVorhanden()
        ? h(
            'p',
            { class: 'klein' },
            'Es liegt ein automatisches Backup der letzten Fassung im Browser. ',
            h(
              'button',
              {
                class: 'knopf knopf-leise',
                onclick: () => {
                  const roh = localStorage.getItem('packliste.reisen.backup');
                  if (!roh) return;
                  if (!confirm('Letzte Fassung wiederherstellen? Der jetzige Stand wird davor gesichert.')) return;
                  localStorage.setItem('packliste.reisen', roh);
                  aktionen.setzeDaten(JSON.parse(roh));
                  aktionen.melde('Letzte Fassung wiederhergestellt.', 'ok');
                  aktionen.render();
                },
              },
              'wiederherstellen'
            )
          )
        : null
    ),

    karteSync({ aktionen, laden }),

    karte(
      'Wo der Katalog herkommt',
      h(
        'p',
        {},
        'Der Master liegt im privaten Daten-Repo, zusammen mit den Reisen. Von dort holt ihn „Aus GitHub holen". ' +
          'Ins App-Repo und in die Deploy-URL kommt er nicht — dort liegt nur die App-Hülle und nichts Persönliches (O11).'
      ),
      h(
        'p',
        { class: 'feld-hinweis' },
        'Katalogänderungen laufen am Mac: im Daten-Repo katalog.json bearbeiten und committen, dann hier „Aus GitHub holen". ' +
          'Ohne Token geht es weiter per Datei — „Anderen Katalog importieren". Am Handy ist der Katalog bewusst read-only.'
      )
    )
  );
}

function zeile(links, rechts) {
  return h('li', {}, h('span', {}, links), h('strong', {}, String(rechts)));
}

async function exportiereKatalog(katalog, aktionen) {
  const ergebnis = await teileDatei(JSON.stringify(katalog, null, 2), katalogDateiname(), 'Packliste — Katalog');
  if (ergebnis === 'geteilt' || ergebnis === 'heruntergeladen') {
    aktionen.melde(ergebnis === 'geteilt' ? 'Katalog geteilt.' : 'Katalog als Datei gespeichert.', 'ok');
  } else if (ergebnis === 'fehler') {
    aktionen.melde('Export ging nicht.', 'fehler');
  }
  aktionen.render();
}

/** Ohne Katalog — der Rückweg nach einer Räumung des Script-Storage. */
function ohneKatalog({ aktionen, laden }) {
  const gesichert = katalogBackupVorhanden();
  return h(
    'div',
    { class: 'stapel' },
    h('h1', {}, 'Katalog & Daten'),
    karte(
      'Kein Katalog auf diesem Gerät',
      h(
        'p',
        {},
        'Hol ',
        h('code', {}, 'katalog.json'),
        ' aus dem privaten Daten-Repo. Der Master liegt im git, es geht also nichts verloren — es ist nur ein Handgriff.'
      ),
      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          { class: 'knopf knopf-haupt', disabled: Boolean(laden), onclick: () => zieheKatalog(aktionen) },
          'Aus GitHub holen'
        ),
        dateiWaehler('.json,application/json', (d) => importiereKatalog(d, aktionen), 'Katalog auswählen …'),
        gesichert
          ? h(
              'button',
              {
                class: 'knopf',
                onclick: () => {
                  const roh = localStorage.getItem('packliste.katalog.backup');
                  if (!roh) return;
                  localStorage.setItem('packliste.katalog', roh);
                  const k = ladeKatalog();
                  aktionen.setzeKatalog(k);
                  aktionen.melde('Vorherige Katalogfassung wiederhergestellt.', 'ok');
                  aktionen.render();
                },
              },
              'Letzte Fassung wiederherstellen'
            )
          : null
      ),
      h(
        'p',
        { class: 'feld-hinweis' },
        'Ohne Netz geht nur die Datei. Reisen und Packlisten sind von alldem nicht betroffen.'
      )
    ),
    karteSync({ aktionen })
  );
}
