/**
 * engine.js — die Regel-Engine (PRD §5).
 *
 * Reine Funktionen ohne DOM und ohne Speicherzugriff: Katalog und Reise rein,
 * Auswahl und Mengen raus. Damit ist die Engine ohne eine einzige Ansicht
 * testbar (PRD §12, Woche 1).
 *
 * Auswahllogik (PRD §5.1):
 *   tripTags = {saison} ∪ aktivitaeten ∪ {verkehrsmittel} ∪ {unterkunft}
 *              ∪ zusatz_tags ∪ {"Allgemein"}   \ entfernte_tags
 *   `Allgemein` ist das Fundament und lässt sich nicht streichen — entfernte_tags
 *   kann es nicht abwählen.
 *   item überspringen, wenn item.nicht_mit ∩ tripTags ≠ ∅
 *   item aufnehmen,   wenn item.tags     ∩ tripTags ≠ ∅
 */

/* --- Feste Vokabulare ------------------------------------------------------ */

/**
 * Anzeigereihenfolge der Kategorien (PRD Anhang B.1, O9).
 * Essentials zuerst, Ausrüstung in der Mitte, Sonstiges zuletzt.
 */
export const KATEGORIEN = [
  'Dokumente & Wertsachen',
  'Kleidung',
  'Schuhe',
  'Kosmetik & Pflege',
  'Medizin',
  'Technik',
  'Tauchausrüstung',
  'Campingausrüstung',
  'Taschen & Ordnung',
  'Verpflegung',
  'Haushalt & Sonstiges',
];

/**
 * Kontext-Tags, gruppiert für die Darstellung im Formular (PRD Anhang B.2, O10).
 * Gespeichert wird flach — die Gruppe ist reine Darstellung und ändert das
 * Datenmodell nicht.
 */
export const TAG_GRUPPEN = [
  { gruppe: 'Basis', tags: ['Allgemein', 'Reiseapotheke'] },
  { gruppe: 'Klima / Saison', tags: ['Winter', 'Sommer', 'Übergangszeit', 'Regen'] },
  { gruppe: 'Verkehrsmittel', tags: ['Flugzeug', 'Auto', 'Zug'] },
  {
    gruppe: 'Aktivität',
    tags: ['Tauchen', 'Festival', 'Wandern', 'Strand', 'Ski', 'Städtetrip', 'Arbeit', 'Fotografie', 'UW-Fotografie'],
  },
  { gruppe: 'Unterkunft', tags: ['Camping', 'Ferienwohnung', 'Hotel', 'Hostel', 'Freunde'] },
];

/** Alle bekannten Tags, flach — für Vorschlagslisten und Freitext-Prüfung. */
export const BEKANNTE_TAGS = TAG_GRUPPEN.flatMap((g) => g.tags);

/** Das Fundament jeder Reise (PRD §5.1): ohne diesen Tag gäbe es keine Zahnbürste. */
export const BASIS_TAG = 'Allgemein';

/** Die Basis-Tags (PRD Anhang B.2). */
export const BASIS_TAGS = TAG_GRUPPEN.find((g) => g.gruppe === 'Basis').tags;

/**
 * Der einzige Basis-Tag, den das Formular zur Wahl stellt. `Allgemein` ist immer
 * dabei und wird nicht als Schalter gezeigt — die Reiseapotheke dagegen schon.
 */
export const WAHLBARE_BASIS_TAGS = BASIS_TAGS.filter((t) => t !== BASIS_TAG);

export const SAISONS = ['Winter', 'Sommer', 'Übergangszeit'];
export const VERKEHRSMITTEL = ['Flugzeug', 'Auto', 'Zug'];
export const UNTERKUNFT = ['Camping', 'Ferienwohnung', 'Hotel', 'Hostel', 'Freunde'];

/**
 * Aktivitäten ohne die Unterkunft-Tags — die stehen im Formular in einem
 * eigenen Feld und dürfen dort nicht doppelt als Vorschlag auftauchen.
 */
export const AKTIVITAETEN = TAG_GRUPPEN.find((g) => g.gruppe === 'Aktivität').tags;

/**
 * Personen-Tags — ein **eigenes Vokabular**, bewusst nicht in `TAG_GRUPPEN`.
 *
 * Das Geschlecht einer Person wirkt als gewöhnlicher Katalog-Tag: `Binden` trägt
 * `Damen`, `Badehose` `Herren`. Weil diese Liste nicht in `TAG_GRUPPEN` steht,
 * taucht sie in keinem Chip und keiner Vorschlagsliste des Reise-Formulars auf —
 * ein Geschlecht gehört zu einer Person, nicht zu einer Reise.
 *
 * Wichtig bei der Katalogpflege: ein `Damen`/`Herren`-Item darf `Allgemein`
 * **nicht** tragen, sonst kommt es über das Fundament für alle mit.
 */
