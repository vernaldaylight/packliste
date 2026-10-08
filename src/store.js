/**
 * store.js — Persistenz (PRD §4.5).
 *
 * Kein Server, keine Datenbank, keine Konten. Zwei Datensätze mit sehr
 * verschiedenem Lebenslauf, beide im localStorage des Geräts:
 *
 *   katalog.json  ->  localStorage['packliste.katalog']      (Master im git)
 *   Reisen        ->  localStorage['packliste.reisen']       (nirgends sonst)
 *
 * Getrennt gehalten, damit ein schiefgelaufener Schreibvorgang auf einer
 * Packliste den Katalog nicht beschädigen kann (PRD §4.5).
 *
 * Vor jedem Schreiben wird die Vorgängerversion als Backup gesichert (PRD §9).
 */

import { KATEGORIEN } from './engine.js';

export const SCHLUESSEL = {
  katalog: 'packliste.katalog',
  daten: 'packliste.reisen',
  backupKatalog: 'packliste.katalog.backup',
  backupDaten: 'packliste.reisen.backup',
  // Synchronisierung (PRD §4.5). Getrennt in Einstellung und Zustand, damit
  // sich das Token löschen lässt, ohne das Repo zu vergessen.
  sync: 'packliste.sync',
  syncStand: 'packliste.sync.stand',
};

const DATEN_VERSION = 1;

/* --- localStorage, der auch dann nicht wirft, wenn er gesperrt ist --------- */

/**
 * Safari im privaten Modus und geräumter Storage lassen `localStorage` werfen.
 * Jeder Zugriff läuft deshalb durch diese Hülle: die App zeigt dann einen
 * Hinweis, statt beim ersten Klick auseinanderzufliegen.
 */
