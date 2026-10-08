/**
 * ansichtStart.js — Reiseübersicht, oder Import-Aufforderung (FR19).
 *
 * Fehlt der Katalog (erster Start, oder nachdem iOS den Script-Storage
 * geräumt hat), zeigt die App die Aufforderung statt einer leeren Liste.
 * Kein Datenverlust — der Master liegt im git (PRD §4.5).
 */

import { h, karte, dateiWaehler, fmtZeitraum } from './dom.js';
import { reisetage, tripTags, fortschritt, KATEGORIEN } from '../engine.js';
import { importiereKatalog } from './dateien.js';

export function ansichtStart(zustand) {
  return zustand.katalog ? uebersicht(zustand) : importAufforderung(zustand);
}

/* --- FR19 ------------------------------------------------------------------ */

function importAufforderung({ aktionen }) {
  return h(
    'div',
    { class: 'stapel' },
    karte(
      'Kein Katalog auf diesem Gerät',
      h(
        'p',
        {},
        'Die App weiß noch nicht, was du besitzt. Der Katalog ist eine Datei — ',
        h('code', {}, 'daten/katalog.json'),
        ' — die im Projekt liegt und hier einmal importiert wird. Danach bleibt sie gespeichert.'
      ),
      h(
        'ol',
        { class: 'schritte' },
        h('li', {}, 'Die Datei ', h('code', {}, 'katalog.json'), ' in iCloud Drive legen (oder per AirDrop/Mail schicken).'),
        h('li', {}, 'Hier auf „Katalog auswählen" tippen und die Datei aussuchen.'),
        h('li', {}, 'Fertig. Reisen entstehen ab jetzt auf diesem Gerät.')
      ),
      h(
        'div',
        { class: 'knopf-reihe' },
        dateiWaehler('.json,application/json', (d) => importiereKatalog(d, aktionen), 'Katalog auswählen …', 'knopf knopf-haupt')
      ),
      h(
        'p',
        { class: 'klein' },
        'Der Katalog wird beim Import geprüft. Passt die Datei nicht, wird nichts übernommen.'
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
  const liste = daten.packlisten.find((p) => p.reise_id === reise.id) ?? null;
  const stand = liste ? fortschritt(liste.positionen) : null;

  return h(
    'li',
    { class: 'reise-karte' },
    h(
      'div',
      { class: 'reise-kopf' },
      h('a', { class: 'reise-name', href: liste ? `#/liste/${reise.id}` : `#/reise/${reise.id}` }, reise.name),
      h('span', { class: 'reise-zeitraum' }, fmtZeitraum(reise.von, reise.bis, tage))
    ),

    reise.ziel ? h('p', { class: 'klein' }, reise.ziel) : null,

    h(
      'p',
      { class: 'tag-reihe' },
      ...tags.slice(0, 8).map((t) => h('span', { class: 'chip chip-ruhig' }, t)),
      tags.length > 8 ? h('span', { class: 'klein' }, `+${tags.length - 8}`) : null
    ),

    stand
      ? h(
          'p',
          { class: 'klein' },
          `${stand.gepackt} von ${stand.gesamt} gepackt`,
          stand.gesamt > 0 ? ` · ${Math.round(stand.anteil * 100)} %` : ''
        )
      : h('p', { class: 'klein' }, 'Noch keine Liste erzeugt'),

    h(
      'div',
      { class: 'knopf-reihe' },
      h('a', { class: 'knopf knopf-haupt', href: liste ? `#/liste/${reise.id}` : `#/reise/${reise.id}` }, liste ? 'Liste öffnen' : 'Liste erzeugen'),
      h('a', { class: 'knopf knopf-leise', href: `#/reise/${reise.id}` }, 'Bearbeiten'),
      h('a', { class: 'knopf knopf-leise', href: `#/retro/${reise.id}` }, 'Retro'),
      h('button', { class: 'knopf knopf-leise', onclick: () => aktionen.dupliziereReise(reise.id) }, 'Duplizieren'),
      h('button', { class: 'knopf knopf-gefahr', onclick: () => aktionen.loescheReise(reise.id) }, 'Löschen')
    )
  );
}
