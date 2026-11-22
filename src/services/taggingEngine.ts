import type {
  BreakdownFeldKey,
  PlayBreakdown,
  Spielzug,
  TagFeldKonfig,
} from '../types.ts';

/**
 * Standard-Grundstock an Football-Tagging-Feldern & Basis-Definitionen.
 * Team Admins können einzelne Felder deaktivieren, Fehleinträge aus den
 * Wörterbüchern löschen oder eigene Custom-Felder ergänzen.
 */
export const STANDARD_TAG_SCHEMA: TagFeldKonfig[] = [
  {
    key: 'odk',
    label: 'ODK (Offense/Defense/Kick)',
    kurz: 'ODK',
    gruppe: 'SITUATION',
    typ: 'select',
    aktiv: true,
    definitionen: ['O', 'D', 'K'],
  },
  {
    key: 'down',
    label: 'Down',
    kurz: 'DN',
    gruppe: 'SITUATION',
    typ: 'select',
    aktiv: true,
    definitionen: ['1', '2', '3', '4'],
  },
  {
    key: 'distance',
    label: 'Distance',
    kurz: 'DIST',
    gruppe: 'SITUATION',
    typ: 'number',
    aktiv: true,
  },
  {
    key: 'yard_line',
    label: 'Yard Line (-50 bis +50)',
    kurz: 'YD LN',
    gruppe: 'SITUATION',
    typ: 'number',
    aktiv: true,
  },
  {
    key: 'hash',
    label: 'Hash',
    kurz: 'HASH',
    gruppe: 'SITUATION',
    typ: 'select',
    aktiv: true,
    definitionen: ['L', 'M', 'R'],
  },
  {
    key: 'play_type',
    label: 'Play Type',
    kurz: 'PLAY TYPE',
    gruppe: 'SITUATION',
    typ: 'select',
    aktiv: true,
    definitionen: ['RUN', 'PASS', 'SPECIAL', 'PENALTY'],
  },
  {
    key: 'off_pers',
    label: 'Offense Personnel',
    kurz: 'OFF PERS',
    gruppe: 'OFFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['10', '11', '12', '13', '20', '21', '22', '00'],
  },
  {
    key: 'off_form',
    label: 'Offense Formation',
    kurz: 'OFF FORM',
    gruppe: 'OFFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['Trips', 'Doubles', 'Bunch', 'Empty', 'I-Form', 'Heavy', 'Trey', 'Spread'],
  },
  {
    key: 'off_strg',
    label: 'Offense Strength',
    kurz: 'OFF STRG',
    gruppe: 'OFFENSE',
    typ: 'select',
    aktiv: true,
    definitionen: ['L', 'R', 'M'],
  },
  {
    key: 'backfield',
    label: 'Backfield',
    kurz: 'BACKFIELD',
    gruppe: 'OFFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['Gun Left', 'Gun Right', 'Pistol', 'I-Form', 'Split', 'Offset', 'Empty'],
  },
  {
    key: 'motion',
    label: 'Motion',
    kurz: 'MOTION',
    gruppe: 'OFFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['None', 'Jet', 'Orbit', 'Across', 'Short', 'Shift'],
  },
  {
    key: 'off_play',
    label: 'Offense Play',
    kurz: 'OFF PLAY',
    gruppe: 'OFFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: [
      'Inside Zone',
      'Outside Zone',
      'Power',
      'Counter',
      'Mesh',
      'Flood',
      'Four Verts',
      'Stick',
      'Slants',
      'Screen',
    ],
  },
  {
    key: 'rpo',
    label: 'RPO',
    kurz: 'RPO',
    gruppe: 'OFFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['None', 'Bubble', 'Glance', 'Slant', 'Stick', 'Now'],
  },
  {
    key: 'play_dir',
    label: 'Play Direction',
    kurz: 'PLAY DIR',
    gruppe: 'OFFENSE',
    typ: 'select',
    aktiv: true,
    definitionen: ['L', 'R', 'M'],
  },
  {
    key: 'result',
    label: 'Result',
    kurz: 'RESULT',
    gruppe: 'RESULT',
    typ: 'combobox',
    aktiv: true,
    definitionen: [
      'COMPLETE',
      'INCOMPLETE',
      'FUMBLE',
      'TD',
      'INTERCEPTION',
      'SACK',
      'SAFETY',
      'FLAG',
    ],
  },
  {
    key: 'gn_ls',
    label: 'Gain / Loss',
    kurz: 'GN/LS',
    gruppe: 'RESULT',
    typ: 'number',
    aktiv: true,
  },
  {
    key: 'def_str',
    label: 'Defense Strength',
    kurz: 'DEF STR',
    gruppe: 'DEFENSE',
    typ: 'select',
    aktiv: true,
    definitionen: ['L', 'R'],
  },
  {
    key: 'def_front',
    label: 'Defense Front',
    kurz: 'DEF FRONT',
    gruppe: 'DEFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['4-3', '4-3 Over', '4-3 Under', '3-4', '4-2-5', '3-3-5', '5-2', 'Bear'],
  },
  {
    key: 'def_pers',
    label: 'Defense Personnel',
    kurz: 'DEF PERS',
    gruppe: 'DEFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['Base', 'Nickel', 'Dime', 'Quarter', 'Goal Line', 'Heavy'],
  },
  {
    key: 'coverage',
    label: 'Coverage',
    kurz: 'COVERAGE',
    gruppe: 'DEFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4', 'Cover 6', 'Tampa 2', 'Man Free'],
  },
  {
    key: 'stunt',
    label: 'Stunt',
    kurz: 'STUNT',
    gruppe: 'DEFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['None', 'T/E', 'E/T', 'Twist', 'Pinch', 'Slant L', 'Slant R'],
  },
  {
    key: 'blitz',
    label: 'Blitz',
    kurz: 'BLITZ',
    gruppe: 'DEFENSE',
    typ: 'combobox',
    aktiv: true,
    definitionen: ['None', 'Mike', 'Will', 'Sam', 'Corner', 'Safety', 'Fire Zone', 'Zero'],
  },
];

