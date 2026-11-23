import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAME_MS,
  STANDARD_HOTKEYS,
  aktualisiereBenutzerHotkey,
  findeNaechstenAutoStopFrame,
  frameZuZeit,
  istGleicherFrame,
  zeitZuFrame,
} from '../../src/services/frameAndHotkeys.ts';

describe('Exakte Frame-Bindung & Auto-Stop für Canvas-Zeichnungen', () => {
  it('rechnet Millisekunden deterministisch in 25fps-Frames (40 ms) um', () => {
    assert.equal(FRAME_MS, 40);
    assert.equal(zeitZuFrame(2400), 60);
    assert.equal(frameZuZeit(60), 2400);
  });

  it('zeigt Zeichnung ausschließlich auf demselben Frame und nicht auf Nachbarframes', () => {
    assert.equal(istGleicherFrame(2400, 2400), true);
    assert.equal(istGleicherFrame(2400, 2410), true);
    assert.equal(istGleicherFrame(2400, 2440), false);
    assert.equal(istGleicherFrame(2400, 2360), false);
  });

  it('trifft beim Auto-Stop exakt den gezeichneten Frame und überspringt bereits gestoppte Frames', () => {
    const gestoppt = new Set<number>();
    const treffer = findeNaechstenAutoStopFrame(2385, 2405, [2400, 3200], gestoppt);
    assert.deepEqual(treffer, { zielFrame: 60, zielMs: 2400 });

    // Nach erneutem Play ab genau 2400 ms darf derselbe Frame nicht erneut blockieren
    gestoppt.add(60);
    const naechster = findeNaechstenAutoStopFrame(2400, 2420, [2400, 3200], gestoppt);
    assert.equal(naechster, null);
  });
});

describe('Benutzerdefinierte Film-Room-Hotkeys', () => {
  it('übernimmt gültige neue Tastenbelegung normalisiert in Kleinbuchstaben', () => {
    const ergebnis = aktualisiereBenutzerHotkey(STANDARD_HOTKEYS, 'pen', 'B');
    assert.equal(ergebnis.ok, true);
    assert.equal(ergebnis.hotkeys.pen, 'b');
  });

  it('lehnt Doppelbelegungen mit verständlicher Fehlermeldung ab', () => {
    const ergebnis = aktualisiereBenutzerHotkey(STANDARD_HOTKEYS, 'pen', 'a');
    assert.equal(ergebnis.ok, false);
    assert.match(ergebnis.fehler ?? '', /bereits/i);
    assert.equal(ergebnis.hotkeys.pen, STANDARD_HOTKEYS.pen);
  });

  it('lehnt ungültige Sondertasten ab', () => {
    const ergebnis = aktualisiereBenutzerHotkey(STANDARD_HOTKEYS, 'arrow', 'Enter');
    assert.equal(ergebnis.ok, false);
    assert.equal(ergebnis.hotkeys.arrow, STANDARD_HOTKEYS.arrow);
  });
});
