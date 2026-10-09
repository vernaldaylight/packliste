/**
 * Tests der Regel-Engine (PRD §12, Woche 1).
 *
 * Zwei Ebenen:
 *  1. Synthetische Fälle — jede Regel der PRD einzeln, inklusive der Beispiele
 *     aus §5.2 und §4.2. Sie bringen ihren eigenen Katalog mit und laufen immer.
 *  2. Der echte Katalog — die Engine muss gegen die echten Daten laufen, nicht
 *     nur gegen Spielzeug (PRD §3.5). Er liegt seit dem Umzug in einem privaten
 *     Repo (PRD §4.5) und ist im öffentlichen Repo nicht mehr vorhanden; fehlt
 *     er, überspringen sich diese Tests selbst. Auf dem Mac mit einer lokalen
 *     Arbeitskopie laufen sie weiter.
 *
 * Lauf: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  reisetage,
  mengeFuer,
  tripTags,
  tripTagsFuerPerson,
  personTags,
  passtZuReise,
  erzeugePackliste,
  erzeugePacklisten,
  gruppiere,
  fortschritt,
  alsMarkdown,
  abgeleiteteTags,
  saisonListe,
  KATEGORIEN,
  SAISONS,
  BEKANNTE_TAGS,
  PERSON_TAGS,
  GESCHLECHT_TAGS,
} from '../src/engine.js';

const HIER = dirname(fileURLToPath(import.meta.url));

/** Der synthetische Katalog — klein genug, um jede Auswahl von Hand nachzuzählen. */
const SPIELZEUG = JSON.parse(readFileSync(resolve(HIER, 'fixtures/katalog.synthetisch.json'), 'utf8'));

/** Die zwei Personen der Tests: eine weibliche, eine männliche, mit je eigener Aktivität. */
const ANNA = { id: 'p-anna', name: 'Anna', geschlecht: 'weiblich' };
const BEN = { id: 'p-ben', name: 'Ben', geschlecht: 'maennlich' };

const REISE = {
  id: 'r-personen',
  name: 'Tauchurlaub',
  von: '2026-08-01',
  bis: '2026-08-10',
  saison: 'Sommer',
  aktivitaeten: ['Tauchen'],
  verkehrsmittel: 'Flugzeug',
  unterkunft: 'Ferienwohnung',
};

/** Die item_ids einer erzeugten Liste — für Vergleiche in Mengenform. */
const ids = (liste) => new Set(liste.positionen.map((p) => p.item_id));

/**
 * Die private Arbeitskopie, falls sie auf dieser Maschine liegt — sonst `null`,
 * statt beim Import zu werfen. Gesucht wird an beiden Stellen, an denen sie
 * vorkommt: das alte Layout im App-Repo und der Arbeitsklon des Daten-Repos
 * daneben. Fehlt sie, geben die abhängigen Tests sich selbst auf.
 */
function ladeEchtenKatalog() {
  const kandidaten = [
    resolve(HIER, '../daten/katalog.json'),
    resolve(HIER, '../../packliste-daten/katalog.json'),
  ];
  for (const pfad of kandidaten) {
    try {
      return JSON.parse(readFileSync(pfad, 'utf8'));
    } catch {
      /* nächster Kandidat */
    }
  }
  return null;
}

const katalog = ladeEchtenKatalog();
const nurMitEchtemKatalog = katalog ? false : 'keine private Arbeitskopie gefunden (Daten-Repo packliste-daten, PRD §4.5)';

/* --- Reisetage ------------------------------------------------------------- */

test('reisetage zählt beide Enden mit', () => {
  assert.equal(reisetage('2026-08-01', '2026-08-10'), 10);
  assert.equal(reisetage('2026-08-01', '2026-08-01'), 1);
});

test('reisetage über Monats- und Jahresgrenze', () => {
  assert.equal(reisetage('2026-01-30', '2026-02-02'), 4);
  assert.equal(reisetage('2026-12-30', '2027-01-02'), 4);
});

test('reisetage über die Sommerzeitumstellung bleibt exakt', () => {
  // 2026-03-29 ist die Umstellung in Europa — in UTC gerechnet darf das die
  // Tageszahl nicht verschieben.
  assert.equal(reisetage('2026-03-27', '2026-03-31'), 5);
});

test('reisetage ist 0 bei fehlendem oder verkehrtem Zeitraum', () => {
  assert.equal(reisetage('', ''), 0);
  assert.equal(reisetage('2026-08-10', '2026-08-01'), 0);
  assert.equal(reisetage(undefined, '2026-08-01'), 0);
  assert.equal(reisetage('10.08.2026', '2026-08-20'), 0);
});

/* --- Mengenregel (PRD §4.2) ------------------------------------------------ */

