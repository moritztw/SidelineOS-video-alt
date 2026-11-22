import type {
  BreakdownFeldKey,
  CoachNotiz,
  PlayBreakdown,
  PlayQuelle,
  QuellModus,
  ReelKategorie,
  ShareDownloadLink,
  SidelineBundleV1,
  SpielerFreigabe,
  Spielzug,
  TagFeldKonfig,
  ValidierungsErgebnis,
  VideoReel,
} from '../types.ts';
import { STANDARD_TAG_SCHEMA, leseBreakdownWert } from './taggingEngine.ts';

const GUELTIGE_KATEGORIEN = new Set<ReelKategorie>([
  'GAME',
  'PRACTICE',
  'SCOUTING',
  'SELF_SCOUT',
  'CUSTOM',
]);

const GUELTIGE_FREIGABEN = new Set<SpielerFreigabe>([
  'COACHES_ONLY',
  'ALL_PLAYERS',
  'UNIT_OFFENSE',
  'UNIT_DEFENSE',
  'UNIT_SPECIAL_TEAMS',
]);

const ISO_DATUM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

/**
 * Validiert ein sideline-bundle.json (v1.0) streng gegen das Spezifikationsschema.
 * Offset-Angaben (offset_ms) sind ausdrücklich optional.
 */
export function validiereUndParseBundle(rohText: string): ValidierungsErgebnis {
  const fehler: string[] = [];
  const hinweise: string[] = [];

  if (!rohText || !rohText.trim()) {
    return { ok: false, fehler: ['Die JSON-Datei ist leer.'], hinweise };
  }

  let daten: unknown;
  try {
    daten = JSON.parse(rohText);
  } catch (err) {
    const meldung = err instanceof Error ? err.message : 'Unbekannter Syntaxfehler';
    return { ok: false, fehler: [`Ungültiges JSON-Format: ${meldung}`], hinweise };
  }

  if (!istObjekt(daten)) {
    return { ok: false, fehler: ['Wurzelelement muss ein JSON-Objekt sein.'], hinweise };
  }

  if (daten.schema_version !== '1.0') {
    fehler.push(
      `Nicht unterstützte schema_version "${String(daten.schema_version ?? '')}". Erwartet: "1.0".`
    );
  }

  const reelRoh = daten.reel;
  let reelTitel = '';
  let reelKategorie: ReelKategorie = 'GAME';
  let reelDatum = '';
  let reelFreigabe: SpielerFreigabe = 'COACHES_ONLY';

  if (!istObjekt(reelRoh)) {
    fehler.push('Pflichtobjekt "reel" fehlt.');
  } else {
    if (typeof reelRoh.title !== 'string' || !reelRoh.title.trim()) {
      fehler.push('reel.title muss ein nicht-leerer Text sein.');
    } else {
      reelTitel = reelRoh.title.trim();
    }

    if (
      typeof reelRoh.category !== 'string' ||
      !GUELTIGE_KATEGORIEN.has(reelRoh.category as ReelKategorie)
    ) {
      fehler.push(
        `reel.category ungültig. Erlaubt: ${Array.from(GUELTIGE_KATEGORIEN).join(', ')}.`
      );
    } else {
      reelKategorie = reelRoh.category as ReelKategorie;
    }

    if (typeof reelRoh.event_date !== 'string' || !ISO_DATUM_REGEX.test(reelRoh.event_date)) {
      fehler.push('reel.event_date muss im Format YYYY-MM-DD angegeben sein.');
    } else {
      reelDatum = reelRoh.event_date;
    }

    if (reelRoh.visibility !== undefined) {
      if (
        typeof reelRoh.visibility !== 'string' ||
        !GUELTIGE_FREIGABEN.has(reelRoh.visibility as SpielerFreigabe)
      ) {
        fehler.push(
          `reel.visibility ungültig. Erlaubt: ${Array.from(GUELTIGE_FREIGABEN).join(', ')}.`
        );
      } else {
        reelFreigabe = reelRoh.visibility as SpielerFreigabe;
      }
    }
  }

  const anglesRoh = daten.angles;
  const angles: string[] = [];
  if (!Array.isArray(anglesRoh) || anglesRoh.length === 0) {
    fehler.push('angles muss ein Array mit mindestens einem Kamerawinkel sein.');
  } else {
    for (const eintrag of anglesRoh) {
      if (typeof eintrag !== 'string' || !eintrag.trim()) {
        fehler.push('Jeder Eintrag in angles muss ein nicht-leerer Text sein.');
      } else {
        const normalisiert = eintrag.trim().toUpperCase();
        if (!angles.includes(normalisiert)) {
          angles.push(normalisiert);
        }
      }
    }
  }

  const playsRoh = daten.plays;
  const spielzuege: Spielzug[] = [];
  let anzahlOhneOffset = 0;
  let anzahlWinkelLuecken = 0;

  if (!Array.isArray(playsRoh)) {
    fehler.push('plays muss ein Array sein.');
  } else {
    playsRoh.forEach((playRoh, index) => {
      const praefix = `plays[${index}]`;
      if (!istObjekt(playRoh)) {
        fehler.push(`${praefix} muss ein Objekt sein.`);
        return;
      }

      if (
        typeof playRoh.play_number !== 'number' ||
        !Number.isInteger(playRoh.play_number) ||
        playRoh.play_number < 1
      ) {
        fehler.push(`${praefix}.play_number muss eine ganze Zahl >= 1 sein.`);
      }

      if (!istObjekt(playRoh.sources)) {
        fehler.push(`${praefix}.sources muss ein Objekt mit Kamerazuordnungen sein.`);
        return;
      }

      const bereinigteQuellen: Record<string, PlayQuelle | null> = {};
      let mindestensEineQuelle = false;

      for (const [winkelKey, quelleRoh] of Object.entries(playRoh.sources)) {
        const winkel = winkelKey.trim().toUpperCase();
        if (quelleRoh === null) {
          bereinigteQuellen[winkel] = null;
          anzahlWinkelLuecken += 1;
          continue;
        }
        if (!istObjekt(quelleRoh)) {
          fehler.push(`${praefix}.sources.${winkel} muss ein Objekt oder null sein.`);
          continue;
        }
        if (typeof quelleRoh.file !== 'string' || !quelleRoh.file.trim()) {
          fehler.push(`${praefix}.sources.${winkel}.file fehlt.`);
          continue;
        }

        const startMs = quelleRoh.start_ms;
        const endMs = quelleRoh.end_ms;
        if (typeof startMs !== 'number' || !Number.isFinite(startMs) || startMs < 0) {
          fehler.push(`${praefix}.sources.${winkel}.start_ms muss eine Zahl >= 0 sein.`);
          continue;
        }
        if (typeof endMs !== 'number' || !Number.isFinite(endMs) || endMs <= startMs) {
          fehler.push(`${praefix}.sources.${winkel}.end_ms muss größer als start_ms sein.`);
          continue;
        }

        const modusRoh = quelleRoh.source_mode;
        let sourceMode: QuellModus = 'CLIP_FILE';
        if (modusRoh !== undefined) {
          if (modusRoh !== 'CLIP_FILE' && modusRoh !== 'TIME_SLICE') {
            fehler.push(
              `${praefix}.sources.${winkel}.source_mode muss "CLIP_FILE" oder "TIME_SLICE" sein.`
            );
            continue;
          }
          sourceMode = modusRoh;
        }

        let offsetMs: number | undefined;
        if (quelleRoh.offset_ms !== undefined && quelleRoh.offset_ms !== null) {
          if (typeof quelleRoh.offset_ms !== 'number' || !Number.isFinite(quelleRoh.offset_ms)) {
            fehler.push(`${praefix}.sources.${winkel}.offset_ms muss eine Zahl sein.`);
            continue;
          }
          offsetMs = quelleRoh.offset_ms;
        } else {
          anzahlOhneOffset += 1;
        }

        bereinigteQuellen[winkel] = {
          file: quelleRoh.file.trim(),
          source_mode: sourceMode,
          start_ms: startMs,
          end_ms: endMs,
          ...(offsetMs !== undefined ? { offset_ms: offsetMs } : {}),
        };
        mindestensEineQuelle = true;
      }

      if (!mindestensEineQuelle) {
        fehler.push(`${praefix} benötigt mindestens eine gültige Videoquelle.`);
      }

      for (const winkel of angles) {
        if (!(winkel in bereinigteQuellen)) {
          bereinigteQuellen[winkel] = null;
          anzahlWinkelLuecken += 1;
        }
      }

      const breakdown = istObjekt(playRoh.breakdown)
        ? (playRoh.breakdown as PlayBreakdown)
        : undefined;

      const notes: CoachNotiz[] | undefined = Array.isArray(playRoh.notes)
        ? playRoh.notes
            .filter(
              (n): n is Record<string, unknown> =>
                istObjekt(n) && typeof n.text === 'string' && typeof n.timestamp_ms === 'number'
            )
            .map((n, noteIdx) => ({
              id: typeof n.id === 'string' ? n.id : `note-${index}-${noteIdx}`,
              timestamp_ms: n.timestamp_ms as number,
              text: (n.text as string).trim(),
              status: n.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
              autorRolle: n.autorRolle === 'PLAYER' ? 'PLAYER' : 'COACH',
            }))
        : undefined;

      spielzuege.push({
        play_number: typeof playRoh.play_number === 'number' ? playRoh.play_number : index + 1,
        sources: bereinigteQuellen,
        ...(breakdown ? { breakdown } : {}),
        ...(notes && notes.length > 0 ? { notes } : {}),
      });
    });
  }

  if (fehler.length > 0) {
    return { ok: false, fehler, hinweise };
  }

  if (anzahlWinkelLuecken > 0) {
    hinweise.push(
      `${anzahlWinkelLuecken} fehlende Kamera-Zuordnung(en) erkannt – werden im Sync-Editor als Lücken dargestellt.`
    );
  }
  if (anzahlOhneOffset > 0 && angles.length > 1) {
    hinweise.push(
      'Optionale Sync-Offsets nicht überall gesetzt – Standardversatz 0 ms wird verwendet.'
    );
  }

  return {
    ok: true,
    bundle: {
      schema_version: '1.0',
      reel: {
        title: reelTitel,
        category: reelKategorie,
        event_date: reelDatum,
        visibility: reelFreigabe,
      },
      angles,
      plays: spielzuege,
    },
    fehler,
    hinweise,
  };
}