export const PERSON_TAGS = ['Damen', 'Herren'];

/** Zuordnung Geschlecht -> Tag. Leer heißt: kein Tag, die Person wirkt neutral. */
export const GESCHLECHT_TAGS = { weiblich: 'Damen', maennlich: 'Herren' };

/* --- Reisedauer ------------------------------------------------------------ */

/**
 * Reisetage aus dem Zeitraum (PRD §4.3).
 *
 * Gezählt werden Kalendertage einschließlich beider Enden: der 01.08. bis zum
 * 10.08. sind 10 Reisetage, nicht 9. Das ist die Zahl, die man beim Packen
 * meint, und sie ist die Grundlage der Mengenformel (PRD §4.2).
 *
 * Gerechnet wird in UTC, damit Sommerzeitwechsel die Zahl nicht um eins
 * verschieben.
 *
 * @returns {number} Reisetage, oder 0 wenn der Zeitraum unvollständig/verkehrt ist
 */
export function reisetage(von, bis) {
  const a = tagAlsZahl(von);
  const b = tagAlsZahl(bis);
  if (a === null || b === null || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

function tagAlsZahl(iso) {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [, j, mo, t] = m;
  const ms = Date.UTC(Number(j), Number(mo) - 1, Number(t));
  return Number.isNaN(ms) ? null : ms;
}

/* --- Mengenregel (PRD §4.2) ------------------------------------------------ */

/**
 * Drei Varianten, mehr braucht es nicht:
 *   { art: 'einmal' }                              -> immer 1
 *   { art: 'fest', n }                             -> genau n
 *   { art: 'pro_tage', n, pro_tage, max }          -> min(ceil(tage/pro_tage)*n, max)
 *
 * Verbrauchsmaterial (Sonnencreme, Shampoo) nutzt `fest`: eine Packung reicht
 * für eine Reise, Verbrauch wird nicht pro Tag hochgerechnet (O6).
 *
 * @returns {number} Stückzahl, immer ≥ 1
 */
export function mengeFuer(regel, tage) {
  if (!regel || typeof regel !== 'object') return 1;

  switch (regel.art) {
    case 'fest':
      return Math.max(1, Math.trunc(regel.n) || 1);

    case 'pro_tage': {
      const proTage = Math.max(1, Math.trunc(regel.pro_tage) || 1);
      const n = Math.max(1, Math.trunc(regel.n) || 1);
      let menge = Math.ceil(Math.max(1, tage) / proTage) * n;
      if (Number.isFinite(regel.max) && regel.max > 0) {
        menge = Math.min(menge, Math.trunc(regel.max));
      }
      return Math.max(1, menge);
    }

    case 'einmal':
    default:
      return 1;
  }
}

/** Kurzbeschreibung einer Mengenregel für die Katalogansicht. */
export function regelText(regel) {
  switch (regel?.art) {
    case 'fest':
      return `${regel.n}×`;
    case 'pro_tage': {
      const teile = [`${regel.n} pro ${regel.pro_tage} Tage`];
      if (Number.isFinite(regel.max) && regel.max > 0) teile.push(`max ${regel.max}`);
      return teile.join(', ');
    }
    case 'einmal':
      return 'einmal';
    default:
      return '—';
  }
}

/* --- Tag-Ableitung (PRD §4.3) ---------------------------------------------- */

/**
 * Die abgeleiteten Reise-Tags.
 *
 * `entfernte_tags` ist die Gegenbuchse zu `zusatz_tags`: das Formular zeigt die
 * abgeleiteten Tags und lässt einzelne davon streichen (US-03). Ohne diese
 * Liste ließe sich ein abgeleiteter Tag nicht wieder loswerden, ohne das ganze
 * Feld zu leeren.
 *
 * @returns {Set<string>}
 */
export function tripTags(reise) {
  const tags = new Set([BASIS_TAG]);

  if (reise?.saison) tags.add(reise.saison);
  for (const t of reise?.aktivitaeten ?? []) if (t) tags.add(t);
  if (reise?.verkehrsmittel) tags.add(reise.verkehrsmittel);
  if (reise?.unterkunft) tags.add(reise.unterkunft);
  for (const t of reise?.zusatz_tags ?? []) if (t) tags.add(t);

  // `Allgemein` ist nicht abwählbar: es bleibt, auch wenn es in entfernte_tags steht.
  for (const t of reise?.entfernte_tags ?? []) if (t !== BASIS_TAG) tags.delete(t);

  return tags;
}

/**
 * Die Tags, die das Formular als "abgeleitet" anzeigt: alles aus den festen
 * Feldern, ohne die frei eingetippten Zusatz-Tags. Nur diese lassen sich
 * streichen — die Zusatz-Tags entfernt man, indem man sie löscht.
 */
export function abgeleiteteTags(reise) {
  const tags = new Set();
  if (reise?.saison) tags.add(reise.saison);
  for (const t of reise?.aktivitaeten ?? []) if (t) tags.add(t);
  if (reise?.verkehrsmittel) tags.add(reise.verkehrsmittel);
  if (reise?.unterkunft) tags.add(reise.unterkunft);
  tags.add(BASIS_TAG);
  return tags;
}

/* --- Personen (PRD §4.6) --------------------------------------------------- */

/** Die Tags, die eine Person von sich aus mitbringt — heute nur ihr Geschlecht. */
export function personTags(person) {
  const tag = GESCHLECHT_TAGS[person?.geschlecht];
  return new Set(tag ? [tag] : []);
}

/**
 * Wie `tripTags`, aber für genau **eine** Person:
 *
 *   tripTags(reise) ∪ teilnehmer.aktivitaeten ∪ personTags(person)
 *
 * Personen-Aktivitäten kommen **nach** `entfernte_tags` dazu und gewinnen damit:
 * sie sind die ausdrückliche Angabe dieser Person, ein Streichen der Reise gilt
 * für sie nicht.
 *
 * @param {object} reise
 * @param {{aktivitaeten?: string[]}} teilnehmer — der Eintrag dieser Person an dieser Reise
 * @param {{geschlecht?: string}} person
 * @returns {Set<string>}
 */
export function tripTagsFuerPerson(reise, teilnehmer, person) {
  const tags = tripTags(reise);
  for (const t of teilnehmer?.aktivitaeten ?? []) if (t) tags.add(t);
  for (const t of personTags(person)) tags.add(t);
  return tags;
}

/* --- Auswahl (PRD §5.1) ---------------------------------------------------- */

/**
 * Trifft die Auswahl für ein einzelnes Item.
 * Der Ausschluss hat Vorrang vor den positiven Tags (PRD §5.3).
 */
export function passtZuReise(item, tags) {
  if (item?.nicht_mit?.some((t) => tags.has(t))) return false;
  return Boolean(item?.tags?.some((t) => tags.has(t)));
}

/**
 * Erzeugt die Packliste als Momentaufnahme (PRD §4.4, O5).
 *
 * Bewusst materialisiert und nicht live berechnet: Overrides (US-05) und
 * Häkchen (US-06) würden sonst bei jedem Render verloren gehen.
 *
 * Ohne `person` ist das die eine Liste einer Ein-Personen-Reise (Altverhalten).
 * Mit `person` kommen deren Geschlechts-Tag und ihre eigenen Aktivitäten dazu —
 * eine Reise mit zwei Personen ergibt so zwei Listen (PRD §4.6).
 *
 * @param {{items: Array}} katalog
 * @param {object} reise
 * @param {{person?: object, teilnehmer?: object}} [optionen]
 * @returns {{reise_id: string, person_id: string|null, erzeugt_am: string, positionen: Array}}
 */
export function erzeugePackliste(katalog, reise, { person = null, teilnehmer = null } = {}) {
  const tags = person ? tripTagsFuerPerson(reise, teilnehmer, person) : tripTags(reise);
  const tage = reisetage(reise?.von, reise?.bis);

  const positionen = (katalog?.items ?? [])
    .filter((item) => passtZuReise(item, tags))
    .map((item) => ({
      item_id: item.id,
      menge: mengeFuer(item.menge, tage),
      gepackt: false,
      manuell_hinzugefuegt: false,
    }));

  return {
    reise_id: reise.id,
    person_id: person?.id ?? null,
    erzeugt_am: new Date().toISOString(),
    positionen,
  };
}

/**
 * Eine Reise, mehrere Personen: je Teilnehmer eine Liste.
 *
 * Teilnehmer ohne Eintrag in der Personen-Registry werden übersprungen — eine
 * gelöschte Person soll keine leere Liste hinterlassen.
 *
 * @param {Array} personen — die Registry aus `daten.personen`
 * @param {Array<{person_id: string, aktivitaeten?: string[]}>} teilnehmerListe
 */
export function erzeugePacklisten(katalog, reise, personen, teilnehmerListe) {
  return (teilnehmerListe ?? [])
    .map((t) => ({ t, person: (personen ?? []).find((p) => p.id === t.person_id) ?? null }))
    .filter(({ person }) => person)
    .map(({ person, t }) => erzeugePackliste(katalog, reise, { person, teilnehmer: t }));
}

/**
 * Eine von Hand hinzugefügte Position (US-05). Die Tags des Items dürfen
 * bewusst danebenliegen — genau dafür ist der Override da.
 */
export function neuePosition(item, tage) {
  return {
    item_id: item.id,
    menge: mengeFuer(item.menge, tage),
    gepackt: false,
    manuell_hinzugefuegt: true,
  };
}

/* --- Gruppierung für die Ausgabe (PRD §5.1) -------------------------------- */

/**
 * Bringt die Positionen in Anzeigeform: nach Kategorie gruppiert, Kategorien in
 * fester Reihenfolge, Items alphabetisch. Leere Kategorien fallen weg (US-04).
 *
 * Positionen, deren Item nicht mehr im Katalog steht, werden übersprungen —
 * das kann passieren, wenn der Katalog neu importiert wurde, während eine alte
 * Reise noch existiert. Die Position bleibt in der Packliste erhalten.
 *
 * @returns {Array<{kategorie: string, positionen: Array}>}
 */
export function gruppiere(katalog, positionen) {
  const nachId = new Map((katalog?.items ?? []).map((i) => [i.id, i]));
  const eimer = new Map();

  for (const pos of positionen ?? []) {
    const item = nachId.get(pos.item_id);
    if (!item) continue;
    const kategorie = item.kategorie || 'Sonstiges';
    if (!eimer.has(kategorie)) eimer.set(kategorie, []);
    eimer.get(kategorie).push({ ...pos, item });
  }

  const rang = (k) => {
    const i = KATEGORIEN.indexOf(k);
    return i === -1 ? KATEGORIEN.length : i;
  };

  return [...eimer.entries()]
    .sort((a, b) => rang(a[0]) - rang(b[0]) || a[0].localeCompare(b[0], 'de'))
    .map(([kategorie, liste]) => ({
      kategorie,
      positionen: liste.sort((a, b) => a.item.name.localeCompare(b.item.name, 'de')),
    }));
}

/* --- Fortschritt (US-06) --------------------------------------------------- */

export function fortschritt(positionen) {
  const gesamt = positionen?.length ?? 0;
  const gepackt = (positionen ?? []).filter((p) => p.gepackt).length;
  return { gepackt, gesamt, anteil: gesamt === 0 ? 0 : gepackt / gesamt };
}

/* --- Markdown-Ausgabe (F10, US-07) ----------------------------------------- */

/**
 * Markdown-Checkliste. Gruppierung und Mengen bleiben erhalten (US-07).
 *
 * Mit `person` wandert der Personenname in Titel und Kopfzeile — sonst sähen
 * zwei Listen derselben Reise als Datei gleich aus.
 *
 * @param {boolean} nurUngepackte — nur offene Positionen ausgeben
 * @param {{name?: string}|null} person
 */
export function alsMarkdown(katalog, reise, positionen, nurUngepackte = false, person = null) {
  const tage = reisetage(reise?.von, reise?.bis);
  const titel = `${reise?.name || 'Reise'}${person?.name ? ` — ${person.name}` : ''}`;
  const zeilen = [`# Packliste — ${titel}`, ''];

  const kopf = [
    tage > 0 ? `${tage} Tage` : null,
    reise?.ziel || null,
    person?.name || null,
    reise?.saison || null,
    (reise?.aktivitaeten ?? []).join(', ') || null,
    reise?.verkehrsmittel || null,
    reise?.unterkunft || null,
  ].filter(Boolean);
  if (kopf.length) zeilen.push(kopf.join(' · '), '');

  const gruppen = gruppiere(katalog, positionen);
  const { gepackt, gesamt } = fortschritt(positionen);
  zeilen.push(`${gepackt} von ${gesamt} gepackt`, '');

  let leer = true;
  for (const g of gruppen) {
    const offen = nurUngepackte ? g.positionen.filter((p) => !p.gepackt) : g.positionen;
    if (offen.length === 0) continue;
    leer = false;
    zeilen.push(`## ${g.kategorie}`);
    for (const p of offen) {
      const menge = p.menge > 1 ? ` (${p.menge}×)` : '';
      const haken = p.gepackt ? 'x' : ' ';
      const zusatz = p.manuell_hinzugefuegt ? ' — von Hand ergänzt' : '';
      zeilen.push(`- [${haken}] ${p.item.name}${menge}${zusatz}`);
    }
    zeilen.push('');
  }

  if (leer) zeilen.push('_Nichts zu packen — keine Position auf der Liste._', '');
  return zeilen.join('\n');
}
