/**
 * syncUi.js — Katalog und Reisen über GitHub (PRD §4.5).
 *
 * Die Netzlogik liegt in `sync.js` und weiß von nichts Buntem; hier kommt die
 * Bedienung dazu: Einstellungen, die drei Handgriffe und der Konfliktfall.
 *
 * Drei Regeln aus dem Entwurf gelten auch hier:
 *
 *  1. **Das Token wird nie ins DOM zurückgeschrieben.** Das Feld bleibt leer,
 *     der Hinweis sagt nur, *dass* eines hinterlegt ist. Es steht damit in
 *     keinem gerenderten HTML, in keinem Screenshot und in keinem Verlauf.
 *  2. **Hochschieben fragt nach, bevor es etwas löscht.** Drüben kann eine Reise
 *     liegen, die es hier nicht gibt — die `sha` fängt nur gleichzeitige
 *     Schreibvorgänge ab, nicht eine früher angelegte Reise des zweiten Geräts.
 *  3. **Der Sync blockiert nie.** Fehlt das Netz, kommt ein Satz und die App
 *     läuft aus dem `localStorage` weiter — gepackt wird unterwegs ohne Netz.
 */

import { h, karte, feld } from './dom.js';
import {
  ladeSync,
  speichereSync,
  loescheToken,
  tokenHinterlegt,
  speichereKatalog,
  fuegeReisenZusammen,
} from '../store.js';
import { erstelleSync, holeKatalog, holeReisen, schiebeReisen } from '../sync.js';

/**
 * Der Netzrand wird einmal gebaut und dann geteilt. Lazy, damit beim Import
 * nichts passiert und Tests ihn gar nicht erst anfassen.
 */
let rand = null;
function netz() {
  return (rand ??= erstelleSync());
}

/** Der Vorspann: ohne Repo und Token gibt es nichts zu tun. */
function bereit(aktionen) {
  const { repo, token } = ladeSync();
  if (!repo || !token) {
    aktionen.melde('Erst Repo und Token unter „Synchronisierung" eintragen.', 'fehler');
    aktionen.render();
    return null;
  }
  return { repo, token };
}

/** Eine fehlgeschlagene Antwort als Meldung — mit Fehlerliste, wenn es eine gibt. */
function meldeFehler(aktionen, r, was) {
  if (r?.fehlerListe?.length) {
    aktionen.zeigeFehler(r.fehlerListe, `${was} ging nicht`);
    return;
  }
  aktionen.melde(`${was} ging nicht. ${r?.fehler ?? ''}`.trim(), 'fehler');
}

/* --- Die drei Handgriffe --------------------------------------------------- */

/** Katalog holen. Geprüft wird vor dem Übernehmen — wie beim Datei-Import (US-09). */
export async function zieheKatalog(aktionen) {
  const konf = bereit(aktionen);
  if (!konf) return;

  await aktionen.lade('Katalog wird geholt …', async () => {
    const r = await holeKatalog({ sync: netz(), ...konf });
    if (!r.ok) return meldeFehler(aktionen, r, 'Katalog holen');

    if (!speichereKatalog(r.katalog)) {
      return aktionen.melde('Der Katalog konnte nicht gespeichert werden — der Speicher des Browsers ist voll oder gesperrt.', 'fehler');
    }
    aktionen.setzeKatalog(r.katalog);
    aktionen.melde(`Katalog geholt: ${r.statistik.items} Items, ${r.statistik.kategorien} Kategorien.`, 'ok');
  });
}

/**
 * Reisen hochschieben: erst lesen, dann schreiben.
 *
 * Der Lesevorgang dient nicht dem Mischen — geschrieben wird der hiesige Stand
 * unverändert —, sondern zwei Dingen: der frischen `sha` (ohne sie wäre jeder
 * Konflikt ein 422 ohne Bedeutung) und der Frage, ob drüben etwas liegt, das
 * hier fehlt.
 */
