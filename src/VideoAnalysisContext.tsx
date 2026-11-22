import { createContext, useContext, useState, type ReactNode } from 'react';
import { filtereNachSaison, type TeamRolle } from '../../sdk/plugin.ts';
import type {
  BreakdownFeldKey,
  CanvasZeichnung,
  CoachNotiz,
  NormPunkt,
  NutzerEinstellungen,
  ShareDownloadLink,
  SpielerFreigabe,
  TagFeldKonfig,
  TeamFreigabeEintrag,
  VideoReel,
} from './types.ts';
import { INITIALE_DEMO_REELS } from './data/demoReels.ts';
import {
  STANDARD_HOTKEYS,
  STANDARD_NUTZER_EINSTELLUNGEN,
} from './services/frameAndHotkeys.ts';
import {
  STANDARD_TAG_SCHEMA,
  registriereDefinitionWennNeu,
  wendeBreakdownUpdateMitAutoCalcAn,
} from './services/taggingEngine.ts';

const SETTINGS_STORAGE_KEY = 'sidelineos.plugin.video.user_settings.v1';

function ladeNutzerEinstellungen(): NutzerEinstellungen {
  try {
    const roh = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!roh) return STANDARD_NUTZER_EINSTELLUNGEN;
    const geparst = JSON.parse(roh) as Partial<NutzerEinstellungen>;
    return {
      ...STANDARD_NUTZER_EINSTELLUNGEN,
      ...geparst,
      hotkeys: {
        ...STANDARD_HOTKEYS,
        ...(geparst.hotkeys ?? {}),
      },
    };
  } catch {
    return STANDARD_NUTZER_EINSTELLUNGEN;
  }
}

function zaehleGetaggtePlays(reel: VideoReel): number {
  return reel.plays.filter((play) => {
    if (!play.breakdown) return false;
    const hatStandard = Object.entries(play.breakdown).some(
      ([k, v]) => k !== 'custom' && v !== undefined && v !== ''
    );
    const hatCustom =
      play.breakdown.custom !== undefined &&
      Object.values(play.breakdown.custom).some((v) => v !== undefined && v !== '');
    return hatStandard || hatCustom;
  }).length;
}

function zaehleEntwuerfe(reel: VideoReel): number {
  return reel.plays.reduce((summe, play) => {
    const notes = (play.notes ?? []).filter((n) => n.status === 'DRAFT').length;
    const drawings = (play.drawings ?? []).filter((d) => d.status === 'DRAFT').length;
    return summe + notes + drawings;
  }, 0);
}

export interface VideoAnalysisContextWert {
  reels: VideoReel[];
  tagSchema: TagFeldKonfig[];
  nutzerEinstellungen: NutzerEinstellungen;
  ausgewaehltesReelId: string;
  uploadHervorgehoben: boolean;
  setAusgewaehltesReelId: (reelId: string) => void;
  highlightUpload: () => void;
  ermittleAusgewaehltesReel: (
    teamId: string,
    saison: string,
    teamRolle: TeamRolle
  ) => VideoReel | null;
  onNutzerEinstellungenAendern: (neu: NutzerEinstellungen) => void;
  onNeuesReel: (neuesReel: VideoReel) => void;
  onFreigabeAendern: (reelId: string, freigabe: SpielerFreigabe) => void;
  onTeamFreigabenAendern: (reelId: string, freigaben: TeamFreigabeEintrag[]) => void;
  onShareLinksAendern: (reelId: string, links: ShareDownloadLink[]) => void;
  onFeldAendern: (
    reelId: string,
    playNumber: number,
    feldKey: BreakdownFeldKey,
    wert: string | number | undefined,
    istCustom: boolean
  ) => void;
  onDefinitionLernen: (feldKey: BreakdownFeldKey, begriff: string) => void;
  onFeldToggle: (feldKey: BreakdownFeldKey) => void;
  onDefinitionLoeschen: (feldKey: BreakdownFeldKey, begriff: string) => void;
  onCustomFeldErstellen: (neuesFeld: TagFeldKonfig) => void;
  onCustomFeldLoeschen: (feldKey: BreakdownFeldKey) => void;
  onNotizHinzufuegen: (reelId: string, playNumber: number, notiz: CoachNotiz) => void;
  onNotizBearbeiten: (
    reelId: string,
    playNumber: number,
    notizId: string,
    neuerText: string
  ) => void;
  onNotizLoeschen: (reelId: string, playNumber: number, notizId: string) => void;
  onZeichnungHinzufuegen: (
    reelId: string,
    playNumber: number,
    zeichnung: CanvasZeichnung
  ) => void;
  onZeichnungAktualisieren: (
    reelId: string,
    playNumber: number,
    zeichnungId: string,
    punkte: NormPunkt[]
  ) => void;
  onZeichnungEntfernen: (reelId: string, playNumber: number, zeichnungId: string) => void;
  onLetzteZeichnungEntfernen: (reelId: string, playNumber: number, angle: string) => void;
  onAlleZeichnungenLeeren: (reelId: string, playNumber: number, angle: string) => void;
  onSessionVeroeffentlichen: (reelId: string) => void;
}