/**
 * Rechnet Hudl-Yard-Line (-50..-1 eigene Hälfte, +49..+1 gegnerische Hälfte)
 * in absolute Feldposition (1..99 Yards von der eigenen Goalline) um.
 */
export function yardLineZuAbsolut(yardLine: number): number {
  const geklemmt = Math.max(-50, Math.min(50, Math.round(yardLine)));
  if (geklemmt === 0) return 50;
  if (geklemmt < 0) return Math.abs(geklemmt);
  return 100 - geklemmt;
}

/**
 * Rechnet absolute Feldposition (1..99) zurück in Hudl-Yard-Line (-50..+1).
 */
export function absolutZuYardLine(absolut: number): number {
  const geklemmt = Math.max(1, Math.min(99, Math.round(absolut)));
  if (geklemmt <= 50) return -geklemmt;
  return 100 - geklemmt;
}

/**
 * Berechnet Gain/Loss zwischen zwei Feldpositionen (außer bei FLAG).
 */
export function berechneGnLsAusFeldposition(
  startYardLine: number,
  zielYardLine: number,
  result?: string
): number | undefined {
  if (result?.toUpperCase() === 'FLAG') return undefined;
  return yardLineZuAbsolut(zielYardLine) - yardLineZuAbsolut(startYardLine);
}

/**
 * Berechnet die neue Yard-Line aus Start-Yard-Line + Gain/Loss (außer bei FLAG).
 */
export function berechneNaechsteYardLine(
  startYardLine: number,
  gnLs: number,
  result?: string
): number | undefined {
  if (result?.toUpperCase() === 'FLAG') return undefined;
  const neuAbsolut = yardLineZuAbsolut(startYardLine) + gnLs;
  return absolutZuYardLine(neuAbsolut);
}

/**
 * Liest den Wert eines Standard- oder Custom-Breakdown-Feldes einheitlich aus.
 */
export function leseBreakdownWert(
  breakdown: PlayBreakdown | undefined,
  feld: TagFeldKonfig
): string | number | undefined {
  if (!breakdown) return undefined;
  if (feld.istCustom) {
    return breakdown.custom?.[feld.key];
  }
  return (breakdown as Record<string, unknown>)[feld.key] as string | number | undefined;
}

