import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aktualisierePlaySchnitt,
  berechneJklGeschwindigkeit,
  berechneSynchronisierteZeit,
  entferneWinkelClip,
  erkenneSyncProbleme,
  loescheGeschnittenesPlay,
  schneideTimeSlicePlay,
  setzeClipOffset,
  tauscheClipMitNachbar,
  uebernehmeOffsetAufFolgePlays,
} from '../../src/services/cutSyncEngine.ts';
import type { Spielzug, VideoReel } from '../../src/types.ts';

function erstelleMultiAnglePlays(): Spielzug[] {
  return [
    {
      play_number: 1,
      sources: {
        SIDELINE: { file: 'sl_1.mp4', source_mode: 'CLIP_FILE', start_ms: 0, end_ms: 8000 },
        ENDZONE: {
          file: 'ez_1.mp4',
          source_mode: 'CLIP_FILE',
          start_ms: 0,
          end_ms: 8000,
          offset_ms: 320,
        },
      },
    },
    {
      play_number: 2,
      sources: {
        SIDELINE: { file: 'sl_2.mp4', source_mode: 'CLIP_FILE', start_ms: 0, end_ms: 8500 },
        ENDZONE: { file: 'ez_2.mp4', source_mode: 'CLIP_FILE', start_ms: 0, end_ms: 5000 },
      },
    },
    {
      play_number: 3,
      sources: {
        SIDELINE: { file: 'sl_3.mp4', source_mode: 'CLIP_FILE', start_ms: 0, end_ms: 7000 },
        ENDZONE: null,
      },
    },
  ];
}

describe('Multi-Angle Sync Engine (CLIP_FILE)', () => {
  it('berechnet synchronisierte Zeit mit optionalem Offset und erkennt Bereichsgrenzen', () => {
    const plays = erstelleMultiAnglePlays();
    const treffer = berechneSynchronisierteZeit(plays[0], 'ENDZONE', 2000);
    assert.equal(treffer.verfuegbar, true);
    assert.equal(treffer.angleMs, 2320);
    assert.equal(treffer.inBereich, true);

    const ausserhalb = berechneSynchronisierteZeit(plays[0], 'ENDZONE', 7900);
    assert.equal(ausserhalb.inBereich, false);
    assert.equal(ausserhalb.angleMs, 8000);

    const luecke = berechneSynchronisierteZeit(plays[2], 'ENDZONE', 1000);
    assert.equal(luecke.verfuegbar, false);
  });

  it('quantisiert Offset auf 40ms-Raster, entfernt 0ms und übernimmt auf Folge-Plays', () => {
    const plays = erstelleMultiAnglePlays();
    const nachSnap = setzeClipOffset(plays, 2, 'ENDZONE', 185, true);
    assert.equal(nachSnap[1].sources.ENDZONE?.offset_ms, 200);

    const nachReset = setzeClipOffset(nachSnap, 2, 'ENDZONE', 0, true);
    assert.equal(nachReset[1].sources.ENDZONE?.offset_ms, undefined);

    const folge = uebernehmeOffsetAufFolgePlays(plays, 2, 'ENDZONE', -240, true);
    assert.equal(folge[0].sources.ENDZONE?.offset_ms, 320); // Play 1 unberührt
    assert.equal(folge[1].sources.ENDZONE?.offset_ms, -240);
    assert.equal(folge[2].sources.ENDZONE, null); // Lücke bleibt erhalten
  });

  it('entfernt Fehl-Clips als Winkel-Lücke und tauscht verschobene Clips mit Nachbar-Plays', () => {
    const plays = erstelleMultiAnglePlays();
    const ohneEz1 = entferneWinkelClip(plays, 1, 'ENDZONE');
    assert.equal(ohneEz1[0].sources.ENDZONE, null);
    assert.equal(ohneEz1[0].sources.SIDELINE?.file, 'sl_1.mp4');

    const getauscht = tauscheClipMitNachbar(plays, 2, 'ENDZONE', 1);
    assert.equal(getauscht[1].sources.ENDZONE, null);
    assert.equal(getauscht[2].sources.ENDZONE?.file, 'ez_2.mp4');
  });

  it('erkennt Winkel-Lücken, Offsets und Dauer-Abweichungen (>2s)', () => {
    const plays = erstelleMultiAnglePlays();
    const reel: VideoReel = {
      id: 'r1',
      teamId: 't1',
      title: 'Test',
      category: 'GAME',
      eventDate: '2026-11-14',
      thumbnailUrl: '',
      angles: ['SIDELINE', 'ENDZONE'],
      sourceMode: 'CLIP_FILE',
      playCount: plays.length,
      taggedCount: 0,
      visibility: 'COACHES_ONLY',
      teamFreigaben: [],
      shareLinks: [],
      draftNoteCount: 0,
      plays,
    };

    const probleme = erkenneSyncProbleme(reel);
    assert.ok(probleme.some((p) => p.playNumber === 1 && p.typ === 'OFFSET_APPLIED'));
    assert.ok(probleme.some((p) => p.playNumber === 2 && p.typ === 'DURATION_MISMATCH'));
    assert.ok(probleme.some((p) => p.playNumber === 3 && p.typ === 'MISSING_CLIP'));
  });
});

describe('Fast-Cut Editor (TIME_SLICE & I / O / J-K-L)', () => {
  it('steuert J/K/L-Shuttle-Geschwindigkeiten korrekt', () => {
    assert.equal(berechneJklGeschwindigkeit(0, 'l'), 1);
    assert.equal(berechneJklGeschwindigkeit(1, 'l'), 2);
    assert.equal(berechneJklGeschwindigkeit(2, 'l'), 4);
    assert.equal(berechneJklGeschwindigkeit(4, 'k'), 0);
    assert.equal(berechneJklGeschwindigkeit(2, 'j'), -1);
    assert.equal(berechneJklGeschwindigkeit(-1, 'j'), -2);
  });

  it('schneidet Time-Slice-Plays chronologisch, trimmt und nummeriert bei Löschung neu', () => {
    const ungueltig = schneideTimeSlicePlay([], {
      inMs: 5000,
      outMs: 5100,
      angle: 'SIDELINE',
      file: 'raw.mp4',
    });
    assert.equal(ungueltig.ok, false);

    const eins = schneideTimeSlicePlay([], {
      inMs: 12000,
      outMs: 19500,
      angle: 'SIDELINE',
      file: 'raw.mp4',
    });
    assert.equal(eins.ok, true);

    const zwei = schneideTimeSlicePlay(eins.plays, {
      inMs: 2010,
      outMs: 8010,
      angle: 'SIDELINE',
      file: 'raw.mp4',
    });
    assert.equal(zwei.ok, true);
    assert.equal(zwei.plays.length, 2);
    // Chronologisch sortiert: 2000..8000 wird Play 1
    assert.equal(zwei.plays[0].play_number, 1);
    assert.equal(zwei.plays[0].sources.SIDELINE?.start_ms, 2000);
    assert.equal(zwei.plays[1].play_number, 2);

    const getrimmt = aktualisierePlaySchnitt(zwei.plays, 1, 'SIDELINE', 2400, 8400);
    assert.equal(getrimmt.ok, true);
    assert.equal(getrimmt.plays[0].sources.SIDELINE?.start_ms, 2400);

    const nachLoeschen = loescheGeschnittenesPlay(getrimmt.plays, 1);
    assert.equal(nachLoeschen.length, 1);
    assert.equal(nachLoeschen[0].play_number, 1);
    assert.equal(nachLoeschen[0].sources.SIDELINE?.start_ms, 12000);
  });
});
