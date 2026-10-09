/**
 * Tests der Synchronisierung (PRD §4.5).
 *
 * Alles läuft gegen eine `fetch`-Attrappe: kein Netz, keine Tokens, kein Repo.
 * Die Attrappe protokolliert jeden Aufruf, damit sich auch das *Unterlassen*
 * prüfen lässt — etwa, dass ein Konflikt nicht heimlich überschrieben wird.
 *
 * Lauf: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  kodiereBase64,
  dekodiereBase64,
  byteLaenge,
  istRepoName,
  baueContentsUrl,
  baueKopfzeilen,
  klassifiziere,
  erstelleSync,
  holeKatalog,
  holeReisen,
  schiebeReisen,
} from '../src/sync.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(resolve(HIER, 'fixtures/katalog.synthetisch.json'), 'utf8'));

const TOKEN = 'TESTTOKEN-nur-fuer-den-Test-1234567890';

/**
 * Eine fetch-Attrappe. `antworten` ist entweder eine feste Antwort oder eine
 * Funktion (url, optionen) -> Antwort. `'WIRFT'` als Antwort simuliert ein
 * fehlendes Netz.
 *
 * Die base64-Nutzlast wird bewusst mit `Buffer` gebaut, nicht mit unserem
 * eigenen Kodierer — sonst könnte ein Fehler darin sich selbst verstecken.
 */
function baueFetch(antworten) {
  const aufrufe = [];
  const fetchFn = async (url, optionen = {}) => {
    aufrufe.push({ url, method: optionen.method ?? 'GET', headers: optionen.headers ?? {}, body: optionen.body });
    const a = typeof antworten === 'function' ? antworten(url, optionen) : antworten;
    if (a === 'WIRFT') throw new TypeError('Failed to fetch');
    return { status: a.status, text: async () => a.koerper ?? '' };
  };
  return { fetchFn, aufrufe };
}

/** Eine Contents-API-Antwort für eine vorhandene Datei. */
function dateiAntwort(text, sha = 'sha-1') {
  return { status: 200, koerper: JSON.stringify({ content: Buffer.from(text, 'utf8').toString('base64'), sha, size: byteLaenge(text) }) };
}

/* --- Kodierung ------------------------------------------------------------- */

test('base64 überlebt Umlaute, Sonderzeichen und Emoji', () => {
  const original = 'Übergangszeit · Straße · ẞ · 😀 · 中文 · Zeilen\numbruch\ttab';
  assert.equal(dekodiereBase64(kodiereBase64(original)), original);
});

test('base64 überlebt eine große Nutzlast (Chunking, kein RangeError)', () => {
  // 256 KB liegen über der gemessenen V8-Grenze von ~100k Argumenten, ab der
  // `String.fromCharCode(...bytes)` mit RangeError abbricht. Ohne Chunking
  // fällt dieser Test um — mit Chunking muss er halten.
  const gross = 'Übergangszeit Straße ẞ 😀\n'.repeat(8000);
  assert.ok(byteLaenge(gross) > 200000, 'die Nutzlast muss groß genug sein, um den Stapel zu sprengen');
  assert.equal(dekodiereBase64(kodiereBase64(gross)), gross);
});

test('byteLaenge zählt Bytes, nicht Zeichen', () => {
  assert.equal(byteLaenge('Ü'), 2);
  assert.equal(byteLaenge('abc'), 3);
});

/* --- URL und Kopfzeilen ---------------------------------------------------- */

test('baueContentsUrl kodiert Pfadsegmente und trimmt das Repo', () => {
  assert.equal(
    baueContentsUrl('owner/name', 'katalog.json'),
    'https://api.github.com/repos/owner/name/contents/katalog.json'
  );
  assert.equal(
    baueContentsUrl('/owner/name/', 'unter ordner/datei.json'),
    'https://api.github.com/repos/owner/name/contents/unter%20ordner/datei.json'
  );
});

test('istRepoName akzeptiert nur owner/name', () => {
  assert.ok(istRepoName('vernaldaylight/packliste-daten'));
  assert.ok(!istRepoName('nur-ein-name'));
  assert.ok(!istRepoName('zu/viele/schraegstriche'));
  assert.ok(!istRepoName(''));
  assert.ok(!istRepoName(null));
});