export async function schiebeReisenStand(aktionen, daten, { erzwingen = false } = {}) {
  const konf = bereit(aktionen);
  if (!konf) return;

  await aktionen.lade('Reisen werden hochgeschoben …', async () => {
    const fremd = await holeReisen({ sync: netz(), ...konf });
    let sha = null;

    if (fremd.fehlt) {
      sha = null; // drüben gibt es noch keine Datei — der erste Push legt sie an
    } else if (fremd.ok) {
      sha = fremd.sha;
      if (!erzwingen) {
        const hier = new Set(daten.reisen.map((r) => r.id));
        const nurDrueben = fremd.daten.reisen.filter((r) => !hier.has(r.id));
        if (nurDrueben.length > 0) {
          const namen = nurDrueben.map((r) => `· ${r.name}`).join('\n');
          const weiter = confirm(
            `Drüben ${nurDrueben.length === 1 ? 'liegt eine Reise' : `liegen ${nurDrueben.length} Reisen`}, ` +
              `${nurDrueben.length === 1 ? 'die' : 'die'} es hier nicht gibt:\n\n${namen}\n\n` +
              'Hochschieben ersetzt sie. Stattdessen erst „Reisen holen"?'
          );
          if (!weiter) {
            aktionen.melde('Nichts hochgeschoben. Der Stand drüben ist unverändert.', 'info');
            return;
          }
        }
      }
    } else {
      // Nicht lesen heißt nicht wissen, was man überschreibt — dann lieber nicht.
      return meldeFehler(aktionen, fremd, 'Reisen hochschieben');
    }

    const r = await schiebeReisen({ sync: netz(), ...konf, daten, sha });
    if (r.ok) {
      aktionen.melde(`Hochgeschoben: ${daten.reisen.length} Reisen, ${daten.packlisten.length} Packlisten.`, 'ok');
      return;
    }
    if (r.konflikt) {
      aktionen.setzeKonflikt({ was: 'reisen', versucht: 'schieben' });
      aktionen.melde('Drüben liegt inzwischen eine andere Fassung. Es wurde nichts überschrieben.', 'warnung');
      return;
    }
    meldeFehler(aktionen, r, 'Reisen hochschieben');
  });
}

/**
 * Reisen holen. Zusammengeführt wird über die `id`: gleiche Reise ersetzt,
 * neue kommt dazu, hiesige bleibt. Damit kostet ein Holen nie eine Reise.
 */
export async function zieheReisen(aktionen, daten) {
  const konf = bereit(aktionen);
  if (!konf) return;

  await aktionen.lade('Reisen werden geholt …', async () => {
    const r = await holeReisen({ sync: netz(), ...konf });
    if (r.fehlt) {
      aktionen.melde('Drüben liegt noch keine Reise-Datei. Schieb zuerst von einem Gerät hoch.', 'info');
      return;
    }
    if (!r.ok) return meldeFehler(aktionen, r, 'Reisen holen');

    const { daten: zusammen, dazu } = fuegeReisenZusammen(daten, r.daten);
    aktionen.setzeDaten(zusammen);
    aktionen.melde(
      dazu === 0
        ? `Geholt: ${r.daten.reisen.length} Reisen — nichts Neues dabei.`
        : `Geholt: ${r.daten.reisen.length} Reisen, davon ${dazu} neu für dieses Gerät.`,
      'ok'
    );
  });
}

/* --- Der Konfliktfall ------------------------------------------------------ */

/** Von drüben holen — der hiesige Stand wird dabei zusammengeführt, nicht ersetzt. */
async function konfliktHolen(aktionen, daten) {
  aktionen.verwerfeKonflikt();
  aktionen.render();
  await zieheReisen(aktionen, daten);
}

/** Meinen Stand durchsetzen. Bewusst mit frischer `sha` — die Entscheidung ist gefallen. */
async function konfliktSchieben(aktionen, daten) {
  aktionen.verwerfeKonflikt();
  aktionen.render();
  await schiebeReisenStand(aktionen, daten, { erzwingen: true });
}

/* --- Karten ---------------------------------------------------------------- */

/**
 * Die Einstellungen. Das Token-Feld ist beim Rendern immer leer: der Wert aus
 * dem Speicher wird nie hineingeschrieben.
 */