function lies(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function schreib(key, wert) {
  try {
    localStorage.setItem(key, wert);
    return true;
  } catch {
    return false;
  }
}

export function speicherVerfuegbar() {
  try {
    const probe = '__packliste_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/* --- Katalog (F13 / US-09) ------------------------------------------------- */

/**
 * Prüft eine Katalog-Datei, bevor sie übernommen wird (US-09).
 * Geprüft werden Format, `version` und die Pflichtfelder.
 *
 * Gibt IMMER zurück, statt zu werfen: der Aufrufer zeigt die Fehlerliste an und
 * lässt den bestehenden Katalog unangetastet.
 *
 * @returns {{ok: boolean, fehler: string[], katalog: object|null, statistik: object|null}}
 */
export function validiereKatalog(rohdaten) {
  const fehler = [];

  if (rohdaten === null || typeof rohdaten !== 'object' || Array.isArray(rohdaten)) {
    return { ok: false, fehler: ['Die Datei enthält kein JSON-Objekt.'], katalog: null, statistik: null };
  }
  if (typeof rohdaten.version !== 'number') {
    fehler.push('Feld "version" fehlt oder ist keine Zahl — das sieht nicht nach einer Katalog-Datei aus.');
  }
  if (!Array.isArray(rohdaten.items)) {
    fehler.push('Feld "items" fehlt oder ist keine Liste.');
    return { ok: false, fehler, katalog: null, statistik: null };
  }
  if (rohdaten.items.length === 0) {
    fehler.push('Die Datei enthält keine Items.');
  }

  const gesehen = new Set();
  rohdaten.items.forEach((item, i) => {
    const wo = item?.name ? `"${item.name}"` : `Item #${i + 1}`;
    if (!item || typeof item !== 'object') {
      fehler.push(`${wo}: kein Objekt.`);
      return;
    }
    if (typeof item.id !== 'string' || item.id.length === 0) fehler.push(`${wo}: id fehlt.`);
    else if (gesehen.has(item.id)) fehler.push(`${wo}: doppelte id "${item.id}".`);
    else gesehen.add(item.id);

    if (typeof item.name !== 'string' || item.name.length === 0) fehler.push(`${wo}: name fehlt.`);
    if (typeof item.kategorie !== 'string' || item.kategorie.length === 0) fehler.push(`${wo}: kategorie fehlt.`);
    if (!Array.isArray(item.tags)) fehler.push(`${wo}: tags fehlen.`);
    if (!item.menge || typeof item.menge !== 'object' || typeof item.menge.art !== 'string') {
      fehler.push(`${wo}: menge fehlt.`);
    } else if (!['einmal', 'fest', 'pro_tage'].includes(item.menge.art)) {
      fehler.push(`${wo}: unbekannte Mengenregel "${item.menge.art}".`);
    }
    if (item.nicht_mit !== undefined && !Array.isArray(item.nicht_mit)) fehler.push(`${wo}: nicht_mit ist keine Liste.`);
  });

  if (fehler.length) return { ok: false, fehler, katalog: null, statistik: null };

  const katalog = {
    version: rohdaten.version,
    items: rohdaten.items.map((i) => ({
      id: i.id,
      name: i.name,
      kategorie: i.kategorie,
      tags: i.tags,
      menge: i.menge,
      nicht_mit: i.nicht_mit ?? [],
      im_besitz: i.im_besitz ?? true,
      ...(i.notiz ? { notiz: i.notiz } : {}),
    })),
  };

  return { ok: true, fehler: [], katalog, statistik: katalogStatistik(katalog) };
}

/** Kennzahlen für die Bestätigung nach dem Import (US-09). */
export function katalogStatistik(katalog) {
  const items = katalog?.items ?? [];
  const regeln = { einmal: 0, fest: 0, pro_tage: 0 };
  const kategorien = new Map();
  const tags = new Set();

  for (const i of items) {
    if (regeln[i.menge?.art] !== undefined) regeln[i.menge.art]++;
    kategorien.set(i.kategorie, (kategorien.get(i.kategorie) ?? 0) + 1);
    for (const t of i.tags ?? []) tags.add(t);
  }

  return {
    items: items.length,
    kategorien: kategorien.size,
    kategorienListe: [...kategorien.entries()].sort(
      (a, b) => rang(a[0]) - rang(b[0]) || a[0].localeCompare(b[0], 'de')
    ),
    tags: tags.size,
    regeln,
    // "Katalog-Abdeckung" (PRD §10): Anteil der Items mit gepflegter Mengenregel
    gepflegt: regeln.fest + regeln.pro_tage,
  };
}

function rang(k) {
  const i = KATEGORIEN.indexOf(k);
  return i === -1 ? KATEGORIEN.length : i;
}

export function ladeKatalog() {
  const roh = lies(SCHLUESSEL.katalog);
  if (!roh) return null;
  try {
    const geprueft = validiereKatalog(JSON.parse(roh));
    if (!geprueft.ok) {
      console.warn('Gespeicherter Katalog ist unbrauchbar:', geprueft.fehler);
      return null;
    }
    return geprueft.katalog;
  } catch {
    return null;
  }
}

/**
 * Übernimmt einen geprüften Katalog. Die Vorgängerversion wandert vorher ins
 * Backup, damit ein Fehlimport zurücknehmbar ist.
 */
export function speichereKatalog(katalog) {
  const alt = lies(SCHLUESSEL.katalog);
  if (alt) schreib(SCHLUESSEL.backupKatalog, alt);
  return schreib(SCHLUESSEL.katalog, JSON.stringify(katalog));
}

export function entferneKatalog() {
  const alt = lies(SCHLUESSEL.katalog);
  if (alt) schreib(SCHLUESSEL.backupKatalog, alt);
  try {
    localStorage.removeItem(SCHLUESSEL.katalog);
  } catch {
    /* egal */
  }
}

export function katalogBackupVorhanden() {
  return Boolean(lies(SCHLUESSEL.backupKatalog));
}

/* --- Reisen und Packlisten ------------------------------------------------- */

export function leereDaten() {
  return { version: DATEN_VERSION, reisen: [], packlisten: [] };
}

export function ladeDaten() {
  const roh = lies(SCHLUESSEL.daten);
  if (!roh) return leereDaten();
  try {
    const d = JSON.parse(roh);
    if (!d || typeof d !== 'object') return leereDaten();
    return {
      version: d.version ?? DATEN_VERSION,
      reisen: Array.isArray(d.reisen) ? d.reisen : [],
      packlisten: Array.isArray(d.packlisten) ? d.packlisten : [],
    };
  } catch {
    return leereDaten();
  }
}

/**
 * Schreibt Reisen und Packlisten. Die Vorgängerversion wird als Backup
 * gesichert (PRD §9) — das ist der Notausgang, wenn ein Schreibvorgang
 * schiefgeht.
 */
export function speichereDaten(daten) {
  const alt = lies(SCHLUESSEL.daten);
  if (alt) schreib(SCHLUESSEL.backupDaten, alt);
  const ok = schreib(SCHLUESSEL.daten, JSON.stringify({ ...daten, version: DATEN_VERSION }));
  if (!ok) throw new Error('Der Speicher des Browsers ist voll oder gesperrt. Bitte die Reisen als Datei exportieren.');
  return true;
}

export function datenBackupVorhanden() {
  return Boolean(lies(SCHLUESSEL.backupDaten));
}

/** Prüft eine Reise-Datei, bevor sie einen bestehenden Bestand ersetzt. */
export function validiereDaten(rohdaten) {
  const fehler = [];
  if (!rohdaten || typeof rohdaten !== 'object' || Array.isArray(rohdaten)) {
    return { ok: false, fehler: ['Die Datei enthält kein JSON-Objekt.'], daten: null };
  }
  if (!Array.isArray(rohdaten.reisen)) fehler.push('Feld "reisen" fehlt oder ist keine Liste.');
  if (rohdaten.packlisten !== undefined && !Array.isArray(rohdaten.packlisten)) {
    fehler.push('Feld "packlisten" ist keine Liste.');
  }
  if (fehler.length) return { ok: false, fehler, daten: null };

  for (const [i, r] of rohdaten.reisen.entries()) {
    if (!r?.id) fehler.push(`Reise #${i + 1}: id fehlt.`);
    if (!r?.name) fehler.push(`Reise #${i + 1}: name fehlt.`);
  }
  if (fehler.length) return { ok: false, fehler, daten: null };

  return {
    ok: true,
    fehler: [],
    daten: {
      version: rohdaten.version ?? DATEN_VERSION,
      reisen: rohdaten.reisen,
      packlisten: rohdaten.packlisten ?? [],
    },
  };
}

/**
 * Führt zwei Bestände über die `id` zusammen — die Logik aus dem Datei-Import
 * (US-10), jetzt auch für den Sync (PRD §4.5) statt zweimal daneben.
 *
 * Bewusst **keine** Feld-Merge-Regel und kein Zeitstempel im Datenmodell:
 * gleiche `id` wird ersetzt, alles andere angehängt. Reisen entstehen nur am
 * Handy (Stufe A, PRD §3.4) — es gibt also keinen Fall, in dem zwei Fassungen
 * derselben Reise feldweise zu mischen wären. Ob drüben inzwischen etwas anderes
 * liegt, erkennt der Sync über die `sha` der Contents-API, nicht über die Daten.
 *
 * Eine Packliste gehört zu genau einer Reise und wird als Ganzes ersetzt, nicht
 * positionenweise gemischt — sonst verlöre man beim Holen den Abhak-Stand.
 * Kommt eine Reise ohne Packliste herein, bleibt die hiesige erhalten.
 *
 * @returns {{daten: object, dazu: number}} `dazu` = Zahl der neuen Reisen
 */
export function fuegeReisenZusammen(bestand, neu) {
  const nachId = new Map((bestand?.reisen ?? []).map((r) => [r.id, r]));

  let dazu = 0;
  for (const r of neu?.reisen ?? []) {
    if (!nachId.has(r.id)) dazu++;
    nachId.set(r.id, r);
  }

  const ersetzteListeIds = new Set((neu?.packlisten ?? []).map((p) => p.reise_id));
  const behalteneListen = (bestand?.packlisten ?? []).filter((p) => !ersetzteListeIds.has(p.reise_id));

  return {
    daten: {
      version: DATEN_VERSION,
      reisen: [...nachId.values()],
      packlisten: [...behalteneListen, ...(neu?.packlisten ?? [])],
    },
    dazu,
  };
}

/* --- Dateien: rein und raus (US-09, US-10) --------------------------------- */

/** Liest eine vom Nutzer ausgewählte Datei als JSON. */
export async function leseJsonDatei(datei) {
  const text = await datei.text();
  try {
    return { ok: true, daten: JSON.parse(text) };
  } catch {
    return { ok: false, fehler: [`"${datei.name}" ist keine gültige JSON-Datei.`] };
  }
}

/**
 * Gibt eine Datei ans Teilen-Menü des Systems (US-10, PRD §3.6).
 *
 * Am Handy öffnet `navigator.share` das Share-Sheet, in dem iCloud Drive,
 * AirDrop und Mail ohne Zusatzarbeit wählbar sind. Wo das nicht geht (Desktop-
 * Browser ohne Share-Unterstützung), fällt es auf einen normalen Download
 * zurück — derselbe Inhalt, nur ein anderer Weg.
 *
 * @returns {'geteilt'|'abgebrochen'|'heruntergeladen'|'fehler'}
 */
export async function teileDatei(inhalt, dateiname, titel) {
  const datei = new File([inhalt], dateiname, { type: 'application/json' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: titel });
      return 'geteilt';
    } catch (e) {
      // Abbruch durch den Nutzer ist kein Fehler.
      if (e?.name === 'AbortError') return 'abgebrochen';
      // Sonst auf den Downloadweg ausweichen.
    }
  }

  try {
    const url = URL.createObjectURL(datei);
    const a = document.createElement('a');
    a.href = url;
    a.download = dateiname;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'heruntergeladen';
  } catch {
    return 'fehler';
  }
}

/** Kopiert Text in die Zwischenablage (US-07). */
export async function inZwischenablage(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback für ältere/ungesicherte Kontexte
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* --- Synchronisierung (PRD §4.5) ------------------------------------------- */

/**
 * Die Einstellung des Sync: Repo und Token.
 *
 * Das Token liegt ausschließlich hier — nie im Code, nie im Build, nie in einer
 * Meldung. Wer das Gerät in die Hand bekommt oder den Storage ausliest, kommt
 * daran; deshalb ist es ein fein granuliertes PAT, das auf genau ein privates
 * Repo beschränkt ist und sich widerrufen lässt (PRD §11).
 *
 * @returns {{repo: string, token: string}}
 */
export function ladeSync() {
  const roh = lies(SCHLUESSEL.sync);
  if (!roh) return { repo: '', token: '' };
  try {
    const s = JSON.parse(roh);
    return {
      repo: typeof s?.repo === 'string' ? s.repo : '',
      token: typeof s?.token === 'string' ? s.token : '',
    };
  } catch {
    return { repo: '', token: '' };
  }
}

/**
 * Schreibt die Einstellung. Ein fehlendes `token` (undefined) lässt das
 * hinterlegte stehen — sonst würde ein reines Repo-Speichern das Token löschen.
 *
 * Weil der gemerkte `sha` zu einem Repo gehört, wird er hier verworfen: nach
 * einem Repo-Wechsel wäre er falsch und ein gewöhnlicher Push sähe wie ein
 * Konflikt aus.
 */
export function speichereSync({ repo, token }) {
  const alt = ladeSync();
  const neu = {
    repo: String(repo ?? '').trim(),
    token: token === undefined ? alt.token : String(token ?? '').trim(),
  };
  const ok = schreib(SCHLUESSEL.sync, JSON.stringify(neu));
  if (ok) {
    try {
      localStorage.removeItem(SCHLUESSEL.syncStand);
    } catch {
      /* egal */
    }
  }
  return ok;
}

/** Löscht nur das Token; das Repo bleibt, damit es nicht neu getippt werden muss. */
export function loescheToken() {
  const { repo } = ladeSync();
  return speichereSync({ repo, token: '' });
}

export function tokenHinterlegt() {
  return ladeSync().token.length > 0;
}

/**
 * Der zuletzt gesehene `sha` je Datensatz — die Konfliktbremse (PRD §4.5).
 * `art` ist 'katalog' oder 'reisen'.
 *
 * Geht verloren, wenn iOS den Storage räumt (§4.5). Dann holt der Sync die
 * `sha` vor dem Schreiben per GET nach — sonst antwortet die API mit 422 statt
 * mit einem erkennbaren Konflikt.
 */
export function ladeSyncStand(art) {
  const roh = lies(SCHLUESSEL.syncStand);
  if (!roh) return null;
  try {
    const stand = JSON.parse(roh)?.[art];
    return stand && typeof stand.sha === 'string' ? stand : null;
  } catch {
    return null;
  }
}

export function speichereSyncStand(art, stand) {
  let bisher = {};
  try {
    bisher = JSON.parse(lies(SCHLUESSEL.syncStand) ?? '{}') ?? {};
  } catch {
    bisher = {};
  }
  bisher[art] = { sha: String(stand?.sha ?? ''), zeit: stand?.zeit ?? new Date().toISOString() };
  return schreib(SCHLUESSEL.syncStand, JSON.stringify(bisher));
}

/* --- Kleinkram ------------------------------------------------------------- */

export function neueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Dateiname mit Datum, damit Backups sich nicht überschreiben. */
export function zeitstempel() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
