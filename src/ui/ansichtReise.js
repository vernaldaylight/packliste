/**
 * ansichtReise.js — das Reise-Formular (US-03, F3, F5, F9).
 *
 * Sechs Felder, mehr braucht eine Reise nicht. Alles Weitere fällt ab:
 * die Reisetage aus dem Zeitraum, die Tags aus Saison/Aktivitäten/
 * Verkehrsmittel/Unterkunft.
 *
 * Die abgeleiteten Tags sind sichtbar und einzeln entfernbar (US-03). Entfernte
 * Tags landen in `entfernte_tags` und lassen sich von dort wieder aufnehmen —
 * ohne diese Gegenbuchse wäre ein abgeleiteter Tag nur durch Leeren des ganzen
 * Feldes loszuwerden (siehe engine.js, tripTags). Ausnahme ist `Allgemein`: es
 * ist das Fundament jeder Reise, steht in der Reihe der abgeleiteten Tags und
 * lässt sich nicht streichen.
 *
 * Die Basis-Tags stehen in einer eigenen Karte. `Reiseapotheke` ist dort ein
 * normaler Schalter — die Kategorie `Medizin` hängt an ihm, nicht an `Allgemein`,
 * und ohne diese Karte wäre er im Formular gar nicht wählbar.
 *
 * Saison und Aktivitäten sind **Mehrfachauswahlen** aus dem festen Vokabular
 * der Tag-Gruppen (engine.js, TAG_GRUPPEN). Seit 1.10 wird kein Tag mehr
 * eingetippt: ein neuer Kontext gehört in den Katalog, sonst träfe er ohnehin
 * kein Item. Ein Wert außerhalb des Vokabulars kann trotzdem im Bestand stehen
 * (Altbestand oder ein zweites Gerät mit alter Version) — solche Werte kommen
 * als entfernbare Chips mit, damit sie sichtbar und löschbar bleiben.
 */