/**
 * Schreibt eine Breakdown-Änderung inkl. automatischer GN/LS <-> YD LN Synchronisation.
 */
export function wendeBreakdownUpdateMitAutoCalcAn(
  plays: Spielzug[],
  playNumber: number,
  feldKey: BreakdownFeldKey,
  neuerWert: string | number | undefined,
  istCustom = false
): Spielzug[] {
  const index = plays.findIndex((p) => p.play_number === playNumber);
  if (index === -1) return plays;

  const geklont: Spielzug[] = plays.map((p) => ({
    ...p,
    breakdown: {
      ...(p.breakdown ?? {}),
      ...(p.breakdown?.custom ? { custom: { ...p.breakdown.custom } } : {}),
    },
  }));

  const aktuell = geklont[index];
  const b = aktuell.breakdown!;

  if (istCustom) {
    b.custom = { ...(b.custom ?? {}), [feldKey]: neuerWert };
    return geklont;
  }

  (b as Record<string, unknown>)[feldKey] = neuerWert;

  const istFlag = b.result?.toUpperCase() === 'FLAG';

  if (feldKey === 'result' && String(neuerWert ?? '').toUpperCase() === 'TD' && b.yard_line !== undefined) {
    b.gn_ls = 100 - yardLineZuAbsolut(b.yard_line);
    return geklont;
  }

  if (feldKey === 'result' && String(neuerWert ?? '').toUpperCase() === 'INCOMPLETE') {
    b.gn_ls = 0;
  }

  if (feldKey === 'gn_ls' && !istFlag && typeof neuerWert === 'number' && b.yard_line !== undefined) {
    const naechstes = geklont[index + 1];
    if (naechstes && (!b.odk || !naechstes.breakdown?.odk || naechstes.breakdown.odk === b.odk)) {
      const berechneteYl = berechneNaechsteYardLine(b.yard_line, neuerWert, b.result);
      if (berechneteYl !== undefined) {
        naechstes.breakdown = { ...(naechstes.breakdown ?? {}), yard_line: berechneteYl };
      }
    }
  }

  if (feldKey === 'yard_line' && typeof neuerWert === 'number') {
    const vorheriges = geklont[index - 1];
    if (
      vorheriges?.breakdown?.yard_line !== undefined &&
      vorheriges.breakdown.result?.toUpperCase() !== 'FLAG' &&
      (!vorheriges.breakdown.odk || !b.odk || vorheriges.breakdown.odk === b.odk)
    ) {
      const autoGnLs = berechneGnLsAusFeldposition(
        vorheriges.breakdown.yard_line,
        neuerWert,
        vorheriges.breakdown.result
      );
      if (autoGnLs !== undefined) {
        vorheriges.breakdown.gn_ls = autoGnLs;
      }
    }

    const naechstes = geklont[index + 1];
    if (
      !istFlag &&
      naechstes?.breakdown?.yard_line !== undefined &&
      (!b.odk || !naechstes.breakdown.odk || naechstes.breakdown.odk === b.odk)
    ) {
      const autoGnLsAktuell = berechneGnLsAusFeldposition(
        neuerWert,
        naechstes.breakdown.yard_line,
        b.result
      );
      if (autoGnLsAktuell !== undefined) {
        b.gn_ls = autoGnLsAktuell;
      }
    }
  }

  return geklont;
}

/**
 * Ergänzt einen neu eingegebenen Begriff dauerhaft im Team-Wörterbuch (case-insensitiv dedupliziert).
 */
export function registriereDefinitionWennNeu(
  schema: TagFeldKonfig[],
  feldKey: BreakdownFeldKey,
  eingabe: string
): TagFeldKonfig[] {
  const bereinigt = eingabe.trim();
  if (!bereinigt) return schema;

  return schema.map((feld) => {
    if (feld.key !== feldKey || feld.typ !== 'combobox') return feld;
    const vorhanden = feld.definitionen ?? [];
    const existiert = vorhanden.some((d) => d.toLowerCase() === bereinigt.toLowerCase());
    if (existiert) return feld;
    return {
      ...feld,
      definitionen: [...vorhanden, bereinigt],
    };
  });
}
