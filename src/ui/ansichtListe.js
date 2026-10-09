/**
 * ansichtListe.js — die fertige Packliste (US-04 bis US-07).
 *
 * Die Liste ist eine Momentaufnahme (O5): sie wird beim Erzeugen
 * materialisiert, damit Nachjustieren (US-05) und Abhaken (US-06) nicht bei
 * jedem Render verloren gehen. Jede Änderung hier schreibt in die Packliste —
 * der Katalog bleibt unangetastet (US-05, letztes Kriterium).
 *
 * Eine Reise mit mehreren Teilnehmern hat **eine Liste je Person** (PRD §4.6).
 * Welche gezeigt wird, steht in der Adresse: `#/liste/:reiseId/:personId`. Die
 * alte Adresse ohne Person bleibt gültig und landet auf der ersten Person.
 * Der Fortschritt wird dadurch von selbst getrennt — jede Liste zählt ihre
 * eigenen Häkchen.
 */

import { h, karte, meldung, fmtZeitraum } from './dom.js';
import {
  gruppiere,
  fortschritt,
  reisetage,
  tripTagsFuerPerson,
  alsMarkdown,
  erzeugePackliste,
  neuePosition,
} from '../engine.js';
import { inZwischenablage, zeitstempel, findePackliste } from '../store.js';

