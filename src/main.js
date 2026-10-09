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
import { ladeKatalog, ladeDaten, speichereDaten, speicherVerfuegbar, neueId, findePackliste } from './store.js';
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
  /**
   * Der Text, der gerade läuft — oder `null`. Genau ein Sync zur Zeit: ein
   * zweiter Knopfdruck während eines laufenden Vorgangs soll nicht zwei
   * Schreibvorgänge lostreten.
   */
  laden: null,
  /** Ein ungelöster Sync-Konflikt. Belegt die Konfliktkarte (PRD §4.5). */
  konflikt: null,
};

/* --- Zustandshelfer -------------------------------------------------------- */

function reiseNach(id) {
  return zustand.daten.reisen.find((r) => r.id === id) ?? null;
}

function personNach(id) {
  return zustand.daten.personen.find((p) => p.id === id) ?? null;
}

/**
 * Die Packliste zu Reise **und** Person (PRD §4.6). Weil hier nur durchgereicht
 * wird, gilt die `?? null`-Regel für alte Listen an genau einer Stelle —
 * `findePackliste` in store.js.
 */
function packlisteNach(reiseId, personId = null) {
  return findePackliste(zustand.daten.packlisten, reiseId, personId);
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

  /**
   * Führt einen Sync-Handgriff aus und hält die Oberfläche so lange an.
   *
   * Während `laden` gesetzt ist, sind die Sync-Knöpfe `disabled` — das ist der
   * ganze Ladezustand. Die Aufgabe setzt nur `melde`/`zeigeFehler`; gerendert
   * wird genau einmal am Ende, damit die Rückmeldung nicht vorher verpufft.
   */
  async lade(text, aufgabe) {
    if (zustand.laden) return null;
    zustand.laden = text;
    render();
    try {
      return await aufgabe();
    } finally {
      zustand.laden = null;
      render();
    }
  },

  setzeKonflikt(konflikt) {
    zustand.konflikt = konflikt;
  },

  verwerfeKonflikt() {
    zustand.konflikt = null;
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
    const listen = zustand.daten.packlisten.filter((p) => p.reise_id === id).length;
    const was = listen > 1 ? `${listen} Packlisten` : 'ihre Packliste';
    if (!confirm(`"${reise.name}" und ${was} löschen? Das lässt sich nicht rückgängig machen.`)) return;
    zustand.daten.reisen = zustand.daten.reisen.filter((r) => r.id !== id);
    zustand.daten.packlisten = zustand.daten.packlisten.filter((p) => p.reise_id !== id);
    speichere();
    aktionen.melde(`"${reise.name}" gelöscht.`, 'info');
    aktionen.gehe('/');
  },

  dupliziereReise(id) {
    const reise = reiseNach(id);
    if (!reise) return;
    const kopie = {
      ...reise,
      id: neueId(),
      name: `${reise.name} (Kopie)`,
      // Ohne eigene Kopien teilten Original und Kopie dieselben Teilnehmer-
      // Objekte — eine geänderte Aktivität änderte dann beide Reisen.
      teilnehmer: (reise.teilnehmer ?? []).map((t) => ({ ...t, aktivitaeten: [...(t.aktivitaeten ?? [])] })),
    };
    zustand.daten.reisen.unshift(kopie);
    speichere(); // die Packliste wird bewusst nicht mitkopiert — sie ist eine Momentaufnahme
    aktionen.melde(`"${kopie.name}" angelegt.`, 'ok');
    aktionen.gehe(`/reise/${kopie.id}`);
  },

  /* Personen (PRD §4.6) */

  /**
   * Das globale Register. Eine Person gehört keinem einzelnen Reise-Eintrag,
   * sondern dem Bestand — sonst müsste man sie auf jeder Reise neu anlegen.
   */
  legePersonAn(person) {
    const neu = { id: neueId(), name: '', geschlecht: '', ...person };
    zustand.daten.personen.push(neu);
    speichere();
    return neu;
  },

  aktualisierePerson(id, aenderungen) {
    const i = zustand.daten.personen.findIndex((p) => p.id === id);
    if (i === -1) return null;
    zustand.daten.personen[i] = { ...zustand.daten.personen[i], ...aenderungen };
    speichere();
    return zustand.daten.personen[i];
  },

  /**
   * Löscht eine Person aus dem Register **und** aus allen Reisen.
   *
   * Die Packlisten bleiben stehen: sie sind eine Momentaufnahme (PRD §4.4), und
   * wer gerade packt, soll die Liste nicht unter den Händen verlieren. Erreichbar
   * bleibt sie über ihre Person-Id, auch wenn es die Person nicht mehr gibt.
   */
  loeschePerson(id) {
    const person = personNach(id);
    if (!person) return;
    const betroffen = zustand.daten.reisen.filter((r) => (r.teilnehmer ?? []).some((t) => t.person_id === id));
    const frage = betroffen.length
      ? `"${person.name}" löschen? Sie fällt aus ${betroffen.length} Reise(n); die dort schon erzeugten Listen bleiben erhalten.`
      : `"${person.name}" löschen?`;
    if (!confirm(frage)) return;

    zustand.daten.personen = zustand.daten.personen.filter((p) => p.id !== id);
    for (const r of zustand.daten.reisen) {
      if (Array.isArray(r.teilnehmer)) r.teilnehmer = r.teilnehmer.filter((t) => t.person_id !== id);
    }
    speichere();
    aktionen.melde(`"${person.name}" gelöscht.`, 'info');
  },

  /* Packlisten */

  setzePackliste(reiseId, personId, packliste) {
    const gesetzt = { ...packliste, reise_id: reiseId, person_id: personId ?? null };
    const i = zustand.daten.packlisten.findIndex(
      (p) => (p.reise_id === reiseId) && ((p.person_id ?? null) === (personId ?? null))
    );
    if (i === -1) zustand.daten.packlisten.push(gesetzt);
    else zustand.daten.packlisten[i] = gesetzt;
    speichere();
  },

  loeschePackliste(reiseId, personId = null) {
    zustand.daten.packlisten = zustand.daten.packlisten.filter(
      (p) => !((p.reise_id === reiseId) && ((p.person_id ?? null) === (personId ?? null)))
    );
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
      // `#/liste/:reiseId` bleibt gültig — die Ansicht leitet auf die erste
      // Person um, wenn es mehrere gibt (PRD §4.6).
      return ansichtListe(ctx({ reiseId: teile[1], personId: teile[2] ?? null }));
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
  if (zustand.laden) wurzel.append(meldung(zustand.laden, 'info'));
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