export function karteSync({ aktionen, laden }) {
  const { repo } = ladeSync();
  const da = tokenHinterlegt();

  const repoFeld = h('input', {
    type: 'text',
    class: 'eingabe',
    value: repo,
    placeholder: 'owner/packliste-daten',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
  });

  const tokenFeld = h('input', {
    type: 'password',
    class: 'eingabe',
    value: '',
    placeholder: da ? '•••••••••••• (hinterlegt)' : 'github_pat_…',
    autocomplete: 'off',
    spellcheck: 'false',
  });

  return karte(
    'Synchronisierung',
    h(
      'p',
      { class: 'klein' },
      da
        ? 'Token hinterlegt. Es liegt nur in diesem Browser und wird nie angezeigt.'
        : 'Noch kein Token hinterlegt. Ohne Token läuft die App weiter — nur ohne Sync.'
    ),

    feld('Daten-Repo', repoFeld, 'Das private Repo, nicht dieses hier. Form: owner/name'),
    feld('Fein granuliertes Token', tokenFeld, da ? 'Leer lassen, um das hinterlegte zu behalten.' : 'Berechtigung „Contents: Read and write", nur für dieses eine Repo.'),

    h(
      'div',
      { class: 'knopf-reihe' },
      h(
        'button',
        {
          class: 'knopf knopf-haupt',
          disabled: Boolean(laden),
          onclick: () => {
            const neuesToken = tokenFeld.value.trim();
            if (!speichereSync({ repo: repoFeld.value, token: neuesToken === '' ? undefined : neuesToken })) {
              aktionen.melde('Der Browser lässt nichts speichern — die Einstellung ist nach dem Schließen weg.', 'fehler');
              aktionen.render();
              return;
            }
            tokenFeld.value = '';
            aktionen.melde(
              neuesToken === '' ? 'Repo gespeichert. Das Token ist unverändert.' : 'Repo und Token gespeichert.',
              'ok'
            );
            aktionen.render();
          },
        },
        'Speichern'
      ),
      da
        ? h(
            'button',
            {
              class: 'knopf knopf-gefahr',
              onclick: () => {
                if (!confirm('Token aus diesem Browser löschen? Der Sync geht danach nicht mehr, bis du ein neues einträgst.')) return;
                loescheToken();
                aktionen.melde('Token gelöscht. Der Katalog und die Reisen auf diesem Gerät bleiben.', 'info');
                aktionen.render();
              },
            },
            'Token löschen'
          )
        : null
    ),

    h(
      'p',
      { class: 'feld-hinweis' },
      'Das Token ist ein Passwort. Es liegt im localStorage dieses Browsers — wer das Gerät entsperrt in die Hand bekommt, kommt daran. ' +
        'Deshalb ein fein granuliertes Token mit Ablaufdatum, beschränkt auf das eine private Repo, und bei Verdacht: bei GitHub widerrufen.'
    )
  );
}

/** Der Konflikt: nichts wurde geschrieben, jetzt entscheidet der Mensch. */
export function karteKonflikt({ konflikt, daten, aktionen, laden }) {
  if (!konflikt) return null;

  return karte(
    'Konflikt — es wurde nichts überschrieben',
    h(
      'p',
      {},
      'Drüben liegt eine andere Fassung als die, die dieses Gerät zuletzt gesehen hat. ' +
        'Vermutlich wurde von einem zweiten Gerät geschoben. Beide Stände sind noch vollständig da.'
    ),
    h(
      'div',
      { class: 'knopf-reihe' },
      h(
        'button',
        {
          class: 'knopf knopf-haupt',
          disabled: Boolean(laden),
          onclick: () => konfliktHolen(aktionen, daten),
        },
        'Von drüben holen'
      ),
      h(
        'button',
        {
          class: 'knopf',
          disabled: Boolean(laden),
          onclick: () => konfliktSchieben(aktionen, daten),
        },
        'Meinen Stand hochschieben'
      ),
      h(
        'button',
        {
          class: 'knopf knopf-leise',
          disabled: Boolean(laden),
          onclick: () => {
            aktionen.verwerfeKonflikt();
            aktionen.melde('Nichts getan. Beide Stände sind unverändert.', 'info');
            aktionen.render();
          },
        },
        'Nichts tun'
      )
    ),
    h(
      'p',
      { class: 'feld-hinweis' },
      '„Von drüben holen" führt zusammen: gleiche Reise wird ersetzt, neue kommen dazu, hiesige bleiben. ' +
        '„Meinen Stand hochschieben" ersetzt, was drüben liegt.'
    )
  );
}
