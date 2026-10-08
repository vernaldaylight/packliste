/**
 * ansichtReise.js — das Reise-Formular (US-03, F3, F5, F8, F9).
 *
 * Sechs Felder, mehr braucht eine Reise nicht. Alles Weitere fällt ab:
 * die Reisetage aus dem Zeitraum, die Tags aus Saison/Aktivitäten/
 * Verkehrsmittel/Unterkunft.
 *
 * Die abgeleiteten Tags sind sichtbar und einzeln entfernbar (US-03). Entfernte
 * Tags landen in `entfernte_tags` und lassen sich von dort wieder aufnehmen —
 * ohne diese Gegenbuchse wäre ein abgeleiteter Tag nur durch Leeren des ganzen
 * Feldes loszuwerden (siehe engine.js, tripTags). Ausnahme ist `Allgemein`: es
 * ist das Fundament jeder Reise und lässt sich nicht streichen.
 *
 * Die Basis-Tags stehen in einer eigenen Karte. `Reiseapotheke` ist dort ein
 * normaler Schalter — die Kategorie `Medizin` hängt an ihm, nicht an `Allgemein`,
 * und ohne diese Karte wäre er im Formular gar nicht wählbar.
 *
 * Aktivitäten sind Vorschlagsliste plus Freitext (US-03): die bekannten als
 * Schalter, unbekannte tippt man ein. Damit ist die App nicht auf die heute
 * bekannten Kontexte beschränkt (F8).
 */

import { h, karte, feld, meldung } from './dom.js';
import {
  reisetage,
  tripTags,
  abgeleiteteTags,
  erzeugePackliste,
  SAISONS,
  AKTIVITAETEN,
  VERKEHRSMITTEL,
  UNTERKUNFT,
  BASIS_TAG,
  WAHLBARE_BASIS_TAGS,
} from '../engine.js';