test('das Token steht ausschließlich im Kopf, nie in der URL', () => {
  const kopf = baueKopfzeilen(TOKEN);
  assert.equal(kopf.Authorization, `Bearer ${TOKEN}`);
  const url = baueContentsUrl('owner/name', 'reisen.json');
  assert.ok(!url.includes(TOKEN));
});

/* --- Antworten deuten ----------------------------------------------------- */

test('klassifiziere ordnet die Status richtig zu', () => {
  assert.equal(klassifiziere(200).art, 'ok');
  assert.equal(klassifiziere(201).art, 'ok');
  assert.equal(klassifiziere(401).art, 'token');
  assert.equal(klassifiziere(404).art, 'nicht_gefunden');
  assert.equal(klassifiziere(403, 'You have exceeded a secondary rate limit').art, 'limit');
  assert.equal(klassifiziere(403, 'Resource not accessible by personal access token').art, 'token');
  assert.equal(klassifiziere(409, 'sha does not match').art, 'konflikt');
  assert.equal(klassifiziere(422, 'sha does not match').art, 'konflikt');
  // 422 aus einem anderen Grund ist KEIN Konflikt.
  assert.equal(klassifiziere(422, 'content is not valid base64').art, 'unbekannt');
  assert.equal(klassifiziere(500).art, 'unbekannt');
});

test('keine Fehlermeldung enthält das Token', () => {
  for (const status of [401, 403, 404, 409, 422, 500]) {
    const { fehler } = klassifiziere(status, `Bearer ${TOKEN}`);
    assert.ok(fehler && !fehler.includes(TOKEN), `Status ${status} leakt das Token`);
  }
});

/* --- Lesen ----------------------------------------------------------------- */

test('hole liefert Inhalt und sha', async () => {
  const { fetchFn, aufrufe } = baueFetch(dateiAntwort('{"hallo":"Welt"}', 'sha-abc'));
  const sync = erstelleSync({ fetchFn });

  const r = await sync.hole({ token: TOKEN, repo: 'owner/name', pfad: 'katalog.json' });
  assert.ok(r.ok);
  assert.equal(r.inhalt, '{"hallo":"Welt"}');
  assert.equal(r.sha, 'sha-abc');
  assert.equal(aufrufe.length, 1);
  assert.equal(aufrufe[0].method, 'GET');
});

test('hole erkennt eine fehlende Datei als fehlt, nicht als Fehler', async () => {
  const { fetchFn } = baueFetch({ status: 404, koerper: JSON.stringify({ message: 'Not Found' }) });
  const sync = erstelleSync({ fetchFn });

  const r = await sync.hole({ token: TOKEN, repo: 'owner/name', pfad: 'reisen.json' });
  assert.equal(r.ok, false);
  assert.equal(r.fehlt, true);
});

test('hole ohne Token fragt gar nicht erst', async () => {
  const { fetchFn, aufrufe } = baueFetch(dateiAntwort('{}'));
  const sync = erstelleSync({ fetchFn });

  const r = await sync.hole({ token: '', repo: 'owner/name', pfad: 'katalog.json' });
  assert.equal(r.ok, false);
  assert.match(r.fehler, /Token/);
  assert.equal(aufrufe.length, 0, 'ohne Token darf keine Anfrage rausgehen');
});

test('holeReisen lehnt einen unbrauchbaren Stand drüben ab', async () => {
  const kaputt = JSON.stringify({ version: 1, reisen: [{ name: 'ohne id' }] });
  const { fetchFn } = baueFetch(dateiAntwort(kaputt));
  const sync = erstelleSync({ fetchFn });

  const r = await holeReisen({ sync, token: TOKEN, repo: 'owner/name' });
  assert.equal(r.ok, false);
  assert.ok(r.fehlerListe.length > 0);
  assert.match(r.fehlerListe.join(' '), /id fehlt/);
});

test('holeKatalog nimmt den Fixture-Katalog an', async () => {
  const { fetchFn } = baueFetch(dateiAntwort(JSON.stringify(FIXTURE)));
  const sync = erstelleSync({ fetchFn });

  const r = await holeKatalog({ sync, token: TOKEN, repo: 'owner/name' });
  assert.ok(r.ok, r.fehlerListe?.join(' | '));
  assert.equal(r.katalog.items.length, FIXTURE.items.length);
  assert.equal(r.statistik.kategorien, 11);
});