const VideoAnalysisContext = createContext<VideoAnalysisContextWert | null>(null);

export function VideoAnalysisProvider({ children }: { children: ReactNode }) {
  const [reels, setReels] = useState<VideoReel[]>(INITIALE_DEMO_REELS);
  const [tagSchema, setTagSchema] = useState<TagFeldKonfig[]>(STANDARD_TAG_SCHEMA);
  const [nutzerEinstellungen, setNutzerEinstellungen] = useState<NutzerEinstellungen>(
    ladeNutzerEinstellungen
  );
  const [ausgewaehltesReelId, setAusgewaehltesReelId] = useState<string>(
    INITIALE_DEMO_REELS[0].id
  );
  const [uploadHervorgehoben, setUploadHervorgehoben] = useState(false);

  const onNutzerEinstellungenAendern = (neu: NutzerEinstellungen) => {
    setNutzerEinstellungen(neu);
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(neu));
    } catch {
      // Speicher im eingebetteten Kontext ggf. deaktiviert
    }
  };

  const highlightUpload = () => {
    setUploadHervorgehoben(true);
    setTimeout(() => {
      document.getElementById('upload-panel')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    setTimeout(() => setUploadHervorgehoben(false), 1800);
  };

  const aktualisiereReel = (reelId: string, updater: (reel: VideoReel) => VideoReel) => {
    setReels((alt) =>
      alt.map((reel) => {
        if (reel.id !== reelId) return reel;
        const neu = updater(reel);
        return {
          ...neu,
          playCount: neu.plays.length,
          taggedCount: zaehleGetaggtePlays(neu),
          draftNoteCount: zaehleEntwuerfe(neu),
        };
      })
    );
  };

  const ermittleAusgewaehltesReel = (
    teamId: string,
    saison: string,
    teamRolle: TeamRolle
  ): VideoReel | null => {
    const sichtbar = filtereNachSaison(
      reels.filter(
        (r) =>
          r.teamId === teamId &&
          (teamRolle === 'PLAYER' ? r.visibility !== 'COACHES_ONLY' : true)
      ),
      saison
    );
    return sichtbar.find((r) => r.id === ausgewaehltesReelId) ?? sichtbar[0] ?? null;
  };

  const wert: VideoAnalysisContextWert = {
    reels,
    tagSchema,
    nutzerEinstellungen,
    ausgewaehltesReelId,
    uploadHervorgehoben,
    setAusgewaehltesReelId,
    highlightUpload,
    ermittleAusgewaehltesReel,
    onNutzerEinstellungenAendern,
    onNeuesReel: (neuesReel) => {
      setReels((alt) => [neuesReel, ...alt]);
      setAusgewaehltesReelId(neuesReel.id);
    },
    onFreigabeAendern: (reelId, freigabe) => {
      aktualisiereReel(reelId, (reel) => ({ ...reel, visibility: freigabe }));
    },
    onTeamFreigabenAendern: (reelId, teamFreigaben) => {
      aktualisiereReel(reelId, (reel) => ({ ...reel, teamFreigaben }));
    },
    onShareLinksAendern: (reelId, shareLinks) => {
      aktualisiereReel(reelId, (reel) => ({ ...reel, shareLinks }));
    },
    onFeldAendern: (reelId, playNumber, feldKey, wertNeu, istCustom) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: wendeBreakdownUpdateMitAutoCalcAn(
          reel.plays,
          playNumber,
          feldKey,
          wertNeu,
          istCustom
        ),
      }));
    },
    onDefinitionLernen: (feldKey, begriff) => {
      setTagSchema((alt) => registriereDefinitionWennNeu(alt, feldKey, begriff));
    },
    onFeldToggle: (feldKey) => {
      setTagSchema((alt) =>
        alt.map((f) => (f.key === feldKey ? { ...f, aktiv: !f.aktiv } : f))
      );
    },
    onDefinitionLoeschen: (feldKey, begriff) => {
      setTagSchema((alt) =>
        alt.map((f) =>
          f.key === feldKey
            ? { ...f, definitionen: (f.definitionen ?? []).filter((d) => d !== begriff) }
            : f
        )
      );
    },
    onCustomFeldErstellen: (neuesFeld) => {
      setTagSchema((alt) => [...alt, neuesFeld]);
    },
    onCustomFeldLoeschen: (feldKey) => {
      setTagSchema((alt) => alt.filter((f) => f.key !== feldKey));
    },
    onNotizHinzufuegen: (reelId, playNumber, notiz) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) =>
          play.play_number === playNumber
            ? { ...play, notes: [...(play.notes ?? []), notiz] }
            : play
        ),
      }));
    },
    onNotizBearbeiten: (reelId, playNumber, notizId, neuerText) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) =>
          play.play_number === playNumber
            ? {
                ...play,
                notes: (play.notes ?? []).map((n) =>
                  n.id === notizId ? { ...n, text: neuerText } : n
                ),
              }
            : play
        ),
      }));
    },
    onNotizLoeschen: (reelId, playNumber, notizId) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) =>
          play.play_number === playNumber
            ? {
                ...play,
                notes: (play.notes ?? []).filter((n) => n.id !== notizId),
              }
            : play
        ),
      }));
    },
    onZeichnungHinzufuegen: (reelId, playNumber, zeichnung) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) =>
          play.play_number === playNumber
            ? { ...play, drawings: [...(play.drawings ?? []), zeichnung] }
            : play
        ),
      }));
    },
    onZeichnungAktualisieren: (reelId, playNumber, zeichnungId, punkte) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) =>
          play.play_number === playNumber
            ? {
                ...play,
                drawings: (play.drawings ?? []).map((d) =>
                  d.id === zeichnungId ? { ...d, punkte } : d
                ),
              }
            : play
        ),
      }));
    },
    onZeichnungEntfernen: (reelId, playNumber, zeichnungId) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) =>
          play.play_number === playNumber
            ? { ...play, drawings: (play.drawings ?? []).filter((d) => d.id !== zeichnungId) }
            : play
        ),
      }));
    },
    onLetzteZeichnungEntfernen: (reelId, playNumber, angle) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) => {
          if (play.play_number !== playNumber) return play;
          const liste = [...(play.drawings ?? [])];
          for (let i = liste.length - 1; i >= 0; i -= 1) {
            if (liste[i].angle === angle) {
              liste.splice(i, 1);
              break;
            }
          }
          return { ...play, drawings: liste };
        }),
      }));
    },
    onAlleZeichnungenLeeren: (reelId, playNumber, angle) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) =>
          play.play_number === playNumber
            ? { ...play, drawings: (play.drawings ?? []).filter((d) => d.angle !== angle) }
            : play
        ),
      }));
    },
    onSessionVeroeffentlichen: (reelId) => {
      aktualisiereReel(reelId, (reel) => ({
        ...reel,
        plays: reel.plays.map((play) => ({
          ...play,
          notes: play.notes?.map((n) => ({ ...n, status: 'PUBLISHED' as const })),
          drawings: play.drawings?.map((d) => ({ ...d, status: 'PUBLISHED' as const })),
        })),
      }));
    },
  };

  return (
    <VideoAnalysisContext.Provider value={wert}>{children}</VideoAnalysisContext.Provider>
  );
}

export function useVideoAnalysis(): VideoAnalysisContextWert {
  const ctx = useContext(VideoAnalysisContext);
  if (!ctx) {
    throw new Error('useVideoAnalysis muss innerhalb eines VideoAnalysisProvider verwendet werden.');
  }
  return ctx;
}