test('einmal ergibt immer 1', () => {
  assert.equal(mengeFuer({ art: 'einmal' }, 10), 1);
  assert.equal(mengeFuer({ art: 'einmal' }, 0), 1);
});

test('fest ergibt genau n', () => {
  assert.equal(mengeFuer({ art: 'fest', n: 2 }, 10), 2);
  assert.equal(mengeFuer({ art: 'fest', n: 1 }, 30), 1);
});

test('pro_tage folgt der Formel min(ceil(tage/pro_tage)*n, max)', () => {
  // Das Beispiel aus PRD §4.2: T-Shirt, 10 Tage, 1 pro 3, max 6 -> 4
  assert.equal(mengeFuer({ art: 'pro_tage', n: 1, pro_tage: 3, max: 6 }, 10), 4);
  // Ohne Deckel wächst es weiter
  assert.equal(mengeFuer({ art: 'pro_tage', n: 1, pro_tage: 3 }, 30), 10);
  // Der Deckel greift
  assert.equal(mengeFuer({ art: 'pro_tage', n: 1, pro_tage: 3, max: 6 }, 30), 6);
  // 2 pro 4 Tage, 10 Tage -> ceil(2.5)=3 -> 6
  assert.equal(mengeFuer({ art: 'pro_tage', n: 2, pro_tage: 4 }, 10), 6);
});

test('pro_tage liefert auch bei tage = 0 mindestens 1', () => {
  assert.equal(mengeFuer({ art: 'pro_tage', n: 1, pro_tage: 3, max: 6 }, 0), 1);
});

test('kaputte Regeln fallen auf 1 zurück, statt NaN zu erzeugen', () => {
  assert.equal(mengeFuer(undefined, 10), 1);
  assert.equal(mengeFuer({}, 10), 1);
  // fehlende Felder fallen auf 1 zurück, nicht auf NaN
  assert.equal(mengeFuer({ art: 'pro_tage' }, 10), 10); // pro_tage -> 1, n -> 1
  assert.equal(mengeFuer({ art: 'pro_tage', n: 2, pro_tage: 0 }, 10), 20); // pro_tage 0 -> 1
  assert.equal(mengeFuer({ art: 'fest' }, 10), 1);
});

/* --- Tag-Ableitung (PRD §4.3) ---------------------------------------------- */

test('tripTags ist die Vereinigung aller Quellen plus Allgemein', () => {
  const tags = tripTags({
    saison: 'Sommer',
    aktivitaeten: ['Tauchen', 'Schnorcheln'],
    verkehrsmittel: 'Flugzeug',
    unterkunft: 'Ferienwohnung',
  });
  assert.deepEqual(
    [...tags].sort(),
    ['Allgemein', 'Ferienwohnung', 'Flugzeug', 'Sommer', 'Schnorcheln', 'Tauchen'].sort()
  );
});

test('Allgemein ist auch ohne jede Angabe dabei', () => {
  assert.deepEqual([...tripTags({})], ['Allgemein']);
});

test('zusatz_tags kommen dazu, entfernte_tags fallen weg', () => {
  const tags = tripTags({ saison: 'Sommer', zusatz_tags: ['Tropen'], entfernte_tags: ['Sommer'] });
  assert.ok(tags.has('Tropen'));
  assert.ok(!tags.has('Sommer'));
});

/* --- Saison ist eine Mehrfachauswahl (1.10) -------------------------------- */

test('saisonListe: Altwert und Liste ergeben beide eine Liste', () => {
  assert.deepEqual(saisonListe('Sommer'), ['Sommer'], 'der Altwert aus dem Bestand');
  assert.deepEqual(saisonListe(['Winter', 'Regen']), ['Winter', 'Regen']);
  assert.deepEqual(saisonListe(undefined), []);
  assert.deepEqual(saisonListe(''), [], 'ein leerer String ist kein Tag');
  assert.deepEqual(saisonListe(['']), [], 'und ein leerer Eintrag auch nicht');
  assert.deepEqual(saisonListe(null), []);
});

test('Regen ist ein Saison-Tag wie Winter und Sommer (Anhang B.2)', () => {
  assert.ok(SAISONS.includes('Regen'), 'Regen steht in der Gruppe "Klima / Saison"');
  assert.deepEqual(SAISONS, ['Winter', 'Sommer', 'Übergangszeit', 'Regen']);
});

test('Winter und Regen gleichzeitig — der Kern der Mehrfachauswahl', () => {
  const tags = tripTags({ saison: ['Winter', 'Regen'] });
  assert.ok(tags.has('Winter'));
  assert.ok(tags.has('Regen'), 'Regen tritt neben die Jahreszeit, es ersetzt sie nicht');
});