test('holeKatalog lehnt unbrauchbaren Katalog ab, statt ihn zu übernehmen', async () => {
  const { fetchFn } = baueFetch(dateiAntwort('{"version":1,"items":[{"id":"x"}]}'));
  const sync = erstelleSync({ fetchFn });

  const r = await holeKatalog({ sync, token: TOKEN, repo: 'owner/name' });
  assert.equal(r.ok, false);
  assert.equal(r.katalog, undefined);
  assert.ok(r.fehlerListe.length > 0);
});

/* --- Schreiben und Konflikt ------------------------------------------------ */

test('lege schickt die sha mit und gibt die neue zurück', async () => {
  const { fetchFn, aufrufe } = baueFetch({ status: 201, koerper: JSON.stringify({ content: { sha: 'sha-neu' } }) });
  const sync = erstelleSync({ fetchFn });

  const r = await sync.lege({ token: TOKEN, repo: 'owner/name', pfad: 'reisen.json', inhalt: '{}', sha: 'sha-alt' });
  assert.ok(r.ok);
  assert.equal(r.sha, 'sha-neu');

  const koerper = JSON.parse(aufrufe[0].body);
  assert.equal(koerper.sha, 'sha-alt');
  assert.equal(aufrufe[0].method, 'PUT');
});

test('lege ohne sha legt an und schickt kein sha-Feld', async () => {
  const { fetchFn, aufrufe } = baueFetch({ status: 201, koerper: JSON.stringify({ content: { sha: 'x' } }) });
  const sync = erstelleSync({ fetchFn });

  await sync.lege({ token: TOKEN, repo: 'owner/name', pfad: 'reisen.json', inhalt: '{}' });
  assert.ok(!('sha' in JSON.parse(aufrufe[0].body)));
});

test('ein Konflikt wird gemeldet und NICHT heimlich überschrieben', async () => {
  const { fetchFn, aufrufe } = baueFetch({ status: 409, koerper: JSON.stringify({ message: 'sha does not match' }) });
  const sync = erstelleSync({ fetchFn });

  const r = await sync.lege({ token: TOKEN, repo: 'owner/name', pfad: 'reisen.json', inhalt: '{}', sha: 'sha-veraltet' });
  assert.equal(r.ok, false);
  assert.equal(r.konflikt, true);
  assert.equal(aufrufe.length, 1, 'genau ein Versuch — kein stiller zweiter Schreibvorgang');
});

test('ein kaputter 422 ist kein Konflikt', async () => {
  const { fetchFn } = baueFetch({ status: 422, koerper: JSON.stringify({ message: 'content is not valid base64' }) });
  const sync = erstelleSync({ fetchFn });

  const r = await sync.lege({ token: TOKEN, repo: 'owner/name', pfad: 'reisen.json', inhalt: '{}' });
  assert.equal(r.ok, false);
  assert.ok(!r.konflikt, '422 aus anderem Grund darf nicht als Konflikt gemeldet werden');
});

test('eine zu große Nutzlast wird abgelehnt, bevor sie rausgeht', async () => {
  const { fetchFn, aufrufe } = baueFetch({ status: 201, koerper: '{}' });
  const sync = erstelleSync({ fetchFn });

  const zuGross = 'x'.repeat(1024 * 1024 + 1);
  const r = await sync.lege({ token: TOKEN, repo: 'owner/name', pfad: 'reisen.json', inhalt: zuGross });
  assert.equal(r.ok, false);
  assert.match(r.fehler, /1 MB/);
  assert.equal(aufrufe.length, 0, 'zu groß heißt: gar nicht erst senden');
});

test('schiebeReisen schreibt einen geprüften, lesbaren Stand', async () => {
  const { fetchFn, aufrufe } = baueFetch({ status: 201, koerper: JSON.stringify({ content: { sha: 's' } }) });
  const sync = erstelleSync({ fetchFn });

  const daten = { version: 1, reisen: [{ id: 'r1', name: 'Tauchurlaub' }], packlisten: [] };
  const r = await schiebeReisen({ sync, token: TOKEN, repo: 'owner/name', daten, sha: 'alt' });
  assert.ok(r.ok);

  const koerper = JSON.parse(aufrufe[0].body);
  const geschrieben = dekodiereBase64(koerper.content);
  assert.match(geschrieben, /Tauchurlaub/);
  assert.match(geschrieben, /\n$/, 'Datei endet mit Zeilenumbruch — lesbare Diffs');

  const drueben = JSON.parse(geschrieben);
  assert.equal(drueben.reisen[0].id, 'r1');
  assert.deepEqual(drueben.packlisten, []);
  assert.deepEqual(drueben.personen, [], 'auch ein alter Stand geht als vollständiger hinaus');
  assert.deepEqual(drueben.reisen[0].teilnehmer, []);
});

