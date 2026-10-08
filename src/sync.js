/**
 * sync.js — Katalog und Reisen über die GitHub-Contents-API (PRD §4.5).
 *
 * Aufgeteilt in zwei Hälften, damit die Logik **ohne Netz** prüfbar bleibt:
 *
 *   oben   reine Funktionen — Kodierung, URL-Bau, Deutung der Antwort
 *   unten  der Netzrand (`erstelleSync`) und die Domänen-Funktionen
 *          (`holeKatalog`, `holeReisen`, `schiebeReisen`)
 *
 * `fetch` wird injiziert. `node --test` schiebt eine Attrappe unter, die
 * Antworten aus einem Objekt liefert; im Browser ist es das echte `fetch`.
 *
 * Drei Regeln tragen den Entwurf:
 *
 *  1. **Das Token steht nur im `Authorization`-Kopf.** Nie in der URL, nie in
 *     einer Meldung, nie in einem Log — sonst wäre es in Fehlerberichten und im
 *     Verlauf und damit wertlos.
 *  2. **Nichts wirft.** Jede Funktion gibt `{ok, fehler}` zurück, wie
 *     `validiereKatalog`/`validiereDaten` in store.js. Ohne Netz läuft die App
 *     aus dem `localStorage` weiter (PRD §4.5).
 *  3. **Geprüft wird vor dem Übernehmen.** Ein unbrauchbarer Stand von drüben
 *     lässt den hiesigen Bestand unangetastet — dieselbe Regel wie bei US-09.
 */

import { validiereKatalog, validiereDaten } from './store.js';

/** Mehr erlaubt die Contents-API beim Schreiben nicht (darüber: Git Data API). */
const MAX_BYTE = 1024 * 1024;

const VORGABE_BASIS_URL = 'https://api.github.com';
const VORGABE_ZEITLIMIT_MS = 15000;

/* --- Kodierung ------------------------------------------------------------- */

/**
 * UTF-8-sicher nach base64.
 *
 * `btoa` nimmt nur Latin-1 und zerstört Umlaute, deshalb erst `TextEncoder`.
 * Die Bytes werden **gechunkt** in einen String gehoben: `fromCharCode(...bytes)`
 * übergibt jedes Byte als eigenes Argument, und V8 bricht irgendwo zwischen
 * 100.000 und 125.000 Argumenten mit `RangeError` ab (gemessen). Der heutige
 * Katalog liegt mit 38 KB noch darunter, `reisen.json` wächst aber mit jeder
 * Reise — deshalb von Anfang an gechunkt statt auf die Grenze zu warten.
 */
export function kodiereBase64(text) {
  const bytes = new TextEncoder().encode(String(text));
  const CHUNK = 0x8000; // 32 KiB — klein genug für den Stapel, groß genug für Tempo
  let binaer = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binaer += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binaer);
}

/** base64 zurück nach UTF-8. Leerraum wird entfernt — GitHub bricht Zeilen um. */
export function dekodiereBase64(b64) {
  const binaer = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(binaer.length);
  for (let i = 0; i < binaer.length; i++) bytes[i] = binaer.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/** Größe in Bytes, nicht in Zeichen — Umlaute zählen doppelt. */
export function byteLaenge(text) {
  return new TextEncoder().encode(String(text)).length;
}

/* --- Anfrage bauen --------------------------------------------------------- */

/** `owner/name`, mehr akzeptiert die API nicht. */
export function istRepoName(repo) {
  return /^[\w.-]+\/[\w.-]+$/.test(String(repo ?? '').trim());
}

/** `https://api.github.com/repos/owner/name/contents/<pfad>`, je Segment kodiert. */
export function baueContentsUrl(repo, pfad, basisUrl = VORGABE_BASIS_URL) {
  const segmente = String(pfad)
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s));
  const sauber = String(repo ?? '').trim().replace(/^\/+|\/+$/g, '');
  return `${basisUrl.replace(/\/+$/, '')}/repos/${sauber}/contents/${segmente.join('/')}`;
}