test('der Altwert-String wirkt weiter wie eine Saison (Toleranz)', () => {
  assert.ok(tripTags({ saison: 'Sommer' }).has('Sommer'));
  assert.deepEqual([...tripTags({ saison: [] })], ['Allgemein'], 'ohne Saison bleibt Allgemein');
});

test('eine gestrichene Saison fällt auch aus der Liste', () => {
  const tags = tripTags({ saison: ['Winter', 'Regen'], entfernte_tags: ['Regen'] });
  assert.ok(tags.has('Winter'), 'der andere Wert bleibt');
  assert.ok(!tags.has('Regen'));
});

test('abgeleiteteTags zählt alle Saison-Werte einzeln auf', () => {
  const tags = abgeleiteteTags({ saison: ['Winter', 'Regen'] });
  assert.ok(tags.has('Winter'));
  assert.ok(tags.has('Regen'));
});

test('die Auswahl nimmt Winter- und Regen-Items zusammen (PRD §5.2)', () => {
  const einmal = { art: 'einmal' };
  const katalog = {
    items: [
      { id: 'wollsocken', kategorie: 'Kleidung', tags: ['Winter'], menge: einmal },
      { id: 'schirm', kategorie: 'Haushalt & Sonstiges', tags: ['Regen'], menge: einmal },
      { id: 'zahnbuerste', kategorie: 'Kosmetik & Pflege', tags: ['Allgemein'], menge: einmal },
    ],
  };
  const reise = { id: 'x', von: '2026-01-01', bis: '2026-01-02', saison: ['Winter', 'Regen'] };
  assert.deepEqual([...ids(erzeugePackliste(katalog, reise))].sort(), ['schirm', 'wollsocken', 'zahnbuerste']);
});

test('die Markdown-Kopfzeile nennt beide Saison-Tags', () => {
  const reise = { id: 'm', name: 'Regenwinter', von: '2026-01-01', bis: '2026-01-02', saison: ['Winter', 'Regen'] };
  const md = alsMarkdown({ items: [] }, reise, []);
  assert.match(md, /Winter, Regen/);
});

test('Allgemein lässt sich nicht abwählen', () => {
  const tags = tripTags({ saison: 'Sommer', entfernte_tags: ['Allgemein', 'Sommer'] });
  assert.ok(tags.has('Allgemein'), 'Allgemein bleibt Fundament jeder Reise');
  assert.ok(!tags.has('Sommer'));
});

test('Verkehrsmittel ist ein Tag wie jeder andere (O7)', () => {
  assert.ok(tripTags({ verkehrsmittel: 'Auto' }).has('Auto'));
  assert.ok(!tripTags({ verkehrsmittel: 'Auto' }).has('Flugzeug'));
});

/* --- Auswahl (PRD §5.1) ---------------------------------------------------- */

test('passtZuReise nimmt bei Tag-Treffer auf', () => {
  assert.ok(passtZuReise({ tags: ['Sommer'] }, new Set(['Sommer'])));
  assert.ok(!passtZuReise({ tags: ['Winter'] }, new Set(['Sommer'])));
});

test('nicht_mit schlägt einen positiven Tag-Treffer (PRD §5.3)', () => {
  const badehose = { tags: ['Sommer', 'Strand'], nicht_mit: ['Städtetrip'] };
  assert.ok(passtZuReise(badehose, new Set(['Sommer', 'Strand'])));
  assert.ok(!passtZuReise(badehose, new Set(['Sommer', 'Städtetrip'])));
});

test('ein Item ohne Tags wird nie ausgewählt', () => {
  assert.ok(!passtZuReise({ tags: [] }, new Set(['Allgemein'])));
  assert.ok(!passtZuReise({}, new Set(['Allgemein'])));
});

/* --- Personen (PRD §4.6) --------------------------------------------------- */

test('Damen/Herren sind kein Reise-Tag: sie stehen in keinem Chip-Vokabular (O14)', () => {
  for (const t of PERSON_TAGS) {
    assert.ok(!BEKANNTE_TAGS.includes(t), `"${t}" darf nicht in TAG_GRUPPEN stehen — sonst wäre es ein Reise-Chip`);
  }
  // Und die Gegenrichtung: was in TAG_GRUPPEN steht, ist kein Personen-Tag.
  assert.deepEqual(PERSON_TAGS.filter((t) => BEKANNTE_TAGS.includes(t)), []);
});

test('personTags liefert genau das Geschlechts-Tag', () => {
  assert.deepEqual([...personTags(ANNA)], [GESCHLECHT_TAGS.weiblich]);
  assert.deepEqual([...personTags(BEN)], [GESCHLECHT_TAGS.maennlich]);
});