test('schiebeReisen schreibt Personen und beide Listen zweier Personen mit', async () => {
  // Der teure Fall: ginge `personen` zwischen Prüfung und Schreiben verloren,
  // stünden die Listen drüben ohne ihre Personen da — und beim nächsten Holen
  // wären die Teilnehmer weg.
  const { fetchFn, aufrufe } = baueFetch({ status: 201, koerper: JSON.stringify({ content: { sha: 's' } }) });
  const sync = erstelleSync({ fetchFn });

  const daten = {
    version: 2,
    personen: [
      { id: 'p1', name: 'Anna', geschlecht: 'weiblich' },
      { id: 'p2', name: 'Ben', geschlecht: 'maennlich' },
    ],
    reisen: [{ id: 'r1', name: 'Tauchurlaub', teilnehmer: [{ person_id: 'p1' }, { person_id: 'p2' }] }],
    packlisten: [
      { reise_id: 'r1', person_id: 'p1', positionen: [] },
      { reise_id: 'r1', person_id: 'p2', positionen: [] },
    ],
  };
  const r = await schiebeReisen({ sync, token: TOKEN, repo: 'owner/name', daten, sha: 'alt' });
  assert.ok(r.ok);

  const drueben = JSON.parse(dekodiereBase64(JSON.parse(aufrufe[0].body).content));
  assert.deepEqual(drueben.personen, daten.personen);
  // Die Teilnehmer gehen vollständig hinaus — mit aufgefülltem `reiseapotheke`
  // (1.14), das die Eingabe nicht gesetzt hatte.
  assert.deepEqual(drueben.reisen[0].teilnehmer, [
    { person_id: 'p1', reiseapotheke: false },
    { person_id: 'p2', reiseapotheke: false },
  ]);
  assert.deepEqual(drueben.packlisten.map((p) => p.person_id), ['p1', 'p2']);
});

test('schiebeReisen schiebt einen unbrauchbaren Stand gar nicht erst hoch', async () => {
  // Drüben läge danach nur diese eine Fassung, und holeReisen würde sie
  // ablehnen — ein kaputter Push nähme jedem Gerät den Rückweg.
  const { fetchFn, aufrufe } = baueFetch({ status: 201, koerper: JSON.stringify({ content: { sha: 's' } }) });
  const sync = erstelleSync({ fetchFn });

  const kaputt = { version: 1, reisen: [{ name: 'ohne id' }], packlisten: [] };
  const r = await schiebeReisen({ sync, token: TOKEN, repo: 'owner/name', daten: kaputt });
  assert.equal(r.ok, false);
  assert.match(r.fehlerListe.join(' '), /id fehlt/);
  assert.equal(aufrufe.length, 0, 'unbrauchbar heißt: gar nicht erst senden');
});

/* --- Kein Netz ------------------------------------------------------------- */

test('ohne Netz wird ein Fehler zurückgegeben, nicht geworfen', async () => {
  const { fetchFn } = baueFetch('WIRFT');
  const sync = erstelleSync({ fetchFn });

  const gelesen = await sync.hole({ token: TOKEN, repo: 'owner/name', pfad: 'katalog.json' });
  assert.equal(gelesen.ok, false);
  assert.match(gelesen.fehler, /Netz/);

  const geschrieben = await sync.lege({ token: TOKEN, repo: 'owner/name', pfad: 'reisen.json', inhalt: '{}' });
  assert.equal(geschrieben.ok, false);
  assert.match(geschrieben.fehler, /Netz/);
});

test('ein ungültiges Repo wird gemeldet, ohne zu fragen', async () => {
  const { fetchFn, aufrufe } = baueFetch(dateiAntwort('{}'));
  const sync = erstelleSync({ fetchFn });

  const r = await sync.hole({ token: TOKEN, repo: 'kein-schraegstrich', pfad: 'katalog.json' });
  assert.equal(r.ok, false);
  assert.match(r.fehler, /owner\/name/);
  assert.equal(aufrufe.length, 0);
});