export function ansichtReise({ katalog, daten, aktionen, reiseId }) {
  const vorhandene = reiseId ? daten.reisen.find((r) => r.id === reiseId) ?? null : null;
  if (reiseId && !vorhandene) {
    return h(
      'div',
      {},
      meldung('Diese Reise gibt es nicht mehr.', 'fehler'),
      h('a', { class: 'knopf', href: '#/' }, 'Zurück zur Übersicht')
    );
  }

  // Arbeitskopie: erst beim Speichern landet etwas im Bestand.
  const entwurf = {
    id: vorhandene?.id ?? null,
    name: vorhandene?.name ?? '',
    ziel: vorhandene?.ziel ?? '',
    von: vorhandene?.von ?? '',
    bis: vorhandene?.bis ?? '',
    saison: vorhandene?.saison ?? 'Sommer',
    aktivitaeten: [...(vorhandene?.aktivitaeten ?? [])],
    verkehrsmittel: vorhandene?.verkehrsmittel ?? 'Flugzeug',
    unterkunft: vorhandene?.unterkunft ?? 'Ferienwohnung',
    zusatz_tags: [...(vorhandene?.zusatz_tags ?? [])],
    entfernte_tags: [...(vorhandene?.entfernte_tags ?? [])],
  };

  const hatListe = Boolean(daten.packlisten.find((p) => p.reise_id === entwurf.id));

  /* --- Container, die aktualisiere() neu füllt ---------------------------- */

  const tageAnzeige = h('strong', { class: 'wert' });
  const basisAnzeige = h('div', { class: 'tag-reihe' });
  const saisonAnzeige = h('div', { class: 'tag-reihe' });
  const aktivitaetAnzeige = h('div', { class: 'tag-reihe' });
  const verkehrsAnzeige = h('div', { class: 'tag-reihe' });
  const unterkunftAnzeige = h('div', { class: 'tag-reihe' });
  const abgeleitetAnzeige = h('div', { class: 'tag-reihe' });
  const zusatzAnzeige = h('div', { class: 'tag-reihe' });
  const wirksamAnzeige = h('div', { class: 'tag-reihe' });

  /* --- Bausteine ---------------------------------------------------------- */

  /** Ein Schalter, genau einer aktiv (Saison, Verkehrsmittel, Unterkunft). */
  function einerAus(wert, setze, container, optionen) {
    container.replaceChildren(
      ...optionen.map((o) =>
        h(
          'button',
          {
            type: 'button',
            class: `chip chip-schalter${wert() === o ? ' ist-an' : ''}`,
            'aria-pressed': String(wert() === o),
            onclick: () => {
              setze(wert() === o ? '' : o);
              aktualisiere();
            },
          },
          o
        )
      ),
      // Abwählen ist ausdrücklich möglich: ohne Saison-Tag bleibt es bei Allgemein.
      wert() === ''
        ? h('span', { class: 'klein' }, '— keiner gewählt')
        : h(
            'button',
            { type: 'button', class: 'chip chip-leise', onclick: () => { setze(''); aktualisiere(); } },
            'abwählen'
          )
    );
  }

  function entfernbarerChip(text, onWeg) {
    return h(
      'span',
      { class: 'chip chip-eigen' },
      text,
      h('button', { type: 'button', class: 'chip-weg', 'aria-label': `${text} entfernen`, onclick: onWeg }, '×')
    );
  }

  /** Freitext-Feld zum Anlegen eines neuen Tags (F8). Enter fügt hinzu. */
  function freitextFeld(platzhalter, onNeu) {
    const eingabe = h('input', { type: 'text', placeholder: platzhalter, list: 'tag-vorschlaege' });
    const hinzu = () => {
      const wert = eingabe.value.trim();
      if (!wert) return;
      onNeu(wert);
      eingabe.value = '';
      aktualisiere();
      eingabe.focus();
    };
    eingabe.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault(); // nicht das Formular abschicken
      hinzu();
    });
    return h(
      'div',
      { class: 'freitext' },
      eingabe,
      h('button', { type: 'button', class: 'knopf knopf-leise', onclick: hinzu }, 'Hinzufügen')
    );
  }

  /* --- Alles neu zeichnen, was vom Entwurf abhängt ------------------------ */

  function aktualisiere() {
    const tage = reisetage(entwurf.von, entwurf.bis);
    tageAnzeige.textContent = tage > 0 ? `${tage} ${tage === 1 ? 'Tag' : 'Tage'}` : '—';

    einerAus(() => entwurf.saison, (v) => (entwurf.saison = v), saisonAnzeige, SAISONS);
    einerAus(() => entwurf.verkehrsmittel, (v) => (entwurf.verkehrsmittel = v), verkehrsAnzeige, VERKEHRSMITTEL);
    einerAus(() => entwurf.unterkunft, (v) => (entwurf.unterkunft = v), unterkunftAnzeige, UNTERKUNFT);

    // Aktivitäten: bekannte als Schalter, unbekannte als eigener Chip
    const unbekannt = entwurf.aktivitaeten.filter((t) => !AKTIVITAETEN.includes(t));
    aktivitaetAnzeige.replaceChildren(
      ...AKTIVITAETEN.map((t) =>
        h(
          'button',
          {
            type: 'button',
            class: `chip chip-schalter${entwurf.aktivitaeten.includes(t) ? ' ist-an' : ''}`,
            'aria-pressed': String(entwurf.aktivitaeten.includes(t)),
            onclick: () => {
              entwurf.aktivitaeten = entwurf.aktivitaeten.includes(t)
                ? entwurf.aktivitaeten.filter((x) => x !== t)
                : [...entwurf.aktivitaeten, t];
              aktualisiere();
            },
          },
          t
        )
      ),
      ...unbekannt.map((t) =>
        entfernbarerChip(t, () => {
          entwurf.aktivitaeten = entwurf.aktivitaeten.filter((x) => x !== t);
          aktualisiere();
        })
      )
    );

    // Basis: Allgemein liegt fest, die Reiseapotheke ist ein Schalter
    basisAnzeige.replaceChildren(
      h('span', { class: 'chip chip-fix', title: `${BASIS_TAG} ist immer dabei` }, BASIS_TAG),
      ...WAHLBARE_BASIS_TAGS.map((t) => {
        const an = entwurf.zusatz_tags.includes(t);
        return h(
          'button',
          {
            type: 'button',
            class: `chip chip-schalter${an ? ' ist-an' : ''}`,
            'aria-pressed': String(an),
            onclick: () => {
              entwurf.zusatz_tags = an
                ? entwurf.zusatz_tags.filter((x) => x !== t)
                : [...entwurf.zusatz_tags, t];
              aktualisiere();
            },
          },
          t
        );
      })
    );

    // Zusatz-Tags (frei eingetippt) — ohne die Basis-Tags, die oben ihren Schalter haben
    const eigeneTags = entwurf.zusatz_tags.filter((t) => !WAHLBARE_BASIS_TAGS.includes(t));
    zusatzAnzeige.replaceChildren(
      ...(eigeneTags.length === 0
        ? [h('span', { class: 'klein' }, 'noch keine')]
        : eigeneTags.map((t) =>
            entfernbarerChip(t, () => {
              entwurf.zusatz_tags = entwurf.zusatz_tags.filter((x) => x !== t);
              aktualisiere();
            })
          ))
    );

    // Abgeleitete Tags: sichtbar, einzeln entfernbar (US-03) — außer Allgemein
    const abgeleitet = [...abgeleiteteTags(entwurf)].filter((t) => t !== BASIS_TAG).sort();
    abgeleitetAnzeige.replaceChildren(
      ...abgeleitet.map((t) => {
        const weg = entwurf.entfernte_tags.includes(t);
        return h(
          'button',
          {
            type: 'button',
            class: `chip chip-schalter${weg ? ' chip-aus' : ' ist-an'}`,
            title: weg ? `${t} wieder aufnehmen` : `${t} für diese Reise abwählen`,
            onclick: () => {
              entwurf.entfernte_tags = weg
                ? entwurf.entfernte_tags.filter((x) => x !== t)
                : [...entwurf.entfernte_tags, t];
              aktualisiere();
            },
          },
          weg ? `↺ ${t}` : `${t} ×`
        );
      })
    );

    // Die tatsächlich wirksame Tag-Menge — der Input der Engine
    wirksamAnzeige.replaceChildren(
      ...[...tripTags(entwurf)].sort().map((t) => h('span', { class: 'chip chip-ruhig' }, t))
    );
  }

  /* --- Speichern ---------------------------------------------------------- */

  function speichern({ undListe }) {
    entwurf.name = entwurf.name.trim();
    if (!entwurf.name) {
      aktionen.melde('Die Reise braucht einen Namen.', 'fehler');
      return aktionen.render();
    }
    if (!entwurf.von || !entwurf.bis) {
      aktionen.melde('Bitte Von- und Bis-Datum angeben — daraus kommt die Reisedauer und damit jede Menge.', 'fehler');
      return aktionen.render();
    }
    if (reisetage(entwurf.von, entwurf.bis) === 0) {
      aktionen.melde('Das Bis-Datum liegt vor dem Von-Datum.', 'fehler');
      return aktionen.render();
    }

    // Cruft wegräumen: gestrichene Tags, die gar nicht mehr abgeleitet werden.
    // `Allgemein` fällt raus — es ist nicht abwählbar.
    const nochAbgeleitet = abgeleiteteTags(entwurf);
    entwurf.entfernte_tags = entwurf.entfernte_tags.filter((t) => t !== BASIS_TAG && nochAbgeleitet.has(t));

    let reise;
    if (entwurf.id) {
      reise = aktionen.aktualisiereReise(entwurf.id, entwurf);
    } else {
      reise = aktionen.legeReiseAn(entwurf);
      entwurf.id = reise.id;
    }

    if (undListe) {
      aktionen.setzePackliste(reise.id, erzeugePackliste(katalog, reise));
      aktionen.melde(`Liste für „${reise.name}" erzeugt.`, 'ok');
      return aktionen.gehe(`/liste/${reise.id}`);
    }

    aktionen.melde(`„${reise.name}" gespeichert.`, 'ok');
    aktionen.gehe('/');
  }

  /* --- Aufbau ------------------------------------------------------------- */

  const formular = h(
    'form',
    {
      class: 'stapel',
      onsubmit: (e) => {
        e.preventDefault();
        speichern({ undListe: false });
      },
    },

    karte(
      'Reise',
      feld(
        'Name der Reise',
        h('input', {
          type: 'text',
          value: entwurf.name,
          placeholder: 'Tauchurlaub Ägypten',
          required: true,
          oninput: (e) => (entwurf.name = e.target.value),
        })
      ),
      feld(
        'Ziel (optional)',
        h('input', { type: 'text', value: entwurf.ziel, placeholder: 'Hurghada', oninput: (e) => (entwurf.ziel = e.target.value) })
      ),
      h(
        'div',
        { class: 'zeile' },
        feld('Von', h('input', { type: 'date', value: entwurf.von, required: true, oninput: (e) => { entwurf.von = e.target.value; aktualisiere(); } })),
        feld('Bis', h('input', { type: 'date', value: entwurf.bis, required: true, oninput: (e) => { entwurf.bis = e.target.value; aktualisiere(); } }))
      ),
      h('p', { class: 'feld-hinweis' }, 'Reisedauer: ', tageAnzeige)
    ),

    karte(
      'Basis',
      basisAnzeige,
      h(
        'p',
        { class: 'feld-hinweis' },
        `„${BASIS_TAG}" ist immer dabei und lässt sich nicht abwählen. Die Reiseapotheke hängt an ihrer eigenen Kategorie Medizin — ohne diesen Schalter kommen die Medikamente nicht mit.`
      )
    ),

    karte('Saison', saisonAnzeige),

    karte(
      'Aktivitäten',
      h('p', { class: 'feld-hinweis' }, 'Antippen zum An- und Abwählen. Unbekanntes einfach eintippen.'),
      aktivitaetAnzeige,
      freitextFeld('Neue Aktivität …', (t) => {
        if (!entwurf.aktivitaeten.includes(t)) entwurf.aktivitaeten.push(t);
      })
    ),

    karte(
      'Verkehrsmittel',
      verkehrsAnzeige,
      h('p', { class: 'feld-hinweis' }, 'Kein Regelwerk — ein Tag wie jeder andere (O7). Wer mit dem Auto fährt, bekommt die Flugzeug-Items nicht.')
    ),

    karte(
      'Unterkunft',
      unterkunftAnzeige,
      h('p', { class: 'feld-hinweis' }, 'Im Hotel gibt es Handtuch und Föhn — Handtuch und Föhn tragen dieses Tag deshalb einfach nicht.')
    ),

    karte(
      'Abgeleitete Tags',
      h(
        'p',
        { class: 'feld-hinweis' },
        `Das kommt aus deinen Angaben. Antippen streicht einen Tag für diese Reise; mit ↺ holst du ihn zurück. „${BASIS_TAG}" steht hier nicht — es ist nicht abwählbar.`
      ),
      abgeleitetAnzeige,
      h('h3', { class: 'unter-titel' }, 'Zusätzliche Tags'),
      zusatzAnzeige,
      freitextFeld('Eigener Tag, z. B. Tropen …', (t) => {
        if (!entwurf.zusatz_tags.includes(t)) entwurf.zusatz_tags.push(t);
      })
    ),

    karte(
      'Was die App daraus liest',
      wirksamAnzeige,
      h('p', { class: 'feld-hinweis' }, `„${BASIS_TAG}" ist immer dabei — das Fundament, auf dem alles andere aufsetzt.`)
    ),

    h(
      'div',
      { class: 'knopf-reihe klebrig' },
      h('button', { type: 'submit', class: 'knopf' }, 'Speichern'),
      h(
        'button',
        { type: 'button', class: 'knopf knopf-haupt', onclick: () => speichern({ undListe: true }) },
        hatListe ? 'Liste neu erzeugen' : 'Liste erzeugen'
      ),
      h('a', { class: 'knopf knopf-leise', href: '#/' }, 'Abbrechen')
    ),

    hatListe
      ? meldung('Für diese Reise gibt es schon eine Liste. „Liste neu erzeugen" verwirft die Häkchen und alle Nachjustierungen dieser Reise.', 'warnung')
      : null
  );

  const datalist = h(
    'datalist',
    { id: 'tag-vorschlaege' },
    ...[...new Set([...AKTIVITAETEN, 'Regen', 'Tropen', 'Übergangszeit'])]
      .sort((a, b) => a.localeCompare(b, 'de'))
      .map((t) => h('option', { value: t }))
  );

  aktualisiere();

  return h('div', { class: 'stapel' }, h('h1', {}, vorhandene ? 'Reise bearbeiten' : 'Neue Reise'), formular, datalist);
}