export function bundleZuReel(
  bundle: SidelineBundleV1,
  teamId: string,
  thumbnailUrl: string
): VideoReel {
  const getaggtePlays = bundle.plays.filter(
    (play) => play.breakdown && Object.keys(play.breakdown).length > 0
  ).length;

  const hatTimeSlice = bundle.plays.some((play) =>
    Object.values(play.sources).some((q) => q?.source_mode === 'TIME_SLICE')
  );

  const entwurfsNotizen = bundle.plays.reduce(
    (summe, play) =>
      summe + (play.notes?.filter((notiz) => notiz.status === 'DRAFT').length ?? 0),
    0
  );

  return {
    id: `reel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    teamId,
    title: bundle.reel.title,
    category: bundle.reel.category,
    eventDate: bundle.reel.event_date,
    thumbnailUrl,
    angles: bundle.angles,
    sourceMode: hatTimeSlice ? 'TIME_SLICE' : 'CLIP_FILE',
    playCount: bundle.plays.length,
    taggedCount: getaggtePlays,
    visibility: bundle.reel.visibility ?? 'COACHES_ONLY',
    teamFreigaben: [],
    shareLinks: [],
    draftNoteCount: entwurfsNotizen,
    plays: bundle.plays,
  };
}

export function reelZuBundle(reel: VideoReel): SidelineBundleV1 {
  return {
    schema_version: '1.0',
    reel: {
      title: reel.title,
      category: reel.category,
      event_date: reel.eventDate,
      visibility: reel.visibility,
    },
    angles: [...reel.angles],
    plays: reel.plays,
  };
}

/**
 * Erzeugt ein datenschutzgefiltertes Bundle für Team-Tausch oder /share/ Download-Links.
 * Coach-Notizen und Canvas-Zeichnungen werden niemals an fremde Teams/Links weitergegeben.
 */
export function filtereBundleFuerFreigabe(
  reel: VideoReel,
  freigegebeneFelder: BreakdownFeldKey[]
): SidelineBundleV1 {
  const erlaubteFelder = new Set<BreakdownFeldKey>(freigegebeneFelder);

  return {
    schema_version: '1.0',
    reel: {
      title: reel.title,
      category: reel.category,
      event_date: reel.eventDate,
    },
    angles: [...reel.angles],
    plays: reel.plays.map((play) => {
      const gefiltertesBreakdown: PlayBreakdown = {};
      const gefilterteCustom: Record<string, string | number | undefined> = {};

      if (play.breakdown && erlaubteFelder.size > 0) {
        for (const feld of erlaubteFelder) {
          if (feld in play.breakdown) {
            const wert = (play.breakdown as Record<string, unknown>)[feld];
            if (wert !== undefined) {
              (gefiltertesBreakdown as Record<string, unknown>)[feld] = wert;
            }
          } else if (play.breakdown.custom && feld in play.breakdown.custom) {
            const wert = play.breakdown.custom[feld];
            if (wert !== undefined) {
              gefilterteCustom[feld] = wert;
            }
          }
        }
      }

      if (Object.keys(gefilterteCustom).length > 0) {
        gefiltertesBreakdown.custom = gefilterteCustom;
      }

      return {
        play_number: play.play_number,
        sources: play.sources,
        ...(Object.keys(gefiltertesBreakdown).length > 0
          ? { breakdown: gefiltertesBreakdown }
          : {}),
      };
    }),
  };
}

export function istShareLinkGueltig(
  link: ShareDownloadLink,
  jetzt: Date = new Date()
): boolean {
  if (!link.aktiv) return false;
  const ablauf = Date.parse(link.gueltigBis);
  if (Number.isNaN(ablauf)) return false;
  return ablauf > jetzt.getTime();
}

export function generiereShareLinkPfad(): { token: string; pfad: string } {
  const zeichen = 'abcdefghjkmnpqrstuvwxyz23456789';
  let token = 'sl-';
  for (let i = 0; i < 8; i += 1) {
    token += zeichen[Math.floor(Math.random() * zeichen.length)];
  }
  return { token, pfad: `/share/${token}` };
}

/**
 * Exportiert Spielzüge als Hudl-kompatible CSV-Tabelle auf Basis des aktiven Tagging-Schemas
 * (optional eingeschränkt auf freigegebene Spalten).
 */
export function exportiereBreakdownAlsCsv(
  plays: Spielzug[],
  felder?: BreakdownFeldKey[],
  schema: TagFeldKonfig[] = STANDARD_TAG_SCHEMA
): string {
  const spalten = felder
    ? schema.filter((f) => felder.includes(f.key))
    : schema.filter((f) => f.aktiv);

  const escapeCsv = (wert: unknown): string => {
    if (wert === undefined || wert === null) return '';
    const text = String(wert);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const kopfzeile = ['PLAY #', ...spalten.map((s) => s.kurz)].join(',');
  const zeilen = plays.map((play) => {
    const werte = spalten.map((s) => escapeCsv(leseBreakdownWert(play.breakdown, s)));
    return [play.play_number, ...werte].join(',');
  });

  return [kopfzeile, ...zeilen].join('\n');
}

export function erstelleBeispielBundle(): SidelineBundleV1 {
  return {
    schema_version: '1.0',
    reel: {
      title: 'vs. Frankfurt Universe (Companion Import)',
      category: 'GAME',
      event_date: '2026-11-19',
      visibility: 'COACHES_ONLY',
    },
    angles: ['SIDELINE', 'ENDZONE'],
    plays: [
      {
        play_number: 1,
        sources: {
          SIDELINE: { file: 'sl_001.mp4', source_mode: 'CLIP_FILE', start_ms: 0, end_ms: 8200 },
          ENDZONE: {
            file: 'ez_001.mp4',
            source_mode: 'CLIP_FILE',
            start_ms: 0,
            end_ms: 7900,
            offset_ms: 300,
          },
        },
        breakdown: {
          odk: 'O',
          down: 1,
          distance: 10,
          yard_line: -25,
          hash: 'L',
          play_type: 'RUN',
          off_pers: '11',
          off_form: 'Trips',
          off_strg: 'L',
          backfield: 'Gun Right',
          motion: 'None',
          off_play: 'Inside Zone',
          rpo: 'Bubble',
          play_dir: 'R',
          gn_ls: 7,
          def_str: 'L',
          def_front: '4-3',
          def_pers: 'Base',
          coverage: 'Cover 3',
          stunt: 'None',
          blitz: 'None',
        },
        notes: [
          {
            id: 'demo-n1',
            timestamp_ms: 2100,
            text: 'Sauberer Double-Team am 3-Tech, Cutback-Lane offen.',
            status: 'DRAFT',
            autorRolle: 'COACH',
          },
        ],
      },
      {
        play_number: 2,
        sources: {
          SIDELINE: { file: 'sl_002.mp4', source_mode: 'CLIP_FILE', start_ms: 0, end_ms: 9100 },
          ENDZONE: { file: 'ez_002.mp4', source_mode: 'CLIP_FILE', start_ms: 0, end_ms: 9100 },
        },
        breakdown: {
          odk: 'O',
          down: 2,
          distance: 3,
          yard_line: -32,
          hash: 'L',
          play_type: 'PASS',
          off_pers: '11',
          off_form: 'Doubles',
          off_strg: 'R',
          backfield: 'Gun Left',
          motion: 'Jet',
          off_play: 'Mesh',
          rpo: 'None',
          play_dir: 'M',
          result: 'COMPLETE',
          gn_ls: 14,
          def_str: 'R',
          def_front: '4-2-5',
          def_pers: 'Nickel',
          coverage: 'Cover 2',
          stunt: 'None',
          blitz: 'None',
        },
      },
      {
        play_number: 3,
        sources: {
          SIDELINE: { file: 'sl_003.mp4', source_mode: 'CLIP_FILE', start_ms: 0, end_ms: 6800 },
          ENDZONE: null,
        },
        breakdown: {
          odk: 'O',
          down: 1,
          distance: 10,
          yard_line: -46,
          hash: 'R',
          play_type: 'PASS',
          off_pers: '10',
          off_form: 'Empty',
          off_strg: 'L',
          backfield: 'Empty',
          motion: 'None',
          off_play: 'Four Verts',
          rpo: 'None',
          play_dir: 'L',
          result: 'INCOMPLETE',
          gn_ls: 0,
          def_str: 'L',
          def_front: '4-2-5',
          def_pers: 'Nickel',
          coverage: 'Man Free',
          stunt: 'T/E',
          blitz: 'Mike',
        },
      },
    ],
  };
}
