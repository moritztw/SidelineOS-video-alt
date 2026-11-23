import type {
  JklGeschwindigkeit,
  PlayQuelle,
  Spielzug,
  SyncProblem,
  VideoReel,
} from '../types.ts';
import { FRAME_MS, frameZuZeit, zeitZuFrame } from './frameAndHotkeys.ts';

export const MIN_CLIP_DAUER_MS = 400;

/** Quantisiert Millisekunden sauber auf das 25fps-Frame-Raster (40 ms). */
export function quantisiereAufFrame(ms: number): number {
  return frameZuZeit(zeitZuFrame(ms));
}

/**
 * Berechnet die effektive Abspielposition eines Kamerawinkels relativ zur Master-Zeit.
 * Ein positiver `offset_ms` verschiebt die Sekundärkamera nach vorn.
 */
export function berechneSynchronisierteZeit(
  play: Spielzug,
  angle: string,
  masterZeitMs: number
): { verfuegbar: boolean; angleMs: number; inBereich: boolean; dauerMs: number } {
  const quelle = play.sources[angle];
  if (!quelle) {
    return { verfuegbar: false, angleMs: 0, inBereich: false, dauerMs: 0 };
  }

  const dauerMs = Math.max(0, quelle.end_ms - quelle.start_ms);
  const offset = quelle.offset_ms ?? 0;
  const zielRelativMs = masterZeitMs + offset;
  const inBereich = zielRelativMs >= 0 && zielRelativMs <= dauerMs;
  const geklemmtRelativ = Math.max(0, Math.min(dauerMs, zielRelativMs));

  return {
    verfuegbar: true,
    angleMs: quelle.start_ms + geklemmtRelativ,
    inBereich,
    dauerMs,
  };
}

/**
 * Setzt oder entfernt den optionalen Kamera-Offset für einen einzelnen Play-Winkel.
 */
export function setzeClipOffset(
  plays: Spielzug[],
  playNumber: number,
  angle: string,
  offsetMs: number,
  snapToFrame = true
): Spielzug[] {
  const bereinigt = snapToFrame ? quantisiereOffset(offsetMs) : Math.round(offsetMs);
  return plays.map((play) => {
    if (play.play_number !== playNumber) return play;
    const quelle = play.sources[angle];
    if (!quelle) return play;
    const neuQuelle: PlayQuelle = { ...quelle };
    if (bereinigt === 0) {
      delete neuQuelle.offset_ms;
    } else {
      neuQuelle.offset_ms = bereinigt;
    }
    return {
      ...play,
      sources: {
        ...play.sources,
        [angle]: neuQuelle,
      },
    };
  });
}

function quantisiereOffset(offsetMs: number): number {
  const gerundet = Math.round(offsetMs / FRAME_MS) * FRAME_MS;
  return Object.is(gerundet, -0) ? 0 : gerundet;
}

/**
 * Überträgt einen kalibrierten Offset auf das angegebene Play und alle nachfolgenden Plays.
 */
export function uebernehmeOffsetAufFolgePlays(
  plays: Spielzug[],
  abPlayNumber: number,
  angle: string,
  offsetMs: number,
  snapToFrame = true
): Spielzug[] {
  const bereinigt = snapToFrame ? quantisiereOffset(offsetMs) : Math.round(offsetMs);
  return plays.map((play) => {
    if (play.play_number < abPlayNumber) return play;
    const quelle = play.sources[angle];
    if (!quelle) return play;
    const neuQuelle: PlayQuelle = { ...quelle };
    if (bereinigt === 0) {
      delete neuQuelle.offset_ms;
    } else {
      neuQuelle.offset_ms = bereinigt;
    }
    return {
      ...play,
      sources: {
        ...play.sources,
        [angle]: neuQuelle,
      },
    };
  });
}

/**
 * Markiert einen fehlenden oder defekten Clip in einem Kamerawinkel als Lücke (`null`),
 * ohne den Master-Winkel oder die Breakdown-Daten des Plays zu löschen.
 */
export function entferneWinkelClip(
  plays: Spielzug[],
  playNumber: number,
  angle: string
): Spielzug[] {
  return plays.map((play) => {
    if (play.play_number !== playNumber) return play;
    if (!(angle in play.sources)) return play;
    return {
      ...play,
      sources: {
        ...play.sources,
        [angle]: null,
      },
    };
  });
}

/**
 * Tauscht den Clip eines Sekundärwinkels mit dem vorherigen (`-1`) oder nächsten (`1`) Play,
 * um verschobene Clip-Reihenfolgen nach einem verpassten Snap zu korrigieren.
 */
export function tauscheClipMitNachbar(
  plays: Spielzug[],
  playNumber: number,
  angle: string,
  richtung: -1 | 1
): Spielzug[] {
  const index = plays.findIndex((p) => p.play_number === playNumber);
  const zielIndex = index + richtung;
  if (index === -1 || zielIndex < 0 || zielIndex >= plays.length) {
    return plays;
  }

  const geklont = plays.map((p) => ({
    ...p,
    sources: { ...p.sources },
  }));

  const quelleA = geklont[index].sources[angle] ?? null;
  const quelleB = geklont[zielIndex].sources[angle] ?? null;
  geklont[index].sources[angle] = quelleB;
  geklont[zielIndex].sources[angle] = quelleA;

  return geklont;
}

/**
 * Analysiert alle Plays eines Reels auf Winkel-Lücken, aktive Offsets und Dauer-Abweichungen (> 2s).
 */