test('personTags ist leer ohne Geschlecht und ohne Person', () => {
  assert.deepEqual([...personTags({ id: 'x', name: 'Ohne' })], []);
  assert.deepEqual([...personTags({ id: 'x', geschlecht: '' })], []);
  assert.deepEqual([...personTags({ id: 'x', geschlecht: 'divers' })], [], 'unbekanntes Geschlecht ergibt kein Tag');
  assert.deepEqual([...personTags(null)], []);
  assert.deepEqual([...personTags(undefined)], []);
});

test('tripTagsFuerPerson = Reise-Tags ∪ Personen-Aktivitäten ∪ Geschlecht', () => {
  const teilnehmer = { person_id: ANNA.id, aktivitaeten: ['Fotografie'] };
  const tags = tripTagsFuerPerson(REISE, teilnehmer, ANNA);

  assert.deepEqual(
    [...tags].sort(),
    ['Allgemein', 'Damen', 'Ferienwohnung', 'Flugzeug', 'Fotografie', 'Sommer', 'Tauchen'].sort()
  );
  // Die Reise-Aktivitäten bleiben: die Person fügt hinzu, sie ersetzt nicht.
  assert.ok(tags.has('Tauchen'));
});

test('die Aktivitäten der einen Person landen nicht bei der anderen', () => {
  const anna = tripTagsFuerPerson(REISE, { person_id: ANNA.id, aktivitaeten: ['Fotografie'] }, ANNA);
  const ben = tripTagsFuerPerson(REISE, { person_id: BEN.id, aktivitaeten: ['Arbeit'] }, BEN);

  assert.ok(anna.has('Fotografie') && !anna.has('Arbeit'));
  assert.ok(ben.has('Arbeit') && !ben.has('Fotografie'));
  assert.ok(anna.has('Damen') && !anna.has('Herren'));
  assert.ok(ben.has('Herren') && !ben.has('Damen'));
});

test('ohne Teilnehmer-Eintrag bleibt es bei den Reise-Tags plus Geschlecht', () => {
  const tags = tripTagsFuerPerson(REISE, null, ANNA);
  assert.ok(tags.has('Damen'));
  assert.ok(tags.has('Tauchen'));
  assert.deepEqual([...tags].sort(), [...tripTags(REISE), 'Damen'].sort());
});

test('Personen-Aktivitäten gewinnen gegen entfernte_tags der Reise', () => {
  // Die Reise hat Fotografie gestrichen; die Person sagt ausdrücklich, dass sie
  // sie braucht. Ihre Angabe steht näher an ihr als das Streichen an der Reise.
  const reise = { ...REISE, aktivitaeten: ['Tauchen', 'Fotografie'], entfernte_tags: ['Fotografie'] };
  assert.ok(!tripTags(reise).has('Fotografie'), 'Vorbedingung: die Reise hat es gestrichen');

  const tags = tripTagsFuerPerson(reise, { person_id: ANNA.id, aktivitaeten: ['Fotografie'] }, ANNA);
  assert.ok(tags.has('Fotografie'), 'die Person holt ihre eigene Aktivität zurück');
});

/* --- Auswahl je Person ----------------------------------------------------- */

test('erzeugePackliste ohne Optionen lässt die Geschlechts-Items stehen', () => {
  // Eine Liste ohne Person hat kein Geschlechts-Tag — also greift auch kein
  // `nicht_mit` und es kommt, was zur Reise passt. Das ist der Altbestand: eine
  // Ein-Personen-Liste von vor dem Feature bekommt eher zu viel als zu wenig.
  const liste = erzeugePackliste(SPIELZEUG, REISE);
  assert.equal(liste.person_id, null);
  assert.ok(ids(liste).has('binden'));
  assert.ok(ids(liste).has('bikini'));
  assert.ok(ids(liste).has('badehose'));
  // Was an einer Aktivität hängt, bleibt trotzdem draußen.
  assert.ok(!ids(liste).has('kamera'));
  assert.ok(!ids(liste).has('laptop'));
});

test('erzeugePackliste setzt person_id und wählt nach Geschlecht aus', () => {
  const anna = erzeugePackliste(SPIELZEUG, REISE, { person: ANNA, teilnehmer: { person_id: ANNA.id } });
  const ben = erzeugePackliste(SPIELZEUG, REISE, { person: BEN, teilnehmer: { person_id: BEN.id } });

  assert.equal(anna.person_id, ANNA.id);
  assert.equal(ben.person_id, BEN.id);

  assert.ok(ids(anna).has('bikini'), 'Bikini ist nicht für Herren');
  assert.ok(ids(anna).has('binden'));
  assert.ok(!ids(anna).has('badehose'), 'Badehose ist nicht für Damen');

  assert.ok(ids(ben).has('badehose'));
  assert.ok(!ids(ben).has('bikini'));
  assert.ok(!ids(ben).has('binden'));
});

