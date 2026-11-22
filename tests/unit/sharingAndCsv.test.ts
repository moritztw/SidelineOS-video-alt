import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportiereBreakdownAlsCsv,
  filtereBundleFuerFreigabe,
  generiereShareLinkPfad,
  istShareLinkGueltig,
} from '../../src/plugins/video-analysis/services/bundleSchema.ts';
import { INITIALE_DEMO_REELS } from '../../src/plugins/video-analysis/data/demoReels.ts';

test('filtereBundleFuerFreigabe gibt nur gewählte Tagging-Felder frei und schützt Notizen/Zeichnungen', () => {
  const reel = INITIALE_DEMO_REELS[0];
  const gefiltert = filtereBundleFuerFreigabe(reel, ['odk', 'down', 'distance']);

  assert.equal(gefiltert.plays.length, reel.plays.length);
  assert.deepEqual(gefiltert.plays[0].breakdown, {
    odk: 'O',
    down: 1,
    distance: 10,
  });
  // Interne Coaching-Daten dürfen niemals enthalten sein
  assert.equal(gefiltert.plays[0].notes, undefined);
  assert.equal(gefiltert.plays[0].drawings, undefined);
});

test('filtereBundleFuerFreigabe entfernt Breakdown komplett bei Nur-Video-Freigabe', () => {
  const reel = INITIALE_DEMO_REELS[0];
  const nurVideo = filtereBundleFuerFreigabe(reel, []);

  assert.equal(nurVideo.plays[0].breakdown, undefined);
  assert.ok(nurVideo.plays[0].sources.SIDELINE);
});

test('istShareLinkGueltig erkennt aktive, abgelaufene und widerrufene /share/-Links', () => {
  const referenz = new Date('2026-11-20T12:00:00.000Z');
  const { token, pfad } = generiereShareLinkPfad();
  assert.match(pfad, /^\/share\/sl-[a-z0-9]{8}$/);

  const gueltig = istShareLinkGueltig(
    {
      id: 'l1',
      token,
      pfad,
      bezeichnung: 'Test',
      erstelltAm: '2026-11-20T10:00:00.000Z',
      gueltigBis: '2026-11-27T10:00:00.000Z',
      freigegebeneFelder: [],
      aktiv: true,
    },
    referenz
  );
  assert.equal(gueltig, true);

  const abgelaufen = istShareLinkGueltig(
    {
      id: 'l2',
      token,
      pfad,
      bezeichnung: 'Alt',
      erstelltAm: '2026-11-01T10:00:00.000Z',
      gueltigBis: '2026-11-19T10:00:00.000Z',
      freigegebeneFelder: [],
      aktiv: true,
    },
    referenz
  );
  assert.equal(abgelaufen, false);
});

test('exportiereBreakdownAlsCsv erzeugt Hudl-konforme Kopfzeile und optionale Spaltenauswahl', () => {
  const plays = INITIALE_DEMO_REELS[0].plays.slice(0, 2);
  const csv = exportiereBreakdownAlsCsv(plays, ['odk', 'down', 'distance', 'play_type']);
  const zeilen = csv.split('\n');

  assert.equal(zeilen[0], 'PLAY #,ODK,DN,DIST,PLAY TYPE');
  assert.equal(zeilen[1], '1,O,1,10,RUN');
  assert.equal(zeilen[2], '2,O,2,4,PASS');
});