export function erkenneSyncProbleme(reel: VideoReel): SyncProblem[] {
  const probleme: SyncProblem[] = [];
  const masterAngle = reel.angles[0];

  for (const play of reel.plays) {
    const masterQuelle = masterAngle ? play.sources[masterAngle] : null;
    const masterDauer = masterQuelle ? masterQuelle.end_ms - masterQuelle.start_ms : 0;

    for (const angle of reel.angles) {
      const quelle = play.sources[angle];
      if (!quelle) {
        probleme.push({
          playNumber: play.play_number,
          angle,
          typ: 'MISSING_CLIP',
        });
        continue;
      }

      if (quelle.offset_ms !== undefined && quelle.offset_ms !== 0) {
        probleme.push({
          playNumber: play.play_number,
          angle,
          typ: 'OFFSET_APPLIED',
          detailMs: quelle.offset_ms,
        });
      }

      if (masterQuelle && angle !== masterAngle) {
        const winkelDauer = quelle.end_ms - quelle.start_ms;
        const diff = Math.abs(winkelDauer - masterDauer);
        if (diff > 2000) {
          probleme.push({
            playNumber: play.play_number,
            angle,
            typ: 'DURATION_MISMATCH',
            detailMs: diff,
          });
        }
      }
    }
  }

  return probleme;
}

const JKL_LEITER: readonly JklGeschwindigkeit[] = [-4, -2, -1, 0, 1, 2, 4];

/**
 * Berechnet die nächste NLE-Transportgeschwindigkeit für J (Rückwärts), K (Pause) und L (Vorwärts).
 */
export function berechneJklGeschwindigkeit(
  aktuell: JklGeschwindigkeit,
  taste: 'j' | 'k' | 'l'
): JklGeschwindigkeit {
  if (taste === 'k') return 0;
  if (taste === 'l') {
    if (aktuell <= 0) return 1;
    const idx = JKL_LEITER.indexOf(aktuell);
    return JKL_LEITER[Math.min(JKL_LEITER.length - 1, idx + 1)];
  }
  if (aktuell >= 0) return -1;
  const idx = JKL_LEITER.indexOf(aktuell);
  return JKL_LEITER[Math.max(0, idx - 1)];
}

/** Nummeriert geschnittene Plays sauber von 1..N neu durch. */
function nummerierePlaysNeu(plays: Spielzug[]): Spielzug[] {
  return plays.map((play, idx) => ({
    ...play,
    play_number: idx + 1,
  }));
}

/**
 * Erzeugt ein neues Time-Slice-Play im Fast-Cut-Editor (`I / O`) und sortiert chronologisch nach `start_ms`.
 */
export function schneideTimeSlicePlay(
  plays: Spielzug[],
  params: {
    inMs: number;
    outMs: number;
    angle: string;
    file: string;
    snapToFrame?: boolean;
  }
): { ok: boolean; plays: Spielzug[]; fehler?: string } {
  const snap = params.snapToFrame ?? true;
  const startMs = Math.max(0, snap ? quantisiereAufFrame(params.inMs) : Math.round(params.inMs));
  const endMs = Math.max(0, snap ? quantisiereAufFrame(params.outMs) : Math.round(params.outMs));

  if (endMs <= startMs) {
    return {
      ok: false,
      plays,
      fehler: 'Out-Punkt muss nach dem In-Punkt liegen.',
    };
  }

  if (endMs - startMs < MIN_CLIP_DAUER_MS) {
    return {
      ok: false,
      plays,
      fehler: `Mindestlänge eines Schnitts beträgt ${MIN_CLIP_DAUER_MS} ms.`,
    };
  }

  const neuesPlay: Spielzug = {
    play_number: plays.length + 1,
    sources: {
      [params.angle]: {
        file: params.file,
        source_mode: 'TIME_SLICE',
        start_ms: startMs,
        end_ms: endMs,
      },
    },
    breakdown: {},
  };

  const sortiert = [...plays, neuesPlay].sort((a, b) => {
    const startA = a.sources[params.angle]?.start_ms ?? Object.values(a.sources).find(Boolean)?.start_ms ?? 0;
    const startB = b.sources[params.angle]?.start_ms ?? Object.values(b.sources).find(Boolean)?.start_ms ?? 0;
    return startA - startB;
  });

  return {
    ok: true,
    plays: nummerierePlaysNeu(sortiert),
  };
}

/**
 * Aktualisiert In-/Out-Zeitstempel eines bestehenden Time-Slice-Plays.
 */
export function aktualisierePlaySchnitt(
  plays: Spielzug[],
  playNumber: number,
  angle: string,
  inMs: number,
  outMs: number
): { ok: boolean; plays: Spielzug[]; fehler?: string } {
  const startMs = Math.max(0, quantisiereAufFrame(inMs));
  const endMs = Math.max(0, quantisiereAufFrame(outMs));

  if (endMs - startMs < MIN_CLIP_DAUER_MS) {
    return {
      ok: false,
      plays,
      fehler: `Mindestlänge eines Schnitts beträgt ${MIN_CLIP_DAUER_MS} ms.`,
    };
  }

  const aktualisiert = plays.map((play) => {
    if (play.play_number !== playNumber) return play;
    const quelle = play.sources[angle];
    if (!quelle) return play;
    return {
      ...play,
      sources: {
        ...play.sources,
        [angle]: {
          ...quelle,
          start_ms: startMs,
          end_ms: endMs,
        },
      },
    };
  });

  return { ok: true, plays: aktualisiert };
}

/**
 * Entfernt ein geschnittenes Play und nummeriert die verbleibenden Plays sauber neu.
 */
export function loescheGeschnittenesPlay(plays: Spielzug[], playNumber: number): Spielzug[] {
  return nummerierePlaysNeu(plays.filter((p) => p.play_number !== playNumber));
}