/** Das Token ausschließlich hier — im Kopf, nicht in der URL. */
export function baueKopfzeilen(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/* --- Antwort deuten -------------------------------------------------------- */

/**
 * Übersetzt einen HTTP-Status in eine Handlungsanweisung.
 *
 * 409 und 422-mit-`sha` sind der **Konflikt**: drüben liegt etwas anderes, als
 * wir beim Lesen gesehen haben. Andere 422 (etwa kaputtes base64) sind kein
 * Konflikt und werden nicht als solcher gemeldet.
 *
 * Die `fehler`-Texte sind für Menschen und enthalten **nie** das Token.
 *
 * @returns {{art: 'ok'|'konflikt'|'token'|'limit'|'nicht_gefunden'|'unbekannt', fehler: string|null}}
 */
export function klassifiziere(status, koerper = '') {
  if (status >= 200 && status < 300) return { art: 'ok', fehler: null };

  if (status === 401) {
    return {
      art: 'token',
      fehler: 'GitHub nimmt das Token nicht an. Es ist abgelaufen, widerrufen oder falsch kopiert.',
    };
  }
  if (status === 403) {
    if (/rate limit/i.test(koerper)) {
      return { art: 'limit', fehler: 'GitHub bremst gerade (Anfragelimit). Später noch einmal versuchen.' };
    }
    return {
      art: 'token',
      fehler: 'Das Token darf dieses Repo nicht lesen oder schreiben. Fehlt die Berechtigung „Contents: Read and write"?',
    };
  }
  if (status === 404) {
    return {
      art: 'nicht_gefunden',
      fehler: 'Repo oder Datei nicht gefunden. Stimmt „owner/name", und hat das Token Zugriff darauf?',
    };
  }
  if (status === 409 || (status === 422 && /sha/i.test(koerper))) {
    return {
      art: 'konflikt',
      fehler: 'Drüben liegt inzwischen eine andere Fassung. Es wurde nichts überschrieben.',
    };
  }
  return { art: 'unbekannt', fehler: `GitHub hat mit ${status} geantwortet.` };
}

/* --- Der Netzrand ---------------------------------------------------------- */

/**
 * Baut den Zugriff auf die Contents-API.
 *
 * @param {object} [optionen]
 * @param {Function} [optionen.fetchFn]  injizierbar für Tests
 * @param {string}   [optionen.basisUrl]
 * @param {number}   [optionen.timeoutMs]
 * @returns {{hole: Function, lege: Function}}
 */
export function erstelleSync({
  fetchFn = globalThis.fetch,
  basisUrl = VORGABE_BASIS_URL,
  timeoutMs = VORGABE_ZEITLIMIT_MS,
} = {}) {
  /**
   * Eine Anfrage mit Zeitlimit. Fängt alles ab und wirft nie — ein fehlendes
   * Netz ist ein Fall, kein Ausnahmezustand.
   */
  async function anfrage(url, optionen = {}) {
    const abbruch = new AbortController();
    const wecker = setTimeout(() => abbruch.abort(), timeoutMs);
    try {
      const antwort = await fetchFn(url, { ...optionen, signal: abbruch.signal });
      return { status: antwort.status, text: await antwort.text() };
    } catch (e) {
      if (e?.name === 'AbortError') {
        return { status: 0, text: '', netzfehler: 'GitHub hat nicht geantwortet (Zeitüberschreitung).' };
      }
      return { status: 0, text: '', netzfehler: 'Kein Netz — GitHub ist nicht erreichbar. Die App läuft weiter aus dem Speicher dieses Geräts.' };
    } finally {
      clearTimeout(wecker);
    }
  }

  /** Liest eine Datei. `{ok:true, inhalt, sha}` — oder `{ok:false, fehlt?:true, fehler}`. */
  async function hole({ token, repo, pfad }) {
    if (!istRepoName(repo)) return { ok: false, fehler: 'Kein gültiges Repo angegeben (erwartet: owner/name).' };
    if (!token) return { ok: false, fehler: 'Es ist kein Token hinterlegt.' };

    const { status, text, netzfehler } = await anfrage(baueContentsUrl(repo, pfad, basisUrl), {
      headers: baueKopfzeilen(token),
    });
    if (netzfehler) return { ok: false, fehler: netzfehler };

    const k = klassifiziere(status, text);
    if (k.art === 'nicht_gefunden') return { ok: false, fehlt: true, fehler: k.fehler };
    if (k.art !== 'ok') return { ok: false, art: k.art, fehler: k.fehler };

    let daten;
    try {
      daten = JSON.parse(text);
    } catch {
      return { ok: false, fehler: 'GitHub hat keine lesbare Antwort geliefert.' };
    }
    if (Array.isArray(daten)) {
      return { ok: false, fehler: `"${pfad}" ist drüben ein Verzeichnis, keine Datei.` };
    }
    if (!daten.content && daten.size > 0) {
      return { ok: false, fehler: `"${pfad}" ist zu groß für die Contents-API (${daten.size} Bytes).` };
    }

    return { ok: true, inhalt: dekodiereBase64(daten.content ?? ''), sha: daten.sha ?? null };
  }

  /**
   * Schreibt eine Datei. `sha` ist der zuletzt gelesene Stand; passt er nicht
   * mehr, antwortet GitHub mit 409/422 und wir melden einen Konflikt, statt zu
   * überschreiben. Ohne `sha` wird die Datei angelegt — existiert sie dann
   * schon, kommt genau derselbe Konflikt zurück.
   */
  async function lege({ token, repo, pfad, inhalt, sha, nachricht }) {
    if (!istRepoName(repo)) return { ok: false, fehler: 'Kein gültiges Repo angegeben (erwartet: owner/name).' };
    if (!token) return { ok: false, fehler: 'Es ist kein Token hinterlegt.' };

    const groesse = byteLaenge(inhalt);
    if (groesse > MAX_BYTE) {
      return { ok: false, fehler: `Der Stand ist ${Math.round(groesse / 1024)} KB groß — die Contents-API nimmt höchstens 1 MB.` };
    }

    const koerper = { message: nachricht || 'packliste: Stand sichern', content: kodiereBase64(inhalt) };
    if (sha) koerper.sha = sha;

    const { status, text, netzfehler } = await anfrage(baueContentsUrl(repo, pfad, basisUrl), {
      method: 'PUT',
      headers: { ...baueKopfzeilen(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    if (netzfehler) return { ok: false, fehler: netzfehler };

    const k = klassifiziere(status, text);
    if (k.art === 'konflikt') return { ok: false, konflikt: true, fehler: k.fehler };
    if (k.art !== 'ok') return { ok: false, art: k.art, fehler: k.fehler };

    try {
      return { ok: true, sha: JSON.parse(text)?.content?.sha ?? null };
    } catch {
      return { ok: true, sha: null };
    }
  }

  return { hole, lege };
}

/* --- Die beiden Datensätze ------------------------------------------------- */

/**
 * Holt den Katalog und prüft ihn, bevor er übernommen wird (US-09).
 * `sync` ist der Netzrand aus `erstelleSync` — hier nur durchgereicht.
 *
 * @returns {{ok: boolean, katalog?: object, statistik?: object, sha?: string, fehlt?: boolean, fehler?: string, fehlerListe?: string[]}}
 */
export async function holeKatalog({ sync, token, repo, pfad = 'katalog.json' }) {
  const gelesen = await sync.hole({ token, repo, pfad });
  if (!gelesen.ok) return gelesen;

  let rohdaten;
  try {
    rohdaten = JSON.parse(gelesen.inhalt);
  } catch {
    return { ok: false, fehler: `"${pfad}" drüben ist keine gültige JSON-Datei.` };
  }

  const geprueft = validiereKatalog(rohdaten);
  if (!geprueft.ok) {
    return { ok: false, fehler: `Der Katalog drüben ist unbrauchbar.`, fehlerListe: geprueft.fehler };
  }
  return { ok: true, katalog: geprueft.katalog, statistik: geprueft.statistik, sha: gelesen.sha };
}

/** Holt Reisen und Packlisten und prüft sie. */
export async function holeReisen({ sync, token, repo, pfad = 'reisen.json' }) {
  const gelesen = await sync.hole({ token, repo, pfad });
  if (!gelesen.ok) return gelesen;

  let rohdaten;
  try {
    rohdaten = JSON.parse(gelesen.inhalt);
  } catch {
    return { ok: false, fehler: `"${pfad}" drüben ist keine gültige JSON-Datei.` };
  }

  const geprueft = validiereDaten(rohdaten);
  if (!geprueft.ok) {
    return { ok: false, fehler: 'Die Reise-Datei drüben ist unbrauchbar.', fehlerListe: geprueft.fehler };
  }
  return { ok: true, daten: geprueft.daten, sha: gelesen.sha };
}

/**
 * Schreibt Reisen und Packlisten. Der Ablauf ist bewusst **lesen → schreiben**:
 * die `sha` kommt immer aus einem frischen Lesevorgang, nie aus einem
 * Gedächtnis, das nach einer iOS-Räumung ohnehin weg wäre.
 *
 * Geprüft wird **vor** dem Schreiben, und zwar hier statt beim Aufrufer: drüben
 * liegt nach dem Push nur diese eine Fassung, und `holeReisen` würde eine
 * unbrauchbare ablehnen — ein kaputter Push nähme also jedem Gerät den Weg
 * zurück. `ladeDaten` prüft nur die Feldtypen, nicht die `id` jeder Reise.
 *
 * @param {object} daten — der vollständige Stand, der drüben landen soll
 */
export async function schiebeReisen({ sync, token, repo, pfad = 'reisen.json', daten, sha, nachricht }) {
  const geprueft = validiereDaten(daten);
  if (!geprueft.ok) {
    return { ok: false, fehler: 'Der Stand auf diesem Gerät ist unbrauchbar — es wurde nichts hochgeschoben.', fehlerListe: geprueft.fehler };
  }

  const sauber = geprueft.daten;
  const inhalt = `${JSON.stringify({ version: sauber.version, reisen: sauber.reisen, packlisten: sauber.packlisten }, null, 2)}\n`;
  return sync.lege({ token, repo, pfad, inhalt, sha, nachricht: nachricht ?? 'packliste: Reisen sichern' });
}