test('ein Geschlechts-Item bleibt an seine Saison gebunden', () => {
  // Der Grund, warum das Geschlecht als `nicht_mit` geführt wird und nicht als
  // positives Tag: so bleibt „nur für ihn" mit „nur im Sommer" kombinierbar.
  const winter = { ...REISE, saison: 'Winter', aktivitaeten: [] };
  const ben = erzeugePackliste(SPIELZEUG, winter, { person: BEN, teilnehmer: { person_id: BEN.id } });
  const anna = erzeugePackliste(SPIELZEUG, winter, { person: ANNA, teilnehmer: { person_id: ANNA.id } });

  assert.ok(!ids(ben).has('badehose'), 'Badehose im Winter, obwohl es ein Herren-Item ist');
  assert.ok(!ids(anna).has('bikini'), 'Bikini im Winter, obwohl es ein Damen-Item ist');
  assert.ok(ids(anna).has('binden'), 'Binden hängt an keiner Saison');
  assert.ok(!ids(ben).has('binden'));
});

test('ein positives Geschlechts-Tag wirkt ebenso — die Wahl liegt im Katalog', () => {
  // Beide Schreibweisen funktionieren; für saisonabhängige Items ist `nicht_mit`
  // die richtige. Dieser Fall friert den positiven Weg mit ein.
  const spielzeug = {
    items: [
      { id: 'nur-fuer-sie', name: 'Nur für sie', kategorie: 'Kleidung', tags: ['Damen'], menge: { art: 'einmal' }, nicht_mit: [] },
      { id: 'neutral', name: 'Neutral', kategorie: 'Kleidung', tags: ['Allgemein'], menge: { art: 'einmal' }, nicht_mit: [] },
    ],
  };
  const anna = erzeugePackliste(spielzeug, REISE, { person: ANNA, teilnehmer: { person_id: ANNA.id } });
  const ben = erzeugePackliste(spielzeug, REISE, { person: BEN, teilnehmer: { person_id: BEN.id } });

  assert.deepEqual([...ids(anna)].sort(), ['neutral', 'nur-fuer-sie']);
  assert.deepEqual([...ids(ben)], ['neutral']);
});

test('die eigene Aktivität bringt die eigenen Items — und nur bei dieser Person', () => {
  const anna = erzeugePackliste(SPIELZEUG, REISE, { person: ANNA, teilnehmer: { person_id: ANNA.id, aktivitaeten: ['Fotografie'] } });
  const ben = erzeugePackliste(SPIELZEUG, REISE, { person: BEN, teilnehmer: { person_id: BEN.id, aktivitaeten: ['Arbeit'] } });

  assert.ok(ids(anna).has('kamera') && !ids(anna).has('laptop'));
  assert.ok(ids(ben).has('laptop') && !ids(ben).has('kamera'));
});

test('erzeugePacklisten ergibt eine Liste je Teilnehmer, in deren Reihenfolge', () => {
  const teilnehmer = [
    { person_id: ANNA.id, aktivitaeten: ['Fotografie'] },
    { person_id: BEN.id, aktivitaeten: ['Arbeit'] },
  ];
  const listen = erzeugePacklisten(SPIELZEUG, REISE, [ANNA, BEN], teilnehmer);

  assert.equal(listen.length, 2);
  assert.deepEqual(listen.map((l) => l.person_id), [ANNA.id, BEN.id]);
  assert.equal(listen[0].reise_id, REISE.id);
  assert.ok(ids(listen[0]).has('kamera'));
  assert.ok(ids(listen[1]).has('laptop'));
});

test('erzeugePacklisten überspringt Teilnehmer ohne Person in der Registry', () => {
  const teilnehmer = [
    { person_id: ANNA.id },
    { person_id: 'p-geloescht' },
  ];
  const listen = erzeugePacklisten(SPIELZEUG, REISE, [ANNA], teilnehmer);
  assert.deepEqual(listen.map((l) => l.person_id), [ANNA.id], 'eine gelöschte Person hinterlässt keine leere Liste');
});

test('erzeugePacklisten ohne Teilnehmer ist keine Liste', () => {
  assert.deepEqual(erzeugePacklisten(SPIELZEUG, REISE, [ANNA, BEN], []), []);
  assert.deepEqual(erzeugePacklisten(SPIELZEUG, REISE, [], null), []);
});

