import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_PLAYLIST_VORLAGEN,
  berechnePlaylistStatistik,
  exportierePlaylistAlsCsv,
  filtereSmartPlaylistTreffer,
  pruefePlayGegenPlaylist,
} from '../../src/services/playlistEngine.ts';
import { STANDARD_TAG_SCHEMA } from '../../src/services/taggingEngine.ts';
import { INITIALE_DEMO_REELS } from '../../src/data/demoReels.ts';
import type { TagFeldKonfig, VideoReel } from '../../src/types.ts';

describe('Smart Playlists & Filter-Grid', () => {
  it('wertet Standard- und Custom-Breakdown-Felder mit AND / OR und Operatoren exakt aus', () => {
    const schemaErweitert: TagFeldKonfig[] = [
      ...STANDARD_TAG_SCHEMA,
      {
        key: 'protection',
        label: 'Pass Protection',
        kurz: 'PROT',
        gruppe: 'CUSTOM',
        typ: 'combobox',
        aktiv: true,
        istCustom: true,
        definitionen: ['Half Slide', '6-Man'],
      },
    ];

    const customReels: VideoReel[] = [
      {
        ...INITIALE_DEMO_REELS[0],
        plays: [
          {
            play_number: 1,
            sources: { SIDELINE: { file: 'p1.mp4', start_ms: 0, end_ms: 5000 } },
            breakdown: {
              odk: 'O',
              down: 3,
              distance: 4,
              yard_line: 18,
              play_type: 'PASS',
              gn_ls: 18,
              result: 'TD',
              custom: { protection: 'Half Slide' },
            },
          },
          {
            play_number: 2,
            sources: { SIDELINE: { file: 'p2.mp4', start_ms: 0, end_ms: 5000 } },
            breakdown: {
              odk: 'O',
              down: 1,
              distance: 10,
              yard_line: -25,
              play_type: 'RUN',
              gn_ls: 4,
              custom: { protection: '6-Man' },
            },
          },
        ],
      },
    ];

    assert.equal(
      pruefePlayGegenPlaylist(
        customReels[0].plays[0],
        STANDARD_PLAYLIST_VORLAGEN[1], // Redzone 1..20
        schemaErweitert
      ),
      true
    );
    assert.equal(
      pruefePlayGegenPlaylist(
        customReels[0].plays[1],
        STANDARD_PLAYLIST_VORLAGEN[1],
        schemaErweitert
      ),
      false
    );

    const customMatch = filtereSmartPlaylistTreffer(
      customReels,
      {
        kombinator: 'AND',
        sichtbarkeit: 'ALL_PLAYERS',
        regeln: [
          { id: 'r1', feldKey: 'protection', operator: 'contains', wert: 'half' },
          { id: 'r2', feldKey: 'gn_ls', operator: 'gte', wert: 15 },
        ],
      },
      schemaErweitert,
      { teamId: customReels[0].teamId, gewaehlteSaison: 'ALL', teamRolle: 'COACH' }
    );

    assert.equal(customMatch.length, 1);
    assert.equal(customMatch[0].play.play_number, 1);
  });

  it('erzwingt Rollen- und Saison-Isolation für Spieler bei COACHES_ONLY-Playlists & Reels', () => {
    const coachOnlyTreffer = filtereSmartPlaylistTreffer(
      INITIALE_DEMO_REELS,
      {
        kombinator: 'AND',
        sichtbarkeit: 'COACHES_ONLY',
        regeln: [],
      },
      STANDARD_TAG_SCHEMA,
      {
        teamId: INITIALE_DEMO_REELS[0].teamId,
        gewaehlteSaison: 'ALL',
        teamRolle: 'PLAYER',
      }
    );
    assert.equal(coachOnlyTreffer.length, 0);

    const spielerTreffer = filtereSmartPlaylistTreffer(
      INITIALE_DEMO_REELS,
      {
        kombinator: 'AND',
        sichtbarkeit: 'ALL_PLAYERS',
        regeln: [{ id: 'r1', feldKey: 'down', operator: 'in', werte: ['1', '2'] }],
      },
      STANDARD_TAG_SCHEMA,
      {
        teamId: INITIALE_DEMO_REELS[0].teamId,
        gewaehlteSaison: '2026',
        teamRolle: 'PLAYER',
      }
    );
    assert.ok(spielerTreffer.length > 0);
    assert.ok(
      spielerTreffer.every(
        (t) =>
          INITIALE_DEMO_REELS.find((r) => r.id === t.reelId)?.visibility !== 'COACHES_ONLY'
      )
    );
  });

  it('berechnet Cutup-Statistiken und exportiert Multi-Reel-CSV mit Header', () => {
    const treffer = filtereSmartPlaylistTreffer(
      INITIALE_DEMO_REELS,
      {
        kombinator: 'AND',
        sichtbarkeit: 'ALL_PLAYERS',
        regeln: [{ id: 'r1', feldKey: 'odk', operator: 'equals', wert: 'O' }],
      },
      STANDARD_TAG_SCHEMA,
      {
        teamId: INITIALE_DEMO_REELS[0].teamId,
        gewaehlteSaison: 'ALL',
        teamRolle: 'COACH',
      }
    );

    const stats = berechnePlaylistStatistik(treffer);
    assert.equal(stats.playCount, treffer.length);
    assert.ok(stats.avgGain !== null);

    const csv = exportierePlaylistAlsCsv(treffer.slice(0, 2), STANDARD_TAG_SCHEMA);
    const zeilen = csv.split('\n');
    assert.ok(zeilen[0].startsWith('REEL,PLAY #,ODK,DN,DIST'));
    assert.equal(zeilen.length, 3);
  });
});
