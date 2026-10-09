/**
 * ansichtStart.js — Reiseübersicht, oder Import-Aufforderung (FR19).
 *
 * Fehlt der Katalog (erster Start, oder nachdem iOS den Script-Storage
 * geräumt hat), zeigt die App die Aufforderung statt einer leeren Liste.
 * Kein Datenverlust — der Master liegt im privaten Daten-Repo (PRD §4.5).
 *
 * Beide Wege stehen hier nebeneinander: GitHub braucht Netz und Token, die
 * Datei braucht keins von beidem. Auf einem frischen Gerät ohne Netz ist der
 * Dateiweg der einzige, der noch geht.
 */

import { h, karte, dateiWaehler, fmtZeitraum } from './dom.js';
import { reisetage, tripTags, fortschritt, KATEGORIEN } from '../engine.js';
import { findePackliste } from '../store.js';
import { importiereKatalog } from './dateien.js';
import { zieheKatalog } from './syncUi.js';

export function ansichtStart(zustand) {
  return zustand.katalog ? uebersicht(zustand) : importAufforderung(zustand);
}

/* --- FR19 ------------------------------------------------------------------ */

function importAufforderung({ aktionen, laden }) {
  return h(
    'div',
    { class: 'stapel' },
    karte(
      'Kein Katalog auf diesem Gerät',
      h(
        'p',
        {},
        'Die App weiß noch nicht, was du besitzt. Der Katalog ist eine Datei — ',
        h('code', {}, 'katalog.json'),
        ' — die im privaten Daten-Repo liegt und hier einmal geholt wird. Danach bleibt sie gespeichert.'
      ),
      h(
        'ol',
        { class: 'schritte' },
        h('li', {}, 'Auf „Aus GitHub holen" tippen — dafür müssen Repo und Token unter „Katalog" hinterlegt sein.'),
        h('li', {}, 'Ohne Netz: die Datei in iCloud Drive legen (oder per AirDrop/Mail schicken) und unten auswählen.'),
        h('li', {}, 'Fertig. Reisen entstehen ab jetzt auf diesem Gerät.')
      ),
      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          { class: 'knopf knopf-haupt', disabled: Boolean(laden), onclick: () => zieheKatalog(aktionen) },
          'Aus GitHub holen'
        ),
        dateiWaehler('.json,application/json', (d) => importiereKatalog(d, aktionen), 'Katalog auswählen …')
      ),
      h(
        'p',
        { class: 'klein' },
        'Der Katalog wird vor dem Übernehmen geprüft. Passt er nicht, wird nichts übernommen.'
      )
    )
  );
}

/* --- Reiseübersicht -------------------------------------------------------- */

function uebersicht({ katalog, daten, aktionen }) {
  const reisen = daten.reisen;

  return h(
    'div',
    { class: 'stapel' },
    h(
      'div',
      { class: 'kopf-reihe' },
      h('h1', {}, 'Meine Reisen'),
      h('a', { class: 'knopf knopf-haupt', href: '#/reise/neu' }, 'Neue Reise')
    ),
    h('p', { class: 'klein' }, `${katalog.items.length} Items im Katalog, ${KATEGORIEN.length} Kategorien.`),

    reisen.length === 0
      ? karte(
          'Noch keine Reise',
          h('p', {}, 'Beschreibe eine Reise — Ziel, Zeitraum, Saison, Aktivitäten. Die Packliste fällt dabei ab.'),
          h('p', { class: 'klein' }, 'Eine Reise anzulegen dauert unter einer Minute.')
        )
      : h('ul', { class: 'reise-liste' }, ...reisen.map((r) => reiseZeile(r, daten, aktionen)))
  );
}

function reiseZeile(reise, daten, aktionen) {
  const tage = reisetage(reise.von, reise.bis);
  const tags = [...tripTags(reise)];

  /**
   * Die Listen dieser Reise, je Person eine (PRD §4.6). Jede verlinkt auf ihre
   * eigene Adresse — der Fortschritt gehört zur Liste, nicht zur Reise.
   */
  const posten = [];
  for (const t of reise.teilnehmer ?? []) {
    const person = daten.personen.find((p) => p.id === t.person_id);
    if (!person) continue;
    posten.push({ person, liste: findePackliste(daten.packlisten, reise.id, person.id) });
  }

  // Ohne Teilnehmer die alte, eine Liste — und wenn es sie nicht gibt, auch
  // keine Zeile: „Noch keine Liste erzeugt" steht dann unten.
  const einzige = posten.length === 0 ? findePackliste(daten.packlisten, reise.id, null) : null;
  const ziele = posten.length > 0 ? posten : einzige ? [{ person: null, liste: einzige }] : [];
  const erste = ziele[0] ?? null;

  const stand = (liste) => {
    if (!liste) return null;
    const s = fortschritt(liste.positionen);
    return `${s.gepackt} von ${s.gesamt} gepackt${s.gesamt > 0 ? ` · ${Math.round(s.anteil * 100)} %` : ''}`;
  };

  return h(
    'li',
    { class: 'reise-karte' },
    h(
      'div',
      { class: 'reise-kopf' },
      h(
        'a',
        { class: 'reise-name', href: erste?.liste ? `#/liste/${reise.id}${erste.person ? `/${erste.person.id}` : ''}` : `#/reise/${reise.id}` },
        reise.name
      ),
      h('span', { class: 'reise-zeitraum' }, fmtZeitraum(reise.von, reise.bis, tage))
    ),

    reise.ziel ? h('p', { class: 'klein' }, reise.ziel) : null,

    h(
      'p',
      { class: 'tag-reihe' },
      ...tags.slice(0, 8).map((t) => h('span', { class: 'chip chip-ruhig' }, t)),
      tags.length > 8 ? h('span', { class: 'klein' }, `+${tags.length - 8}`) : null
    ),

    // Eine Fortschrittszeile je Person, jede führt auf ihre eigene Liste.
    ziele.length > 0
      ? h(
          'ul',
          { class: 'person-reihe' },
          ...ziele.map(({ person, liste }) =>
            h(
              'li',
              { class: 'person-zeile' },
              h(
                'a',
                { href: `#/liste/${reise.id}${person ? `/${person.id}` : ''}` },
                person ? person.name : 'Liste'
              ),
              h('span', { class: 'klein' }, liste ? stand(liste) : 'noch keine Liste')
            )
          )
        )
      : h('p', { class: 'klein' }, 'Noch keine Liste erzeugt'),

    h(
      'div',
      { class: 'knopf-reihe' },
      h(
        'a',
        { class: 'knopf knopf-haupt', href: erste?.liste ? `#/liste/${reise.id}${erste.person ? `/${erste.person.id}` : ''}` : `#/reise/${reise.id}` },
        erste?.liste ? 'Liste öffnen' : 'Liste erzeugen'
      ),
      h('a', { class: 'knopf knopf-leise', href: `#/reise/${reise.id}` }, 'Bearbeiten'),
      h('a', { class: 'knopf knopf-leise', href: `#/retro/${reise.id}` }, 'Retro'),
      h('button', { class: 'knopf knopf-leise', onclick: () => aktionen.dupliziereReise(reise.id) }, 'Duplizieren'),
      h('button', { class: 'knopf knopf-gefahr', onclick: () => aktionen.loescheReise(reise.id) }, 'Löschen')
    )
  );
}