test('alsMarkdown unterscheidet zwei Listen derselben Reise am Namen', () => {
  const pos = [{ item_id: 'bikini', menge: 1, gepackt: false }];
  const ohne = alsMarkdown(SPIELZEUG, REISE, pos);
  const mit = alsMarkdown(SPIELZEUG, REISE, pos, false, ANNA);

  assert.match(ohne, /^# Packliste — Tauchurlaub$/m);
  assert.match(mit, /^# Packliste — Tauchurlaub — Anna$/m);
  assert.match(mit, /Anna · Sommer/, 'der Personenname steht in der Kopfzeile');
});

/* --- Das Beispiel aus PRD §5.2 --------------------------------------------- */

test('PRD §5.2: die Beispielreise wählt genau die erwarteten Items', () => {
  const spielzeug = {
    items: [
      { id: 'tshirt', name: 'T-Shirt', kategorie: 'Kleidung', tags: ['Sommer', 'Allgemein'], menge: { art: 'pro_tage', n: 1, pro_tage: 3, max: 6 }, nicht_mit: [] },
      { id: 'badehose', name: 'Badehose', kategorie: 'Kleidung', tags: ['Sommer', 'Tauchen'], menge: { art: 'fest', n: 2 }, nicht_mit: [] },
      { id: 'anzug', name: 'Tauchanzug', kategorie: 'Tauchausrüstung', tags: ['Tauchen'], menge: { art: 'einmal' }, nicht_mit: [] },
      { id: 'nackenkissen', name: 'Nackenkissen', kategorie: 'Haushalt & Sonstiges', tags: ['Flugzeug'], menge: { art: 'einmal' }, nicht_mit: [] },
      { id: 'zip', name: 'Zip-Beutel 1 l', kategorie: 'Taschen & Ordnung', tags: ['Flugzeug'], menge: { art: 'einmal' }, nicht_mit: [] },
      { id: 'wanderschuhe', name: 'Wanderschuhe', kategorie: 'Schuhe', tags: ['Winter', 'Camping'], menge: { art: 'einmal' }, nicht_mit: [] },
      { id: 'zahnbuerste', name: 'Zahnbürste', kategorie: 'Kosmetik & Pflege', tags: ['Allgemein'], menge: { art: 'einmal' }, nicht_mit: [] },
      { id: 'sonnencreme', name: 'Sonnencreme', kategorie: 'Kosmetik & Pflege', tags: ['Sommer', 'Flugzeug'], menge: { art: 'einmal' }, nicht_mit: [] },
    ],
  };
  const reise = {
    id: 'r1',
    name: 'Tauchurlaub',
    von: '2026-08-01',
    bis: '2026-08-10',
    saison: 'Sommer',
    aktivitaeten: ['Tauchen'],
    verkehrsmittel: 'Flugzeug',
    unterkunft: 'Ferienwohnung',
  };

  const liste = erzeugePackliste(spielzeug, reise);
  const nach = new Map(liste.positionen.map((p) => [p.item_id, p.menge]));

  assert.ok(!nach.has('wanderschuhe'), 'Wanderschuhe dürfen nicht dabei sein');
  assert.equal(nach.get('tshirt'), 4, 'T-Shirt: 1 pro 3 Tage, max 6 -> 4');
  assert.equal(nach.get('badehose'), 2);
  assert.equal(nach.get('anzug'), 1);
  assert.equal(nach.get('nackenkissen'), 1);
  assert.equal(nach.get('zip'), 1);
  assert.equal(nach.get('zahnbuerste'), 1);
  assert.equal(nach.get('sonnencreme'), 1);
  assert.equal(liste.positionen.length, 7);
});

test('die Packliste ist eine Momentaufnahme mit Häkchen und Datum', () => {
  const liste = erzeugePackliste({ items: [{ id: 'a', name: 'A', kategorie: 'Kleidung', tags: ['Allgemein'], menge: { art: 'einmal' } }] }, { id: 'r1' });
  assert.equal(liste.reise_id, 'r1');
  assert.ok(!Number.isNaN(Date.parse(liste.erzeugt_am)));
  assert.deepEqual(liste.positionen[0], {
    item_id: 'a',
    menge: 1,
    gepackt: false,
    manuell_hinzugefuegt: false,
  });
});

/* --- Gruppierung (US-04, O9) ----------------------------------------------- */

test('gruppiere hält die feste Kategorienreihenfolge aus Anhang B.1 ein', () => {
  const kat = {
    items: [
      { id: 'a', name: 'Zahnpasta', kategorie: 'Kosmetik & Pflege', tags: ['Allgemein'] },
      { id: 'b', name: 'Reisepass', kategorie: 'Dokumente & Wertsachen', tags: ['Allgemein'] },
      { id: 'c', name: 'T-Shirt', kategorie: 'Kleidung', tags: ['Allgemein'] },
    ],
  };
  const pos = ['a', 'b', 'c'].map((id) => ({ item_id: id, menge: 1, gepackt: false }));
  assert.deepEqual(
    gruppiere(kat, pos).map((g) => g.kategorie),
    ['Dokumente & Wertsachen', 'Kleidung', 'Kosmetik & Pflege']
  );
});

test('gruppiere sortiert innerhalb der Kategorie alphabetisch (deutsch)', () => {
  const kat = {
    items: [
      { id: 'a', name: 'Zwiebel', kategorie: 'Kleidung', tags: [] },
      { id: 'b', name: 'Ärmel', kategorie: 'Kleidung', tags: [] },
      { id: 'c', name: 'Hose', kategorie: 'Kleidung', tags: [] },
    ],
  };
  const pos = ['a', 'b', 'c'].map((id) => ({ item_id: id, menge: 1 }));
  assert.deepEqual(
    gruppiere(kat, pos)[0].positionen.map((p) => p.item.name),
    ['Ärmel', 'Hose', 'Zwiebel'] // Ä gehört im Deutschen unter A
  );
});

test('gruppiere blendet leere Kategorien aus (US-04)', () => {
  const kat = { items: [{ id: 'a', name: 'A', kategorie: 'Kleidung', tags: [] }] };
  assert.equal(gruppiere(kat, [{ item_id: 'a', menge: 1 }]).length, 1);
});

test('gruppiere überspringt Positionen, deren Item der Katalog nicht mehr kennt', () => {
  const kat = { items: [{ id: 'a', name: 'A', kategorie: 'Kleidung', tags: [] }] };
  const gruppen = gruppiere(kat, [
    { item_id: 'a', menge: 1 },
    { item_id: 'weg', menge: 1 },
  ]);
  assert.equal(gruppen[0].positionen.length, 1);
});

/* --- Fortschritt (US-06) --------------------------------------------------- */

test('fortschritt zählt gepackte gegen gesamte Positionen', () => {
  const p = [{ gepackt: true }, { gepackt: false }, { gepackt: true }];
  assert.deepEqual(fortschritt(p), { gepackt: 2, gesamt: 3, anteil: 2 / 3 });
  assert.deepEqual(fortschritt([]), { gepackt: 0, gesamt: 0, anteil: 0 });
});

/* --- Markdown (US-07) ------------------------------------------------------ */

test('alsMarkdown behält Gruppierung, Mengen und Häkchen', () => {
  const kat = {
    items: [
      { id: 'a', name: 'T-Shirt', kategorie: 'Kleidung', tags: [] },
      { id: 'b', name: 'Reisepass', kategorie: 'Dokumente & Wertsachen', tags: [] },
    ],
  };
  const reise = { name: 'Testreise', von: '2026-08-01', bis: '2026-08-10', saison: 'Sommer' };
  const pos = [
    { item_id: 'b', menge: 1, gepackt: true },
    { item_id: 'a', menge: 4, gepackt: false },
  ];
  const md = alsMarkdown(kat, reise, pos);
  assert.match(md, /^# Packliste — Testreise$/m);
  assert.match(md, /10 Tage/);
  assert.match(md, /^## Dokumente & Wertsachen$/m);
  assert.match(md, /- \[x\] Reisepass/);
  assert.match(md, /- \[ \] T-Shirt \(4×\)/);
});

test('alsMarkdown kann auf ungepackte Positionen eingrenzen (US-07)', () => {
  const kat = {
    items: [
      { id: 'a', name: 'T-Shirt', kategorie: 'Kleidung', tags: [] },
      { id: 'b', name: 'Reisepass', kategorie: 'Dokumente & Wertsachen', tags: [] },
    ],
  };
  const pos = [
    { item_id: 'b', menge: 1, gepackt: true },
    { item_id: 'a', menge: 4, gepackt: false },
  ];
  const md = alsMarkdown(kat, { name: 'T' }, pos, true);
  assert.ok(!md.includes('Reisepass'), 'gepackte Position darf nicht auftauchen');
  assert.ok(md.includes('T-Shirt'));
});

/* --- Der echte Katalog (PRD §3.5: "Fertig, wenn ...") ---------------------- */
/* Überspringt sich, wenn die private Arbeitskopie fehlt (siehe Kopf). */

test('echter Katalog: Struktur und Vokabular stimmen (PRD §4.1, Anhang B.1)', { skip: nurMitEchtemKatalog }, () => {
  assert.ok(Array.isArray(katalog.items));
  assert.ok(katalog.items.length > 200, `nur ${katalog.items.length} Items`);
  assert.equal(typeof katalog.version, 'number');

  const ids = new Set();
  for (const item of katalog.items) {
    assert.equal(typeof item.id, 'string', `${item.name}: id fehlt`);
    assert.ok(!ids.has(item.id), `doppelte id: ${item.id}`);
    ids.add(item.id);

    assert.ok(item.name?.length > 0, `${item.id}: name fehlt`);
    assert.ok(KATEGORIEN.includes(item.kategorie), `${item.name}: unbekannte Kategorie "${item.kategorie}"`);
    assert.ok(Array.isArray(item.tags), `${item.name}: tags fehlen`);
    assert.ok(item.menge && typeof item.menge.art === 'string', `${item.name}: menge fehlt`);
    assert.ok(['einmal', 'fest', 'pro_tage'].includes(item.menge.art), `${item.name}: unbekannte Menge "${item.menge.art}"`);
  }
});

test('echter Katalog: jede Reise erzeugt eine vollständige Liste', { skip: nurMitEchtemKatalog }, () => {
  const reise = {
    id: 'echt',
    name: 'Tauchurlaub Ägypten',
    ziel: 'Hurghada',
    von: '2026-10-01',
    bis: '2026-10-10',
    saison: 'Sommer',
    aktivitaeten: ['Tauchen'],
    verkehrsmittel: 'Flugzeug',
    unterkunft: 'Ferienwohnung',
  };
  const liste = erzeugePackliste(katalog, reise);
  const gruppen = gruppiere(katalog, liste.positionen);

  assert.ok(liste.positionen.length > 50, `nur ${liste.positionen.length} Positionen`);
  assert.ok(gruppen.length > 5);
  assert.ok(liste.positionen.every((p) => p.menge >= 1), 'jede Position hat mindestens 1');
  assert.ok(liste.positionen.every((p) => Number.isInteger(p.menge)), 'Mengen sind ganze Zahlen');

  // Die Essentials müssen dabei sein — das ist der teuerste Fehlerfall (B.1).
  const namen = new Set(liste.positionen.map((p) => p.item_id));
  const nachName = new Map(katalog.items.map((i) => [i.name, i.id]));
  for (const pflicht of ['Reisepass', 'Zahnzeug', 'Impfpass', 'Zahnpasta']) {
    const id = nachName.get(pflicht);
    assert.ok(id, `"${pflicht}" steht gar nicht im Katalog — Testannahme prüfen`);
    assert.ok(namen.has(id), `"${pflicht}" fehlt auf der Liste`);
  }
});

test('echter Katalog: Winterreise und Sommerreise unterscheiden sich', { skip: nurMitEchtemKatalog }, () => {
  const basis = { id: 'x', von: '2026-02-01', bis: '2026-02-07', aktivitaeten: [], unterkunft: 'Hotel', verkehrsmittel: 'Zug' };
  const winter = erzeugePackliste(katalog, { ...basis, saison: 'Winter' });
  const sommer = erzeugePackliste(katalog, { ...basis, saison: 'Sommer' });

  const ids = (l) => new Set(l.positionen.map((p) => p.item_id));
  const w = ids(winter);
  const s = ids(sommer);

  const nurWinter = [...w].filter((i) => !s.has(i));
  const nurSommer = [...s].filter((i) => !w.has(i));
  assert.ok(nurWinter.length > 0, 'Winter muss eigene Items haben');
  assert.ok(nurSommer.length > 0, 'Sommer muss eigene Items haben');
});

test('echter Katalog: keine Reise liefert eine leere Liste', { skip: nurMitEchtemKatalog }, () => {
  // Die Untergrenze ist bewusst grob: sie soll fangen, dass `Allgemein` gar nicht
  // mehr greift, nicht die genaue Item-Zahl festschreiben. Seit dem Medizin-Tag
  // (Reiseapotheke, 47 Items) liegt der Grundstock einer reinen Saisonreise bei 86 —
  // vorher bei 88 (und davor 135).
  for (const saison of ['Winter', 'Sommer', 'Übergangszeit']) {
    const liste = erzeugePackliste(katalog, { id: 'y', saison, von: '2026-06-01', bis: '2026-06-03' });
    assert.ok(liste.positionen.length >= 80, `${saison}: nur ${liste.positionen.length} Positionen — Allgemein trägt nicht`);
  }
});

test('Performance: 259 Items in deutlich unter 200 ms (PRD §9)', { skip: nurMitEchtemKatalog }, () => {
  const reise = { id: 'p', von: '2026-06-01', bis: '2026-06-14', saison: 'Sommer', aktivitaeten: ['Tauchen', 'Wandern'], verkehrsmittel: 'Flugzeug', unterkunft: 'Camping' };
  const start = performance.now();
  for (let i = 0; i < 100; i++) erzeugePackliste(katalog, reise);
  const proLauf = (performance.now() - start) / 100;
  assert.ok(proLauf < 200, `${proLauf.toFixed(2)} ms pro Lauf`);
});
