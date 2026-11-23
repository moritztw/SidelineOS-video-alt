import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_TAG_SCHEMA,
  absolutZuYardLine,
  berechneGnLsAusFeldposition,
  berechneNaechsteYardLine,
  registriereDefinitionWennNeu,
  wendeBreakdownUpdateMitAutoCalcAn,
  yardLineZuAbsolut,
} from '../../src/services/taggingEngine.ts';
import type { Spielzug } from '../../src/types.ts';

function erstelleTestPlays(): Spielzug[] {
  return [
    {
      play_number: 1,
      sources: { SIDELINE: { file: 'p1.mp4', start_ms: 0, end_ms: 8000 } },
      breakdown: { odk: 'O', down: 1, distance: 10, yard_line: -25, gn_ls: 6 },
    },
    {
      play_number: 2,
      sources: { SIDELINE: { file: 'p2.mp4', start_ms: 0, end_ms: 8000 } },
      breakdown: { odk: 'O', down: 2, distance: 4, yard_line: -31, gn_ls: 15 },
    },
    {
      play_number: 3,
      sources: { SIDELINE: { file: 'p3.mp4', start_ms: 0, end_ms: 8000 } },
      breakdown: { odk: 'O', down: 1, distance: 10, yard_line: -46 },
    },
  ];
}

test('yardLineZuAbsolut und absolutZuYardLine konvertieren Mittellinie und gegnerische Hälfte exakt', () => {
  assert.equal(yardLineZuAbsolut(-25), 25);
  assert.equal(yardLineZuAbsolut(-50), 50);
  assert.equal(yardLineZuAbsolut(40), 60);
  assert.equal(yardLineZuAbsolut(20), 80);

  assert.equal(absolutZuYardLine(25), -25);
  assert.equal(absolutZuYardLine(50), -50);
  assert.equal(absolutZuYardLine(60), 40);
  assert.equal(absolutZuYardLine(80), 20);
});

test('berechnet GN/LS automatisch aus YD LN und umgekehrt über die Mittellinie hinweg', () => {
  assert.equal(berechneGnLsAusFeldposition(-45, 45), 10);
  assert.equal(berechneNaechsteYardLine(-45, 10), 45);

  const plays = erstelleTestPlays();
  // GN/LS auf Play 2 ändern (+25 Yards von -31 -> absolut 56 -> +44 gegnerische Hälfte)
  const nachGnLs = wendeBreakdownUpdateMitAutoCalcAn(plays, 2, 'gn_ls', 25);
  assert.equal(nachGnLs[2].breakdown?.yard_line, 44);

  // YD LN auf Play 2 ändern (-35 statt -31 -> Play 1 GN/LS wird automatisch +10)
  const nachYl = wendeBreakdownUpdateMitAutoCalcAn(plays, 2, 'yard_line', -35);
  assert.equal(nachYl[0].breakdown?.gn_ls, 10);
});

test('FLAG deaktiviert automatische YD LN <-> GN/LS Berechnung in beiden Richtungen', () => {
  assert.equal(berechneGnLsAusFeldposition(-25, -40, 'FLAG'), undefined);
  assert.equal(berechneNaechsteYardLine(-25, 15, 'FLAG'), undefined);

  const plays = erstelleTestPlays();
  plays[0].breakdown!.result = 'FLAG';
  const aktualisiert = wendeBreakdownUpdateMitAutoCalcAn(plays, 1, 'gn_ls', 15);
  // Play 2 Yard-Line darf bei FLAG nicht überschrieben werden
  assert.equal(aktualisiert[1].breakdown?.yard_line, -31);

  const nachPlay2Yl = wendeBreakdownUpdateMitAutoCalcAn(plays, 2, 'yard_line', -45);
  // Play 1 GN/LS bleibt unverändert (6), da Play 1 eine FLAG ist
  assert.equal(nachPlay2Yl[0].breakdown?.gn_ls, 6);
});

test('TD berechnet GN/LS automatisch bis zur Goalline', () => {
  const plays = erstelleTestPlays();
  plays[0].breakdown!.yard_line = 18; // gegnerische 18-Yard-Linie -> 18 Yards bis TD
  const nachTd = wendeBreakdownUpdateMitAutoCalcAn(plays, 1, 'result', 'TD');
  assert.equal(nachTd[0].breakdown?.gn_ls, 18);
});

test('registriereDefinitionWennNeu speichert neue Coach-Eingaben dauerhaft und ohne Duplikate', () => {
  const nachNeu = registriereDefinitionWennNeu(STANDARD_TAG_SCHEMA, 'off_form', 'Trey Open');
  const offForm = nachNeu.find((f) => f.key === 'off_form');
  assert.ok(offForm?.definitionen?.includes('Trey Open'));

  // Case-insensitives Duplikat darf nicht doppelt angelegt werden
  const nachDuplikat = registriereDefinitionWennNeu(nachNeu, 'off_form', 'trey open');
  const anzahl =
    nachDuplikat
      .find((f) => f.key === 'off_form')
      ?.definitionen?.filter((d) => d.toLowerCase() === 'trey open').length ?? 0;
  assert.equal(anzahl, 1);
});
