/**
 * main.js — App-Start, Zustand, Router.
 *
 * Fünf Ansichten, mehr nicht (PRD §3.6):
 *   Start     Reiseübersicht, oder Import-Aufforderung wenn der Katalog fehlt
 *   Reise     Formular mit automatischer Tag-Ableitung
 *   Liste     das Ergebnis: gruppiert, abhakbar, nachjustierbar
 *   Katalog   importieren, Kennzahlen, sichern
 *   Retro     "Was hat gefehlt?"
 */

import './styles.css';
import { ladeKatalog, ladeDaten, speichereDaten, speicherVerfuegbar, neueId } from './store.js';
import { h, leere, meldung, fehlerListe } from './ui/dom.js';
import { ansichtStart } from './ui/ansichtStart.js';
import { ansichtReise } from './ui/ansichtReise.js';
import { ansichtListe } from './ui/ansichtListe.js';
import { ansichtKatalog } from './ui/ansichtKatalog.js';
import { ansichtRetro } from './ui/ansichtRetro.js';

const wurzel = document.getElementById('app');

/** Der gesamte Zustand der App. */
const zustand = {
  katalog: null,
  daten: null,
  /** Einmalige Rückmeldung, die die nächste Ansicht oben anzeigt. */
  blitz: null,
};

/* --- Zustandshelfer -------------------------------------------------------- */

function reiseNach(id) {
  return zustand.daten.reisen.find((r) => r.id === id) ?? null;
}

function packlisteNach(reiseId) {
  return zustand.daten.packlisten.find((p) => p.reise_id === reiseId) ?? null;
}

function speichere() {
  speichereDaten(zustand.daten);
}

/* --- Aktionen, die die Ansichten aufrufen ---------------------------------- */

const aktionen = {
  gehe(pfad) {
    if (location.hash === `#${pfad}`) render();
    else location.hash = pfad;
  },

  melde(text, art = 'info') {
    zustand.blitz = { text, art };
  },

  /** Eine Liste von Validierungsfehlern als Rückmeldung (US-09). */
  zeigeFehler(fehler, titel) {
    zustand.blitz = { fehler, titel };
  },

  /* Reisen */

  legeReiseAn(reise) {
    const neu = { ...reise, id: neueId() };
    zustand.daten.reisen.unshift(neu);
    speichere();
    return neu;
  },

  aktualisiereReise(id, aenderungen) {
    const i = zustand.daten.reisen.findIndex((r) => r.id === id);
    if (i === -1) return null;
    zustand.daten.reisen[i] = { ...zustand.daten.reisen[i], ...aenderungen };
    speichere();
    return zustand.daten.reisen[i];
  },

  loescheReise(id) {
    const reise = reiseNach(id);
    if (!reise) return;
    if (!confirm(`"${reise.name}" und ihre Packliste löschen? Das lässt sich nicht rückgängig machen.`)) return;
    zustand.daten.reisen = zustand.daten.reisen.filter((r) => r.id !== id);
    zustand.daten.packlisten = zustand.daten.packlisten.filter((p) => p.reise_id !== id);
    speichere();
    aktionen.melde(`"${reise.name}" gelöscht.`, 'info');
    aktionen.gehe('/');
  },

  dupliziereReise(id) {
    const reise = reiseNach(id);
    if (!reise) return;
    const kopie = { ...reise, id: neueId(), name: `${reise.name} (Kopie)` };
    zustand.daten.reisen.unshift(kopie);
    speichere(); // die Packliste wird bewusst nicht mitkopiert — sie ist eine Momentaufnahme
    aktionen.melde(`"${kopie.name}" angelegt.`, 'ok');
    aktionen.gehe(`/reise/${kopie.id}`);
  },

  /* Packlisten */

  setzePackliste(reiseId, packliste) {
    const i = zustand.daten.packlisten.findIndex((p) => p.reise_id === reiseId);
    if (i === -1) zustand.daten.packlisten.push(packliste);
    else zustand.daten.packlisten[i] = packliste;
    speichere();
  },

  loeschePackliste(reiseId) {
    zustand.daten.packlisten = zustand.daten.packlisten.filter((p) => p.reise_id !== reiseId);
    speichere();
  },

  /* Katalog */

  setzeKatalog(katalog) {
    zustand.katalog = katalog;
  },

  setzeDaten(daten) {
    zustand.daten = daten;
    speichere();
  },

  render,
};

/** Der Kontext, den jede Ansicht bekommt. */
function ctx(extra = {}) {
  return { ...zustand, aktionen, ...extra };
}

/* --- Router ---------------------------------------------------------------- */

function route() {
  const pfad = location.hash.slice(1) || '/';
  const teile = pfad.split('/').filter(Boolean);

  if (!zustand.katalog) {
    // FR19: Ohne Katalog zeigt die App eine Import-Aufforderung, keine leere
    // Liste. Die Katalogansicht ist die einzige, die ohne Katalog funktioniert.
    return teile[0] === 'katalog' ? ansichtKatalog(ctx()) : ansichtStart(ctx());
  }

  switch (teile[0]) {
    case 'reise':
      return ansichtReise(ctx({ reiseId: teile[1] === 'neu' ? null : teile[1] }));
    case 'liste':
      return ansichtListe(ctx({ reiseId: teile[1] }));
    case 'retro':
      return ansichtRetro(ctx({ reiseId: teile[1] }));
    case 'katalog':
      return ansichtKatalog(ctx());
    default:
      return ansichtStart(ctx());
  }
}

function render() {
  const blitz = zustand.blitz;
  zustand.blitz = null;

  leere(wurzel);
  wurzel.append(kopfzeile());
  if (blitz?.fehler) {
    if (blitz.titel) wurzel.append(meldung(blitz.titel, 'fehler'));
    wurzel.append(fehlerListe(blitz.fehler));
  } else if (blitz) {
    wurzel.append(meldung(blitz.text, blitz.art));
  }
  wurzel.append(route());
  window.scrollTo(0, 0);
}

function kopfzeile() {
  const da = Boolean(zustand.katalog);
  return h(
    'header',
    { class: 'kopf' },
    h('a', { class: 'kopf-titel', href: '#/' }, 'Packliste'),
    h(
      'nav',
      { class: 'kopf-nav' },
      h('a', { href: '#/' }, 'Reisen'),
      h('a', { href: '#/katalog' }, da ? `Katalog (${zustand.katalog.items.length})` : 'Katalog')
    )
  );
}

/* --- Start ----------------------------------------------------------------- */

function starte() {
  if (!speicherVerfuegbar()) {
    wurzel.append(
      meldung(
        'Dieser Browser lässt die App nichts speichern (privater Modus?). Die App läuft, aber Reisen und Katalog sind nach dem Schließen weg.',
        'fehler'
      )
    );
  }

  zustand.katalog = ladeKatalog();
  zustand.daten = ladeDaten();

  window.addEventListener('hashchange', render);
  render();
}

starte();