export function ansichtListe({ katalog, daten, aktionen, reiseId, personId = null }) {
  const reise = daten.reisen.find((r) => r.id === reiseId) ?? null;
  if (!reise) {
    return h(
      'div',
      {},
      meldung('Diese Reise gibt es nicht mehr.', 'fehler'),
      h('a', { class: 'knopf', href: '#/' }, 'Zurück zur Übersicht')
    );
  }

  /**
   * Die Teilnehmer dieser Reise, aufgelöst gegen das Personen-Register.
   * Teilnehmer ohne Person fallen weg — eine gelöschte Person soll hier keinen
   * leeren Eintrag hinterlassen.
   */
  const teilnehmer = [];
  for (const t of reise.teilnehmer ?? []) {
    const person = daten.personen.find((p) => p.id === t.person_id);
    if (person) teilnehmer.push({ t, person });
  }

  /**
   * Welche Person ist gemeint? Ohne Angabe (oder mit einer, die nicht mehr
   * dabei ist) die erste — so führt `#/liste/:reiseId` genau dorthin, wo man
   * vor dem Personen-Feature gelandet wäre.
   */
  let aktiv = teilnehmer.find(({ person }) => person.id === personId) ?? teilnehmer[0] ?? null;
  const personIdAktiv = aktiv?.person.id ?? null;

  const liste = findePackliste(daten.packlisten, reiseId, personIdAktiv);
  if (!liste) {
    return h(
      'div',
      { class: 'stapel' },
      personenUmschalter(),
      h('h1', {}, reise.name),
      karte(
        'Noch keine Liste',
        h(
          'p',
          {},
          aktiv
            ? `Für ${aktiv.person.name} wurde noch nichts erzeugt. Die Auswahl folgt aus den Tags der Reise, den Aktivitäten dieser Person und ihren Items.`
            : 'Für diese Reise wurde noch nichts erzeugt. Die Auswahl folgt aus den Tags der Reise und den Tags der Items.'
        ),
        h(
          'button',
          {
            class: 'knopf knopf-haupt',
            onclick: () => {
              aktionen.setzePackliste(reise.id, personIdAktiv, erzeugePackliste(katalog, reise, aktiv ?? {}));
              aktionen.melde('Liste erzeugt.', 'ok');
              aktionen.render();
            },
          },
          'Liste erzeugen'
        )
      )
    );
  }

  const tage = reisetage(reise.von, reise.bis);
  let nurUngepackte = false;

  const kopfBereich = h('div', { class: 'stapel' });
  const gruppenBereich = h('div', { class: 'stapel' });

  /** Schreibt die geänderte Packliste weg und zeichnet den Bestand neu. */
  function sichern() {
    aktionen.setzePackliste(reise.id, personIdAktiv, liste);
    zeichneKopf();
    zeichneGruppen();
    hinzu.aktualisiereTreffer();
  }

  /**
   * Die Personen als Schalter — nur wenn es mehr als eine gibt. Bei einer
   * einzigen Person wäre der Schalter eine Zeile ohne Wahl.
   */
  function personenUmschalter() {
    if (teilnehmer.length < 2) return null;
    return h(
      'div',
      { class: 'person-umschalter' },
      ...teilnehmer.map(({ person }) =>
        h(
          'a',
          {
            class: `chip chip-schalter${person.id === personIdAktiv ? ' ist-an' : ''}`,
            href: `#/liste/${reise.id}/${person.id}`,
            'aria-current': person.id === personIdAktiv ? 'true' : null,
          },
          person.name
        )
      )
    );
  }

  function zeichneKopf() {
    const s = fortschritt(liste.positionen);
    kopfBereich.replaceChildren(
      personenUmschalter(),
      h('h1', {}, reise.name),
      aktiv
        ? h('p', { class: 'klein' }, `Liste für ${aktiv.person.name}${geschlechtText(aktiv.person)}`)
        : null,
      h('p', { class: 'klein' }, fmtZeitraum(reise.von, reise.bis, tage), reise.ziel ? ` · ${reise.ziel}` : ''),
      h(
        'p',
        { class: 'tag-reihe' },
        ...[...tripTagsFuerPerson(reise, aktiv?.t, aktiv?.person)].sort().map((t) => h('span', { class: 'chip chip-ruhig' }, t))
      ),
      h(
        'div',
        { class: 'fortschritt' },
        h('div', { class: 'fortschritt-balken' }, h('div', { class: 'fortschritt-fuell', style: `width:${Math.round(s.anteil * 100)}%` })),
        h(
          'p',
          { class: 'klein' },
          s.gesamt === 0 ? 'Keine Position auf der Liste.' : `${s.gepackt} von ${s.gesamt} gepackt · ${Math.round(s.anteil * 100)} %`
        )
      )
    );
  }

  function zeichneGruppen() {
    const gruppen = gruppiere(katalog, liste.positionen);
    const sichtbar = nurUngepackte
      ? gruppen.map((g) => ({ ...g, positionen: g.positionen.filter((p) => !p.gepackt) })).filter((g) => g.positionen.length)
      : gruppen;

    // gruppiere() liefert Kopien der Positionen (es hängt nur das Item an).
    // Geändert werden muss das Original in liste.positionen — sonst ist jedes
    // Häkchen und jede Menge beim nächsten Zeichnen wieder weg.
    const original = new Map(liste.positionen.map((p) => [p.item_id, p]));

    gruppenBereich.replaceChildren(
      ...(sichtbar.length === 0
        ? [
            karte(
              'Nichts zu packen',
              h('p', {}, 'Für die Tags dieser Reise passt kein Item im Katalog. Unten kannst du welche von Hand hinzufügen.')
            ),
          ]
        : sichtbar.map((g) =>
            karte(
              h(
                'span',
                { class: 'kategorie-titel' },
                g.kategorie,
                h('span', { class: 'zaehler' }, `${g.positionen.filter((p) => p.gepackt).length}/${g.positionen.length}`)
              ),
              h('ul', { class: 'pos-liste' }, ...g.positionen.map((p) => zeile(p, original)))
            )
          )),

      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          { class: `knopf${nurUngepackte ? ' ist-an' : ''}`, onclick: () => { nurUngepackte = !nurUngepackte; zeichneGruppen(); } },
          nurUngepackte ? '✓ nur Ungepackte' : 'nur Ungepackte'
        ),
        h('button', { class: 'knopf', onclick: () => kopiere(false) }, 'Markdown kopieren'),
        h('button', { class: 'knopf', onclick: () => kopiere(true) }, 'Nur Offene kopieren'),
        h('button', { class: 'knopf', onclick: teileMarkdown }, 'Markdown teilen'),
        h('a', { class: 'knopf knopf-leise', href: `#/reise/${reise.id}` }, 'Reise bearbeiten'),
        h('a', { class: 'knopf knopf-leise', href: `#/retro/${reise.id}` }, 'Retro')
      ),

      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          {
            class: 'knopf knopf-gefahr',
            onclick: () => {
              const wem = aktiv ? ` von ${aktiv.person.name}` : ' dieser Reise';
              if (!confirm(`Die Liste${wem} neu erzeugen? Häkchen und alle Nachjustierungen gehen verloren.`)) return;
              aktionen.setzePackliste(reise.id, personIdAktiv, erzeugePackliste(katalog, reise, aktiv ?? {}));
              aktionen.melde('Liste neu erzeugt.', 'ok');
              aktionen.render();
            },
          },
          'Liste neu erzeugen'
        )
      )
    );
  }

  /* --- Eine Position (US-05, US-06) --------------------------------------- */

  function zeile(pos, original) {
    const { item } = pos;
    // Die Position, die wirklich in der Liste steht (siehe zeichneGruppen).
    const echt = original.get(pos.item_id) ?? pos;

    const haken = h('input', {
      type: 'checkbox',
      class: 'haken',
      checked: pos.gepackt,
      'aria-label': `${item.name} gepackt`,
      onchange: (e) => {
        echt.gepackt = e.target.checked;
        sichern();
      },
    });

    const zahl = h('input', {
      type: 'number',
      class: 'menge',
      value: String(pos.menge),
      min: '1',
      step: '1',
      'aria-label': `Menge ${item.name}`,
      onchange: (e) => {
        echt.menge = Math.max(1, Math.trunc(Number(e.target.value)) || 1);
        echt.manuell_geaendert = true; // US-05: die Änderung ist als solche erkennbar
        sichern();
      },
    });

    const schritt = (d, zeichen) =>
      h(
        'button',
        {
          type: 'button',
          class: 'schritt',
          'aria-label': d > 0 ? `${item.name}: eins mehr` : `${item.name}: eins weniger`,
          onclick: () => {
            echt.menge = Math.max(1, echt.menge + d);
            echt.manuell_geaendert = true;
            sichern();
          },
        },
        zeichen
      );

    const marken = [];
    if (pos.manuell_hinzugefuegt) marken.push(h('span', { class: 'marke marke-eigen' }, 'von Hand'));
    if (pos.manuell_geaendert) marken.push(h('span', { class: 'marke marke-geaendert' }, 'Menge geändert'));
    if (item.notiz) marken.push(h('span', { class: 'marke' }, item.notiz));

    return h(
      'li',
      { class: `pos${pos.gepackt ? ' ist-gepackt' : ''}` },
      h(
        'label',
        { class: 'pos-haupt' },
        haken,
        h('span', { class: 'pos-name' }, item.name),
        marken.length ? h('span', { class: 'marken' }, ...marken) : null
      ),
      h('span', { class: 'pos-menge' }, schritt(-1, '−'), zahl, schritt(1, '+')),
      h(
        'button',
        {
          type: 'button',
          class: 'knopf knopf-leise pos-weg',
          'aria-label': `${item.name} von dieser Liste nehmen`,
          title: 'Nur von dieser Reise nehmen — der Katalog bleibt unverändert',
          onclick: () => {
            // US-05: Item entfernen, ohne den Katalog zu verändern.
            // Über die item_id, weil gruppiere() Kopien der Positionen liefert.
            const weg = pos.item_id;
            liste.positionen = liste.positionen.filter((p) => p.item_id !== weg);
            sichern();
          },
        },
        '×'
      )
    );
  }

  /* --- Hinzufügen (US-05) ------------------------------------------------- */

  /**
   * Einmal gebaut und dann nur noch aktualisiert: würde die Karte bei jedem
   * Häkchen neu entstehen, wäre die Sucheingabe nach jedem Klick wieder leer.
   */
  function hinzufuegenKarte() {
    const suchfeld = h('input', { type: 'text', placeholder: 'Item suchen …', class: 'suche' });
    // Eigene Klassen: die Trefferliste darf nicht wie die Packliste aussehen
    // und nicht mit ihr verwechselt werden.
    const treffer = h('ul', { class: 'treffer-liste' });

    function aktualisiereTreffer() {
      const aufDerListe = new Set(liste.positionen.map((p) => p.item_id));
      const q = suchfeld.value.trim().toLowerCase();
      const rest = katalog.items.filter((i) => !aufDerListe.has(i.id));
      const gefiltert = (q ? rest.filter((i) => i.name.toLowerCase().includes(q)) : rest).slice(0, 40);

      treffer.replaceChildren(
        ...(gefiltert.length === 0
          ? [h('li', { class: 'klein' }, 'Kein Item gefunden.')]
          : gefiltert.map((item) =>
              h(
                'li',
                { class: 'treffer' },
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'knopf knopf-leise pos-hinzufuegen',
                    onclick: () => {
                      // Die Tags dürfen bewusst danebenliegen — genau dafür ist der Override da.
                      liste.positionen.push(neuePosition(item, tage));
                      sichern();
                    },
                  },
                  `+ ${item.name}`
                ),
                h('span', { class: 'klein' }, item.kategorie),
                h('span', { class: 'klein' }, item.tags.join(', '))
              )
            ))
      );
    }

    suchfeld.addEventListener('input', aktualisiereTreffer);
    aktualisiereTreffer();

    const kasten = karte(
      'Position hinzufügen',
      h('p', { class: 'feld-hinweis' }, 'Auch Items, deren Tags nicht zur Reise passen. Der Katalog wird dabei nicht verändert.'),
      suchfeld,
      treffer
    );
    kasten.aktualisiereTreffer = aktualisiereTreffer;
    return kasten;
  }

  /* --- Ausgabe (US-07, F10) ---------------------------------------------- */

  async function kopiere(nurOffen) {
    const md = alsMarkdown(katalog, reise, liste.positionen, nurOffen, aktiv?.person ?? null);
    const ok = await inZwischenablage(md);
    aktionen.melde(ok ? 'Markdown in die Zwischenablage kopiert.' : 'Kopieren ging nicht — nutze „Markdown teilen".', ok ? 'ok' : 'fehler');
    aktionen.render();
  }

  async function teileMarkdown() {
    const md = alsMarkdown(katalog, reise, liste.positionen, false, aktiv?.person ?? null);
    const sauber = dateinameTeil(reise.name);
    // Der Personenname gehört in den Dateinamen: zwei Listen derselben Reise
    // würden sich sonst beim Ablegen überschreiben.
    const wem = aktiv ? `-${dateinameTeil(aktiv.person.name)}` : '';
    const dateiname = `packliste-${sauber}${wem}-${zeitstempel()}.md`;
    const ergebnis = await teileText(md, dateiname, `${reise.name}${aktiv ? ` — ${aktiv.person.name}` : ''}`, 'text/markdown');
    if (ergebnis === 'geteilt' || ergebnis === 'heruntergeladen') {
      aktionen.melde(ergebnis === 'geteilt' ? 'Markdown geteilt.' : 'Markdown als Datei gespeichert.', 'ok');
      aktionen.render();
    }
  }

  const hinzu = hinzufuegenKarte();

  zeichneKopf();
  zeichneGruppen();

  return h('div', { class: 'stapel' }, kopfBereich, gruppenBereich, hinzu);
}

/** Ein Dateiname-Baustein: Umlaute und Buchstaben bleiben, der Rest wird `-`. */
function dateinameTeil(text) {
  return (text ?? '').replace(/[^\wäöüßÄÖÜ -]/g, '').trim().replace(/\s+/g, '-') || 'reise';
}

/** „ · weiblich" — die Angabe, die über die Katalog-Auswahl entscheidet. */
function geschlechtText(person) {
  return person?.geschlecht ? ` · ${person.geschlecht}` : '';
}

/** Text teilen — Markdown ist kein JSON, deshalb ein eigener kleiner Weg. */
async function teileText(inhalt, dateiname, titel, typ) {
  const datei = new File([inhalt], dateiname, { type: typ });
  if (navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: titel });
      return 'geteilt';
    } catch (e) {
      if (e?.name === 'AbortError') return 'abgebrochen';
    }
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'heruntergeladen';
}
