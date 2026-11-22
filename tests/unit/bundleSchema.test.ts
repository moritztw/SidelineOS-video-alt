import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bundleZuReel,
  erstelleBeispielBundle,
  reelZuBundle,
  validiereUndParseBundle,
} from '../../src/plugins/video-analysis/services/bundleSchema.ts';

test('validiert ein vollständiges Multi-Angle-Bundle inklusive optionalem Offset und Winkel-Lücke', () => {
  const beispiel = erstelleBeispielBundle();
  const ergebnis = validiereUndParseBundle(JSON.stringify(beispiel));

  assert.equal(ergebnis.ok, true);
  assert.equal(ergebnis.fehler.length, 0);
  assert.ok(ergebnis.bundle);
  assert.equal(ergebnis.bundle.plays.length, 3);
  assert.equal(ergebnis.bundle.plays[0].sources.ENDZONE?.offset_ms, 300);
  assert.equal(ergebnis.bundle.plays[1].sources.ENDZONE?.offset_ms, undefined);
  assert.equal(ergebnis.bundle.plays[2].sources.ENDZONE, null);
  assert.ok(ergebnis.hinweise.length >= 1);
});

test('validiert ein Einzeldatei-Tape im TIME_SLICE-Modus ohne Offset', () => {
  const timeSliceJson = JSON.stringify({
    schema_version: '1.0',
    reel: {
      title: 'Training Raw Tape',
      category: 'PRACTICE',
      event_date: '2026-11-18',
    },
    angles: ['SIDELINE'],
    plays: [
      {
        play_number: 1,
        sources: {
          SIDELINE: {
            file: 'raw_training.mp4',
            source_mode: 'TIME_SLICE',
            start_ms: 12000,
            end_ms: 21500,
          },
        },
      },
    ],
  });

  const ergebnis = validiereUndParseBundle(timeSliceJson);
  assert.equal(ergebnis.ok, true);
  assert.ok(ergebnis.bundle);

  const reel = bundleZuReel(ergebnis.bundle, 'team-1', '/thumb.jpg');
  assert.equal(reel.sourceMode, 'TIME_SLICE');
  assert.equal(reel.visibility, 'COACHES_ONLY');
  assert.equal(reel.playCount, 1);
});

test('lehnt ungültiges JSON und falsche schema_version sauber ab', () => {
  const kaputt = validiereUndParseBundle('{ungueltig');
  assert.equal(kaputt.ok, false);
  assert.match(kaputt.fehler[0], /Ungültiges JSON-Format/);

  const falscheVersion = validiereUndParseBundle(
    JSON.stringify({
      schema_version: '2.0',
      reel: { title: 'Test', category: 'GAME', event_date: '2026-11-18' },
      angles: ['SIDELINE'],
      plays: [],
    })
  );
  assert.equal(falscheVersion.ok, false);
  assert.ok(falscheVersion.fehler.some((f) => f.includes('schema_version')));
});

test('lehnt ungültige Timecodes (end_ms <= start_ms) und falsches Datum ab', () => {
  const ungueltig = validiereUndParseBundle(
    JSON.stringify({
      schema_version: '1.0',
      reel: { title: 'Test', category: 'GAME', event_date: '18.11.2026' },
      angles: ['SIDELINE'],
      plays: [
        {
          play_number: 1,
          sources: {
            SIDELINE: { file: 'p1.mp4', start_ms: 5000, end_ms: 4000 },
          },
        },
      ],
    })
  );

  assert.equal(ungueltig.ok, false);
  assert.ok(ungueltig.fehler.some((f) => f.includes('YYYY-MM-DD')));
  assert.ok(ungueltig.fehler.some((f) => f.includes('end_ms')));
});

test('Round-Trip: Reel -> Bundle -> Validierung bleibt konsistent', () => {
  const original = erstelleBeispielBundle();
  const reel = bundleZuReel(original, 'team-stallions-seniors', '/thumb.jpg');
  const exportiert = reelZuBundle(reel);
  const erneutGeparst = validiereUndParseBundle(JSON.stringify(exportiert));

  assert.equal(erneutGeparst.ok, true);
  assert.equal(erneutGeparst.bundle?.reel.title, original.reel.title);
  assert.equal(erneutGeparst.bundle?.plays.length, original.plays.length);
});
