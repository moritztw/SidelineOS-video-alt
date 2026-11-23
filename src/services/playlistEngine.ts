import { filtereNachSaison, type TeamRolle } from '@sidelineos/plugin-sdk';
import type {
  PlaylistFilterRegel,
  PlaylistTreffer,
  SmartPlaylist,
  Spielzug,
  TagFeldKonfig,
  VideoReel,
} from '../types.ts';
import { leseBreakdownWert } from './taggingEngine.ts';

export const STANDARD_PLAYLIST_VORLAGEN: Array<
  Pick<SmartPlaylist, 'id' | 'name' | 'beschreibung' | 'kombinator' | 'regeln' | 'sichtbarkeit'>
> = [
  {
    id: 'preset-3rd-down',
    name: '3rd Down Situations',
    beschreibung: 'Alle Offense- & Defense-Spielzüge im 3rd Down.',
    kombinator: 'AND',
    regeln: [{ id: 'r-3rd', feldKey: 'down', operator: 'equals', wert: 3 }],
    sichtbarkeit: 'ALL_PLAYERS',
  },
  {
    id: 'preset-redzone',
    name: 'Redzone (Gegnerische 20Y)',
    beschreibung: 'Plays innerhalb der gegnerischen 20-Yard-Linie (YD LN 1..20).',
    kombinator: 'AND',
    regeln: [
      { id: 'r-rz-min', feldKey: 'yard_line', operator: 'gte', wert: 1 },
      { id: 'r-rz-max', feldKey: 'yard_line', operator: 'lte', wert: 20 },
    ],
    sichtbarkeit: 'ALL_PLAYERS',
  },
  {
    id: 'preset-explosive',
    name: 'Explosive Plays (15+ Yards)',
    beschreibung: 'Alle Spielzüge mit mindestens 15 Yards Raumgewinn.',
    kombinator: 'AND',
    regeln: [{ id: 'r-exp', feldKey: 'gn_ls', operator: 'gte', wert: 15 }],
    sichtbarkeit: 'ALL_PLAYERS',
  },
  {
    id: 'preset-blitz',
    name: 'Blitz & Pressure Looks',
    beschreibung: 'Alle Plays mit eingetragenem Blitz ungleich "None".',
    kombinator: 'AND',
    regeln: [
      { id: 'r-blz-set', feldKey: 'blitz', operator: 'is_not_empty' },
      { id: 'r-blz-none', feldKey: 'blitz', operator: 'not_equals', wert: 'None' },
    ],
    sichtbarkeit: 'COACHES_ONLY',
  },
];

function istLeer(wert: string | number | undefined): boolean {
  return wert === undefined || wert === null || String(wert).trim() === '';
}

function alsZahl(wert: string | number | undefined): number | null {
  if (wert === undefined || wert === null || wert === '') return null;
  const num = typeof wert === 'number' ? wert : Number(String(wert).trim());
  return Number.isFinite(num) ? num : null;
}

/**
 * Prüft ein einzelnes Play typsicher gegen eine Filterregel über Standard- oder Custom-Breakdown-Felder.
 */
export function pruefePlayGegenRegel(
  play: Spielzug,
  regel: PlaylistFilterRegel,
  tagSchema: TagFeldKonfig[]
): boolean {
  const feldKonfig: TagFeldKonfig = tagSchema.find((f) => f.key === regel.feldKey) ?? {
    key: regel.feldKey,
    label: String(regel.feldKey),
    kurz: String(regel.feldKey).toUpperCase(),
    gruppe: 'CUSTOM',
    typ: 'text',
    aktiv: true,
    istCustom: true,
  };

  const rohWert = leseBreakdownWert(play.breakdown, feldKonfig);

  switch (regel.operator) {
    case 'is_empty':
      return istLeer(rohWert);
    case 'is_not_empty':
      return !istLeer(rohWert);
    case 'equals': {
      if (istLeer(rohWert) || istLeer(regel.wert)) return false;
      const numA = alsZahl(rohWert);
      const numB = alsZahl(regel.wert);
      if (numA !== null && numB !== null) return numA === numB;
      return String(rohWert).trim().toLowerCase() === String(regel.wert).trim().toLowerCase();
    }
    case 'not_equals': {
      if (istLeer(regel.wert)) return !istLeer(rohWert);
      if (istLeer(rohWert)) return true;
      const numA = alsZahl(rohWert);
      const numB = alsZahl(regel.wert);
      if (numA !== null && numB !== null) return numA !== numB;
      return String(rohWert).trim().toLowerCase() !== String(regel.wert).trim().toLowerCase();
    }
    case 'contains': {
      if (istLeer(rohWert) || istLeer(regel.wert)) return false;
      return String(rohWert).toLowerCase().includes(String(regel.wert).trim().toLowerCase());
    }
    case 'gte': {
      const numA = alsZahl(rohWert);
      const numB = alsZahl(regel.wert);
      return numA !== null && numB !== null && numA >= numB;
    }
    case 'lte': {
      const numA = alsZahl(rohWert);
      const numB = alsZahl(regel.wert);
      return numA !== null && numB !== null && numA <= numB;
    }
    case 'in': {
      const liste = (regel.werte ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean);
      if (liste.length === 0 || istLeer(rohWert)) return false;
      return liste.includes(String(rohWert).trim().toLowerCase());
    }
    default:
      return false;
  }
}

