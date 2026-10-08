/**
 * dom.js — winzige DOM-Helfer.
 *
 * Bewusst kein Framework (PRD Anhang C): Die Engine ist eine reine Funktion,
 * der Rest ist Formular- und Listen-Handling über fünf Ansichten.
 *
 * Alles wird als Knoten gebaut und nicht als HTML-Zeichenkette zusammengesetzt.
 * Item-Namen kommen aus der eigenen Excel und dürfen trotzdem niemals als
 * Markup interpretiert werden.
 */

/**
 * h('button', { class: 'primär', onclick: f }, 'Text')
 * Kinder dürfen Knoten, Zeichenketten, null oder verschachtelte Listen sein.
 */
export function h(tag, attrs = {}, ...kinder) {
  const el = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }

  haengeAn(el, kinder);
  return el;
}

function haengeAn(el, kinder) {
  for (const kind of kinder) {
    if (kind === null || kind === undefined || kind === false) continue;
    if (Array.isArray(kind)) haengeAn(el, kind);
    else if (kind instanceof Node) el.append(kind);
    else el.append(document.createTextNode(String(kind)));
  }
}

export function leere(el) {
  el.replaceChildren();
  return el;
}

/** Ein Abschnitt mit Überschrift — die Grundform aller Ansichten. */
export function karte(titel, ...inhalt) {
  return h(
    'section',
    { class: 'karte' },
    titel ? h('h2', { class: 'karte-titel' }, titel) : null,
    ...inhalt
  );
}

export function feld(beschriftung, eingabe, hinweis) {
  return h(
    'label',
    { class: 'feld' },
    h('span', { class: 'feld-label' }, beschriftung),
    eingabe,
    hinweis ? h('span', { class: 'feld-hinweis' }, hinweis) : null
  );
}

/**
 * Ein `<select>` aus einer Liste. `vorschlaege` füllt zusätzlich eine
 * datalist — damit ist die Auswahl eine Vorschlagsliste plus Freitext (US-03),
 * ohne dass man einen Wert eintippen muss, den es schon gibt.
 */
export function auswahl(name, optionen, aktuell, attrs = {}) {
  return h(
    'select',
    { name, ...attrs },
    ...optionen.map((o) =>
      h('option', { value: typeof o === 'string' ? o : o.wert, selected: (typeof o === 'string' ? o : o.wert) === aktuell },
        typeof o === 'string' ? o : o.text)
    )
  );
}

/**
 * Ein Knopf, der die Dateiauswahl öffnet (US-09).
 *
 * Bewusst ein echter `<input type=file>`: nur der öffnet am Handy die
 * Systemauswahl, in der iCloud Drive direkt erreichbar ist. Die File System
 * Access API gibt es in iOS-Safari nicht (PRD §3.6).
 */
export function dateiWaehler(annahme, onDatei, beschriftung, klasse = 'knopf') {
  const input = h('input', {
    type: 'file',
    accept: annahme,
    class: 'versteckt',
    onchange: async (e) => {
      const datei = e.target.files?.[0];
      e.target.value = ''; // dieselbe Datei darf erneut gewählt werden
      if (datei) await onDatei(datei);
    },
  });
  const knopf = h('button', { type: 'button', class: klasse, onclick: () => input.click() }, beschriftung);
  return h('span', { class: 'datei-waehler' }, knopf, input);
}

/** Kurze Rückmeldung oben in der Ansicht. */
export function meldung(text, art = 'info') {
  return h('div', { class: `meldung meldung-${art}`, role: art === 'fehler' ? 'alert' : 'status' }, text);
}

/** Eine Fehlerliste, wie sie die Validierung liefert (US-09). */
export function fehlerListe(fehler) {
  const sichtbar = fehler.slice(0, 8);
  return h(
    'div',
    { class: 'meldung meldung-fehler', role: 'alert' },
    h('strong', {}, 'Übernommen wurde nichts — der bestehende Bestand bleibt unangetastet.'),
    h('ul', {}, ...sichtbar.map((f) => h('li', {}, f))),
    fehler.length > sichtbar.length
      ? h('p', {}, `… und ${fehler.length - sichtbar.length} weitere.`)
      : null
  );
}

/* --- Formatierung (UI ist komplett deutsch, PRD §9) ------------------------ */

/** '2026-08-01' -> '01.08.2026' */
export function fmtDatum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** '01.08.2026 – 10.08.2026 · 10 Tage' */
export function fmtZeitraum(von, bis, tage) {
  const a = fmtDatum(von);
  const b = fmtDatum(bis);
  const zeitraum = a && b ? `${a} – ${b}` : a || b || 'kein Zeitraum';
  return tage > 0 ? `${zeitraum} · ${tage} ${tage === 1 ? 'Tag' : 'Tage'}` : zeitraum;
}