import { h, karte, feld, meldung } from './dom.js';
import {
  reisetage,
  abgeleiteteTags,
  erzeugePackliste,
  erzeugePacklisten,
  SAISONS,
  saisonListe,
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
    saison: vorhandene ? saisonListe(vorhandene.saison) : ['Sommer'],
    aktivitaeten: [...(vorhandene?.aktivitaeten ?? [])],
    verkehrsmittel: vorhandene?.verkehrsmittel ?? 'Flugzeug',
    unterkunft: vorhandene?.unterkunft ?? 'Ferienwohnung',
    zusatz_tags: [...(vorhandene?.zusatz_tags ?? [])],
    entfernte_tags: [...(vorhandene?.entfernte_tags ?? [])],
    // Wer mitfährt, ist eine Eigenschaft der Reise; das Geschlecht eine der
    // Person (PRD §4.6). Hier steht deshalb nur die Verknüpfung.
    teilnehmer: (vorhandene?.teilnehmer ?? []).map((t) => ({ ...t, aktivitaeten: [...(t.aktivitaeten ?? [])] })),
  };

  /** Ein Eintrag für jede erzeugte Liste — eine Reise kann mehrere haben. */
  const hatListe = daten.packlisten.some((p) => p.reise_id === entwurf.id);

  /* --- Container, die aktualisiere() neu füllt ---------------------------- */

  const tageAnzeige = h('strong', { class: 'wert' });
  const personenAnzeige = h('div', { class: 'person-reihe' });
  const basisAnzeige = h('div', { class: 'tag-reihe' });
  const saisonAnzeige = h('div', { class: 'tag-reihe' });
  const aktivitaetAnzeige = h('div', { class: 'tag-reihe' });
  const verkehrsAnzeige = h('div', { class: 'tag-reihe' });
  const unterkunftAnzeige = h('div', { class: 'tag-reihe' });
  const abgeleitetAnzeige = h('div', { class: 'tag-reihe' });
  const zusatzAnzeige = h('div', { class: 'tag-reihe' });

  /* --- Bausteine ---------------------------------------------------------- */

  /** Ein Schalter, genau einer aktiv (Verkehrsmittel, Unterkunft). */
  function einerAus(wert, setze, container, optionen) {
    const an = wert();
    const kenneIch = optionen.includes(an);
    container.replaceChildren(
      ...optionen.map((o) =>
        h(
          'button',
          {
            type: 'button',
            class: `chip chip-schalter${an === o ? ' ist-an' : ''}`,
            'aria-pressed': String(an === o),
            onclick: () => {
              setze(an === o ? '' : o);
              aktualisiere();
            },
          },
          o
        )
      ),
      // Ein Wert außerhalb des Vokabulars — Altbestand oder ein zweites Gerät mit
      // alter Version — bleibt als entfernbarer Chip sichtbar, wie in `mehrereAus`.
      ...(an && !kenneIch
        ? [entfernbarerChip(an, () => { setze(''); aktualisiere(); })]
        : []),
      // Abwählen ist ausdrücklich möglich: ohne Verkehrsmittel/Unterkunft bleibt
      // es bei Allgemein. Beim Altbestand erledigt das der ×-Knopf am Chip.
      ...(an === ''
        ? [h('span', { class: 'klein' }, '— keiner gewählt')]
        : kenneIch
          ? [h('button', { type: 'button', class: 'chip chip-leise', onclick: () => { setze(''); aktualisiere(); } }, 'abwählen')]
          : [])
    );
  }

  /**
   * Mehrere Schalter, die gleichzeitig an sein dürfen (Saison, Aktivitäten).
   *
   * `lies()` gibt die aktuelle Liste, `setze()` die nächste. Werte, die nicht
   * im Vokabular stehen, kommen als entfernbare Chips dazu: seit 1.10 kann man
   * keine Tags mehr eintippen, aber ein Altbestand (oder ein zweites Gerät mit
   * alter Version) kann sie tragen — ohne diese Chips wären sie unsichtbar und
   * unlöschbar.
   */
  function mehrereAus(lies, setze, container, optionen, { zusatzChips = [], leerHinweis = null } = {}) {
    const an = lies();
    container.replaceChildren(
      ...optionen.map((o) =>
        h(
          'button',
          {
            type: 'button',
            class: `chip chip-schalter${an.includes(o) ? ' ist-an' : ''}`,
            'aria-pressed': String(an.includes(o)),
            onclick: () => {
              setze(an.includes(o) ? an.filter((x) => x !== o) : [...an, o]);
              aktualisiere();
            },
          },
          o
        )
      ),
      ...zusatzChips,
      ...(leerHinweis && an.length === 0 ? [h('span', { class: 'klein' }, leerHinweis)] : [])
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

  /** Freitext-Feld zum Anlegen einer Person. Enter fügt hinzu. */
  function freitextFeld(platzhalter, onNeu) {
    const eingabe = h('input', { type: 'text', placeholder: platzhalter });
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

    // Saison ist eine Mehrfachauswahl: Winter + Regen ist ein normaler Fall.
    // Ohne Saison-Tag bleibt es bei Allgemein, deshalb der Leerhinweis.
    mehrereAus(() => entwurf.saison, (v) => (entwurf.saison = v), saisonAnzeige, SAISONS, {
      leerHinweis: '— keiner gewählt',
    });
    einerAus(() => entwurf.verkehrsmittel, (v) => (entwurf.verkehrsmittel = v), verkehrsAnzeige, VERKEHRSMITTEL);
    einerAus(() => entwurf.unterkunft, (v) => (entwurf.unterkunft = v), unterkunftAnzeige, UNTERKUNFT);

    // Aktivitäten: bekannte als Schalter, unbekannte als eigener Chip
    const unbekannt = entwurf.aktivitaeten.filter((t) => !AKTIVITAETEN.includes(t));
    mehrereAus(() => entwurf.aktivitaeten, (v) => (entwurf.aktivitaeten = v), aktivitaetAnzeige, AKTIVITAETEN, {
      zusatzChips: unbekannt.map((t) =>
        entfernbarerChip(t, () => {
          entwurf.aktivitaeten = entwurf.aktivitaeten.filter((x) => x !== t);
          aktualisiere();
        })
      ),
    });

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

    // Abgeleitete Tags: sichtbar, einzeln entfernbar (US-03). Allgemein steht
    // daneben, ist aber immer dabei und lässt sich nicht abwählen.
    const abgeleitet = [...abgeleiteteTags(entwurf)].sort();
    abgeleitetAnzeige.replaceChildren(
      h('span', { class: 'chip chip-ruhig' }, BASIS_TAG),
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

    zeichnePersonen();
  }

  /* --- Personen (PRD §4.6) ------------------------------------------------ */

  /**
   * Wer mitfährt: je Teilnehmer eine Zeile mit Name, Geschlecht und den
   * Aktivitäten, die **nur diese Person** hat.
   *
   * Das Geschlecht schreibt in das globale Register (`daten.personen`), die
   * Aktivitäten in `entwurf.teilnehmer` — sie gehören zu dieser Reise. Beides
   * wird erst beim Speichern festgeschrieben; die Ansicht arbeitet auf Kopien.
   */
  function zeichnePersonen() {
    const bekannt = daten.personen.filter((p) => !entwurf.teilnehmer.some((t) => t.person_id === p.id));

    const zeilen = entwurf.teilnehmer.map((t) => {
      const person = daten.personen.find((p) => p.id === t.person_id);
      if (!person) return null;

      const geschlecht = ['weiblich', 'maennlich', ''].map((g) =>
        h(
          'button',
          {
            type: 'button',
            class: `chip chip-schalter${(person.geschlecht ?? '') === g ? ' ist-an' : ''}`,
            'aria-pressed': String((person.geschlecht ?? '') === g),
            onclick: () => {
              aktionen.aktualisierePerson(person.id, { geschlecht: g });
              aktualisiere();
            },
          },
          g || 'ohne Angabe'
        )
      );

      // Nur die Aktivitäten, die diese Person von der Reise unterscheiden.
      const eigene = t.aktivitaeten.filter((a) => !AKTIVITAETEN.includes(a));
      const aktivitaeten = h('div', { class: 'tag-reihe' });
      mehrereAus(() => t.aktivitaeten, (v) => (t.aktivitaeten = v), aktivitaeten, AKTIVITAETEN, {
        zusatzChips: eigene.map((a) =>
          entfernbarerChip(a, () => {
            t.aktivitaeten = t.aktivitaeten.filter((x) => x !== a);
            aktualisiere();
          })
        ),
      });

      return h(
        'div',
        { class: 'person-zeile' },
        h(
          'div',
          { class: 'kopf-reihe' },
          h('input', {
            type: 'text',
            value: person.name,
            'aria-label': 'Name der Person',
            oninput: (e) => {
              // Ins Register, aber ohne Neuzeichnen — sonst verlöre das Feld bei
              // jedem Tastendruck den Fokus.
              aktionen.aktualisierePerson(person.id, { name: e.target.value });
            },
          }),
          h(
            'button',
            {
              type: 'button',
              class: 'knopf knopf-leise',
              onclick: () => {
                entwurf.teilnehmer = entwurf.teilnehmer.filter((x) => x.person_id !== person.id);
                aktualisiere();
              },
            },
            'Nicht dabei'
          )
        ),
        h('div', { class: 'tag-reihe' }, h('span', { class: 'klein' }, 'Geschlecht:'), ...geschlecht),
        h('div', { class: 'tag-reihe' }, h('span', { class: 'klein' }, 'Nur hier:'), aktivitaeten)
      );
    });

    const hinzufuegen =
      bekannt.length > 0
        ? h(
            'div',
            { class: 'knopf-reihe' },
            ...bekannt.map((p) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'knopf',
                  onclick: () => {
                    entwurf.teilnehmer.push({ person_id: p.id, aktivitaeten: [] });
                    aktualisiere();
                  },
                },
                `+ ${p.name}`
              )
            )
          )
        : null;

    personenAnzeige.replaceChildren(
      ...(entwurf.teilnehmer.length === 0
        ? [
            h(
              'p',
              { class: 'feld-hinweis' },
              'Ohne Personen entsteht eine Liste für die Reise als Ganzes. Mit Personen entsteht je Person eine eigene Liste — mit ihrem Geschlecht und ihren eigenen Aktivitäten.'
            ),
          ]
        : zeilen.filter(Boolean)),
      hinzufuegen
    );
  }

  /**
   * Das Feld zum Anlegen einer Person steht **neben** der Personenliste, nicht
   * darin: `zeichnePersonen` baut den Container bei jeder Änderung neu auf, und
   * ein Feld darin verlöre nach jedem Hinzufügen den Fokus.
   */
  const neuePersonFeld = freitextFeld('Neue Person …', (name) => {
    const person = aktionen.legePersonAn({ name });
    entwurf.teilnehmer.push({ person_id: person.id, aktivitaeten: [] });
  });

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
      // Eine Liste je Teilnehmer (PRD §4.6) — ohne Teilnehmer die eine Liste
      // für die Reise als Ganzes.
      const listen = erzeugePacklisten(katalog, reise, daten.personen, reise.teilnehmer);
      // Wird die Reise personenbezogen, tritt die alte Liste für „die Reise als
      // Ganzes" ab — sonst bliebe sie unerreichbar im Bestand stehen und würde
      // für immer mit synchronisiert.
      if (listen.length > 0) aktionen.loeschePackliste(reise.id, null);
      for (const liste of listen) aktionen.setzePackliste(reise.id, liste.person_id, liste);

      if (listen.length === 0) {
        aktionen.setzePackliste(reise.id, null, erzeugePackliste(katalog, reise));
        aktionen.melde(`Liste für „${reise.name}" erzeugt.`, 'ok');
        return aktionen.gehe(`/liste/${reise.id}`);
      }

      const wem = listen.length === 1 ? 'eine Liste' : `${listen.length} Listen`;
      aktionen.melde(`${wem} für „${reise.name}" erzeugt.`, 'ok');
      return aktionen.gehe(`/liste/${reise.id}/${listen[0].person_id}`);
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
      'Personen',
      h(
        'p',
        { class: 'feld-hinweis' },
        'Wer mitfährt, bekommt eine eigene Liste — und damit einen eigenen Fortschritt. Das Geschlecht und die Aktivitäten hier gelten nur für diese eine Person.'
      ),
      personenAnzeige,
      neuePersonFeld
    ),

    karte('Basis', basisAnzeige),

    karte('Saison', saisonAnzeige),

    karte(
      'Aktivitäten',
      h('p', { class: 'feld-hinweis' }, 'Antippen zum An- und Abwählen. Mehrere gleichzeitig sind möglich.'),
      aktivitaetAnzeige
    ),

    karte('Verkehrsmittel', verkehrsAnzeige),

    karte('Unterkunft', unterkunftAnzeige),

    karte(
      'Abgeleitete Tags',
      h(
        'p',
        { class: 'feld-hinweis' },
        'Das kommt aus deinen Angaben. Antippen streicht einen Tag für diese Reise; mit ↺ holst du ihn zurück.'
      ),
      abgeleitetAnzeige,
      h('h3', { class: 'unter-titel' }, 'Zusätzliche Tags'),
      zusatzAnzeige
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

  aktualisiere();

  return h('div', { class: 'stapel' }, h('h1', {}, vorhandene ? 'Reise bearbeiten' : 'Neue Reise'), formular);
}