/**
 * Prüft ein Play gegen alle Regeln einer Smart Playlist (`AND` oder `OR`).
 */
export function pruefePlayGegenPlaylist(
  play: Spielzug,
  playlist: Pick<SmartPlaylist, 'kombinator' | 'regeln'>,
  tagSchema: TagFeldKonfig[]
): boolean {
  if (playlist.regeln.length === 0) return true;
  if (playlist.kombinator === 'OR') {
    return playlist.regeln.some((regel) => pruefePlayGegenRegel(play, regel, tagSchema));
  }
  return playlist.regeln.every((regel) => pruefePlayGegenRegel(play, regel, tagSchema));
}

/**
 * Filtert team-, saison- und rollenkonform alle passenden Plays über die gewählten Reels.
 */
export function filtereSmartPlaylistTreffer(
  reels: VideoReel[],
  playlist: Pick<SmartPlaylist, 'kombinator' | 'regeln' | 'reelIds' | 'sichtbarkeit'>,
  tagSchema: TagFeldKonfig[],
  kontext: {
    teamId: string;
    gewaehlteSaison: string;
    teamRolle: TeamRolle;
  }
): PlaylistTreffer[] {
  if (kontext.teamRolle === 'PLAYER' && playlist.sichtbarkeit === 'COACHES_ONLY') {
    return [];
  }

  const teamReels = reels.filter(
    (reel) =>
      reel.teamId === kontext.teamId &&
      (kontext.teamRolle === 'PLAYER' ? reel.visibility !== 'COACHES_ONLY' : true)
  );
  const saisonReels = filtereNachSaison(teamReels, kontext.gewaehlteSaison);
  const zielReels =
    playlist.reelIds && playlist.reelIds.length > 0
      ? saisonReels.filter((r) => playlist.reelIds!.includes(r.id))
      : saisonReels;

  const treffer: PlaylistTreffer[] = [];
  for (const reel of zielReels) {
    for (const play of reel.plays) {
      if (pruefePlayGegenPlaylist(play, playlist, tagSchema)) {
        treffer.push({
          reelId: reel.id,
          reelTitle: reel.title,
          eventDate: reel.eventDate,
          category: reel.category,
          play,
        });
      }
    }
  }
  return treffer;
}

export interface PlaylistStatistik {
  playCount: number;
  avgGain: number | null;
  explosiveCount: number;
  tdCount: number;
  runCount: number;
  passCount: number;
}

/** Berechnet kompakte Cutup-Kennzahlen über die Playlist-Treffer. */
export function berechnePlaylistStatistik(treffer: PlaylistTreffer[]): PlaylistStatistik {
  let gainSumme = 0;
  let gainAnzahl = 0;
  let explosiveCount = 0;
  let tdCount = 0;
  let runCount = 0;
  let passCount = 0;

  for (const eintrag of treffer) {
    const b = eintrag.play.breakdown;
    if (!b) continue;
    if (typeof b.gn_ls === 'number') {
      gainSumme += b.gn_ls;
      gainAnzahl += 1;
      if (b.gn_ls >= 15) explosiveCount += 1;
    }
    if (b.result?.toUpperCase() === 'TD') tdCount += 1;
    if (b.play_type === 'RUN') runCount += 1;
    if (b.play_type === 'PASS') passCount += 1;
  }

  return {
    playCount: treffer.length,
    avgGain: gainAnzahl > 0 ? Math.round((gainSumme / gainAnzahl) * 10) / 10 : null,
    explosiveCount,
    tdCount,
    runCount,
    passCount,
  };
}

function escapeCsvFeld(wert: unknown): string {
  const str = wert === undefined || wert === null ? '' : String(wert);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exportiert eine Smart-Playlist über mehrere Reels als Hudl-kompatible CSV-Datei.
 */
export function exportierePlaylistAlsCsv(
  treffer: PlaylistTreffer[],
  tagSchema: TagFeldKonfig[]
): string {
  const aktiveFelder = tagSchema.filter((f) => f.aktiv);
  const header = ['REEL', 'PLAY #', ...aktiveFelder.map((f) => f.kurz)];
  const zeilen = [header.map(escapeCsvFeld).join(',')];

  for (const eintrag of treffer) {
    const werte = aktiveFelder.map((feld) =>
      escapeCsvFeld(leseBreakdownWert(eintrag.play.breakdown, feld))
    );
    zeilen.push(
      [escapeCsvFeld(eintrag.reelTitle), escapeCsvFeld(eintrag.play.play_number), ...werte].join(
        ','
      )
    );
  }

  return zeilen.join('\n');
}
