/**
 * ansichtRetro.js — "Was hat gefehlt?" (US-08, F12).
 *
 * Im MVP nur das Freitextfeld. Der Direktweg „aus einem Eintrag ein Item
 * anlegen" setzt einen schreibenden Katalog-Editor voraus und wandert mit
 * FF-16 (PRD §3.3, §14) — im MVP wird das Item per Repo-Commit angelegt.
 *
 * Damit dieser Commit leichtfällt, stehen die Tags der Reise hier als
 * kopierbare Zeile bereit: genau die Tags, die das neue Item in
 * daten/katalog.json tragen muss, damit es künftig ausgewählt wird.
 */

import { h, karte, meldung } from './dom.js';
import { tripTags } from '../engine.js';
import { inZwischenablage } from '../store.js';

export function ansichtRetro({ daten, aktionen, reiseId }) {
  const reise = daten.reisen.find((r) => r.id === reiseId) ?? null;
  if (!reise) {
    return h(
      'div',
      {},
      meldung('Diese Reise gibt es nicht mehr.', 'fehler'),
      h('a', { class: 'knopf', href: '#/' }, 'Zurück zur Übersicht')
    );
  }

  const tags = [...tripTags(reise)].sort();
  let text = reise.retro ?? '';

  const feld = h('textarea', {
    class: 'retro-text',
    rows: '8',
    placeholder: 'z. B. Blasenpflaster gefehlt — die Wanderung war länger als geplant.',
    oninput: (e) => (text = e.target.value),
  });
  feld.value = text;

  function speichern(zurueck) {
    aktionen.aktualisiereReise(reise.id, { retro: text.trim() });
    aktionen.melde(`Retro zu „${reise.name}" gespeichert.`, 'ok');
    aktionen.gehe(zurueck ?? '/');
  }

  const itemVorlage = JSON.stringify(
    { id: '<kurzname>', name: '<Name>', kategorie: '<Kategorie>', tags, menge: { art: 'einmal' }, nicht_mit: [], im_besitz: true },
    null,
    2
  );

  return h(
    'div',
    { class: 'stapel' },
    h('h1', {}, `Retro — ${reise.name}`),
    karte(
      'Was hat gefehlt?',
      h(
        'p',
        { class: 'feld-hinweis' },
        'Diese Antwort ist die ehrlichste Zahl am ganzen Werkzeug: vergessene Items pro Reise. Sie kennt nur die Retrospektive.'
      ),
      feld,
      h(
        'div',
        { class: 'knopf-reihe' },
        h('button', { class: 'knopf knopf-haupt', onclick: () => speichern('/') }, 'Speichern'),
        h('button', { class: 'knopf', onclick: () => speichern(null) }, 'Speichern und hier bleiben')
      )
    ),

    karte(
      'Fehlendes Item in den Katalog aufnehmen',
      h(
        'p',
        {},
        'Im MVP läuft das über das Repo: ',
        h('code', {}, 'daten/katalog.json'),
        ' bearbeiten, committen, am Handy neu importieren. Der Editor dafür kommt mit FF-16.'
      ),
      h('p', { class: 'feld-hinweis' }, 'Die Tags dieser Reise, damit das neue Item künftig ausgewählt wird:'),
      h('p', { class: 'tag-reihe' }, ...tags.map((t) => h('span', { class: 'chip chip-ruhig' }, t))),
      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          {
            class: 'knopf',
            onclick: async () => {
              const ok = await inZwischenablage(tags.join(', '));
              aktionen.melde(ok ? 'Tags kopiert.' : 'Kopieren ging nicht.', ok ? 'ok' : 'fehler');
              aktionen.render();
            },
          },
          'Tags kopieren'
        ),
        h(
          'button',
          {
            class: 'knopf',
            onclick: async () => {
              const ok = await inZwischenablage(itemVorlage);
              aktionen.melde(ok ? 'Item-Vorlage kopiert — nur noch Name und Kategorie einsetzen.' : 'Kopieren ging nicht.', ok ? 'ok' : 'fehler');
              aktionen.render();
            },
          },
          'Item-Vorlage kopieren'
        )
      ),
      h('pre', { class: 'vorlage' }, itemVorlage)
    ),

    h('a', { class: 'knopf knopf-leise', href: `#/liste/${reise.id}` }, 'Zur Packliste')
  );
}
