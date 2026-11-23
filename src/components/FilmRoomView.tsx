import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  Send,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  Type,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import type { TeamRolle } from '@sidelineos/plugin-sdk';
import type {
  BreakdownFeldKey,
  CanvasZeichnung,
  CoachNotiz,
  KommentarEcke,
  NormPunkt,
  NutzerEinstellungen,
  SpielerFreigabe,
  TagFeldKonfig,
  VideoReel,
  ZeichenWerkzeug,
} from '../types.ts';
import {
  FRAME_MS,
  findeNaechstenAutoStopFrame,
  frameZuZeit,
  istGleicherFrame,
  zeitZuFrame,
} from '../services/frameAndHotkeys.ts';
import { THUMB_ENDZONE, THUMB_SIDELINE } from '../data/demoReels.ts';
import { leseBreakdownWert } from '../services/taggingEngine.ts';
import {
  createVideoTranslator,
  holeVideoEckeLabel,
  holeVideoFreigabeLabel,
} from '../i18n.ts';
import { BreakdownGrid } from './BreakdownGrid.tsx';
import { TelestrationCanvas } from './TelestrationCanvas.tsx';

interface FilmRoomViewProps {
  reel: VideoReel;
  teamRolle: TeamRolle;
  tagSchema: TagFeldKonfig[];
  nutzerEinstellungen: NutzerEinstellungen;
  locale?: string;
  onZurueck: () => void;
  onSchemaSettingsOeffnen: () => void;
  onFreigabeAendern: (reelId: string, freigabe: SpielerFreigabe) => void;
  onFeldAendern: (
    reelId: string,
    playNumber: number,
    feldKey: BreakdownFeldKey,
    wert: string | number | undefined,
    istCustom: boolean
  ) => void;
  onDefinitionLernen: (feldKey: BreakdownFeldKey, wert: string) => void;
  onNotizHinzufuegen: (reelId: string, playNumber: number, notiz: CoachNotiz) => void;
  onNotizBearbeiten: (
    reelId: string,
    playNumber: number,
    notizId: string,
    neuerText: string
  ) => void;
  onNotizLoeschen: (reelId: string, playNumber: number, notizId: string) => void;
  onZeichnungHinzufuegen: (reelId: string, playNumber: number, zeichnung: CanvasZeichnung) => void;
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

const TEAM_FARBEN = [
  { id: 'amber', hex: '#F59E0B', labelKey: 'filmRoom.colorAmber' },
  { id: 'offense', hex: '#3B82F6', labelKey: 'filmRoom.colorOffense' },
  { id: 'defense', hex: '#EF4444', labelKey: 'filmRoom.colorDefense' },
  { id: 'route', hex: '#22C55E', labelKey: 'filmRoom.colorRoute' },
  { id: 'white', hex: '#FFFFFF', labelKey: 'filmRoom.colorWhite' },
] as const;

const FREIGABE_OPTIONEN: SpielerFreigabe[] = [
  'COACHES_ONLY',
  'ALL_PLAYERS',
  'UNIT_OFFENSE',
  'UNIT_DEFENSE',
  'UNIT_SPECIAL_TEAMS',
];

const ECKEN_POSITION_KLASSEN: Record<KommentarEcke, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-16 left-3',
  'bottom-right': 'bottom-16 right-3',
};

const ECKEN_BUTTONS: Array<{ id: KommentarEcke; kurz: string }> = [
  { id: 'top-left', kurz: '↖' },
  { id: 'top-right', kurz: '↗' },
  { id: 'bottom-left', kurz: '↙' },
  { id: 'bottom-right', kurz: '↘' },
];

function formatiereZeit(ms: number): string {
  const geklemmt = Math.max(0, ms);
  const sekundenGesamt = Math.floor(geklemmt / 1000);
  const minuten = Math.floor(sekundenGesamt / 60);
  const sekunden = sekundenGesamt % 60;
  const hundertstel = Math.floor((geklemmt % 1000) / 10);
  return `${String(minuten).padStart(2, '0')}:${String(sekunden).padStart(2, '0')}.${String(hundertstel).padStart(2, '0')}`;
}

export function FilmRoomView({
  reel,
  teamRolle,
  tagSchema,
  nutzerEinstellungen,
  locale,
  onZurueck,
  onSchemaSettingsOeffnen,
  onFreigabeAendern,
  onFeldAendern,
  onDefinitionLernen,
  onNotizHinzufuegen,
  onNotizBearbeiten,
  onNotizLoeschen,
  onZeichnungHinzufuegen,
  onZeichnungAktualisieren,
  onZeichnungEntfernen,
  onLetzteZeichnungEntfernen,
  onAlleZeichnungenLeeren,
  onSessionVeroeffentlichen,
}: FilmRoomViewProps) {
  const t = createVideoTranslator(locale);
  const istCoach = teamRolle === 'COACH' || teamRolle === 'TEAM_ADMIN';
  const istTeamAdmin = teamRolle === 'TEAM_ADMIN';
  const hotkeys = nutzerEinstellungen.hotkeys;

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const gestoppteFramesRef = useRef<Set<number>>(new Set());

  const [aktiverPlayIndex, setAktiverPlayIndex] = useState(0);
  const [aktiverWinkel, setAktiverWinkel] = useState<string>(reel.angles[0] ?? 'SIDELINE');
  const [laeuft, setLaeuft] = useState(false);
  const [zeitMs, setZeitMs] = useState(() => {
    const startWinkel = reel.angles[0] ?? 'SIDELINE';
    const ersteZeichnung = reel.plays[0]?.drawings?.find((d) => d.angle === startWinkel);
    return ersteZeichnung ? frameZuZeit(zeitZuFrame(ersteZeichnung.timestamp_ms)) : 0;
  });
  const zeitMsRef = useRef<number>(zeitMs);
  const [geschwindigkeit, setGeschwindigkeit] = useState<0.5 | 1 | 1.5>(
    nutzerEinstellungen.standardGeschwindigkeit
  );
  const [autoStop, setAutoStop] = useState(nutzerEinstellungen.standardAutoStop);
  const [autoStopMeldung, setAutoStopMeldung] = useState<string | null>(null);
  const [publishBestaetigung, setPublishBestaetigung] = useState<string | null>(null);

  // Vollbild & Overlays über dem Video
  const [vollbildAktiv, setVollbildAktiv] = useState(false);
  const [zeichenOverlaySichtbar, setZeichenOverlaySichtbar] = useState(true);
  const [kommentarOverlaySichtbar, setKommentarOverlaySichtbar] = useState(true);
  const [kommentarEcke, setKommentarEcke] = useState<KommentarEcke>(
    nutzerEinstellungen.standardKommentarEcke
  );

  const [werkzeug, setWerkzeug] = useState<ZeichenWerkzeug | null>('select');
  const [farbe, setFarbe] = useState<string>('#F59E0B');
  const [ausgewaehlteZeichnungId, setAusgewaehlteZeichnungId] = useState<string | null>(null);
  const [notizText, setNotizText] = useState('');
  const [bearbeiteNotizId, setBearbeiteNotizId] = useState<string | null>(null);
  const [bearbeiteNotizText, setBearbeiteNotizText] = useState('');
  const [tagGruppeTab, setTagGruppeTab] = useState<'ALLE' | 'SITUATION' | 'OFFENSE' | 'DEFENSE'>(
    'ALLE'
  );

  // Persönliche Voreinstellungen übernehmen, wenn der Nutzer sie in Einstellungen anpasst
  useEffect(() => {
    setKommentarEcke(nutzerEinstellungen.standardKommentarEcke);
    setAutoStop(nutzerEinstellungen.standardAutoStop);
    setGeschwindigkeit(nutzerEinstellungen.standardGeschwindigkeit);
  }, [
    nutzerEinstellungen.standardKommentarEcke,
    nutzerEinstellungen.standardAutoStop,
    nutzerEinstellungen.standardGeschwindigkeit,
  ]);

  const sichererIndex = Math.min(aktiverPlayIndex, Math.max(0, reel.plays.length - 1));
  const aktiverPlay = reel.plays[sichererIndex] ?? null;

  const aktuelleQuelle = aktiverPlay?.sources[aktiverWinkel] ?? null;
  const dauerMs = useMemo(() => {
    if (!aktuelleQuelle) {
      const ersteQuelle = aktiverPlay
        ? Object.values(aktiverPlay.sources).find((q) => q !== null)
        : null;
      return ersteQuelle ? Math.max(1000, ersteQuelle.end_ms - ersteQuelle.start_ms) : 8000;
    }
    return Math.max(1000, aktuelleQuelle.end_ms - aktuelleQuelle.start_ms);
  }, [aktuelleQuelle, aktiverPlay]);

  // Zeichnungen strikt gefiltert nach dem AKTIVEN Video/Kamerawinkel + Rolle
  const winkelZeichnungen = useMemo(() => {
    const alle = (aktiverPlay?.drawings ?? []).filter((z) => z.angle === aktiverWinkel);
    return istCoach ? alle : alle.filter((z) => z.status === 'PUBLISHED');
  }, [aktiverPlay, aktiverWinkel, istCoach]);

  // Exakte Frame-Bindung: Zeichnungen werden ausschließlich auf ihrem exakten Frame angezeigt
  const sichtbareZeichnungenJetzt = useMemo(
    () => winkelZeichnungen.filter((z) => istGleicherFrame(z.timestamp_ms, zeitMs)),
    [winkelZeichnungen, zeitMs]
  );

  const playNotizen = useMemo(() => {
    const alle = aktiverPlay?.notes ?? [];
    return istCoach
      ? alle
      : alle.filter((n) => n.status === 'PUBLISHED' || n.autorRolle === 'PLAYER');
  }, [aktiverPlay, istCoach]);

  const aktiveOverlayNotizen = useMemo(() => {
    const zeitnah = playNotizen.filter((n) => Math.abs(n.timestamp_ms - zeitMs) <= 2200);
    return zeitnah.length > 0 ? zeitnah : playNotizen.slice(0, 2);
  }, [playNotizen, zeitMs]);

  const darfNotizBearbeiten = (notiz: CoachNotiz): boolean =>
    Boolean(notiz.id) && (istCoach || notiz.autorRolle === 'PLAYER');

  const starteNotizBearbeitung = (notiz: CoachNotiz) => {
    if (!notiz.id || !darfNotizBearbeiten(notiz)) return;
    setBearbeiteNotizId(notiz.id);
    setBearbeiteNotizText(notiz.text);
  };

  const speichereNotizBearbeitung = () => {
    if (!aktiverPlay || !bearbeiteNotizId) return;
    const bereinigt = bearbeiteNotizText.trim();
    if (!bereinigt) return;
    onNotizBearbeiten(reel.id, aktiverPlay.play_number, bearbeiteNotizId, bereinigt);
    setBearbeiteNotizId(null);
    setBearbeiteNotizText('');
  };

  const brecheNotizBearbeitungAb = () => {
    setBearbeiteNotizId(null);
    setBearbeiteNotizText('');
  };

  const gesamtEntwuerfe = useMemo(
    () =>
      reel.plays.reduce((summe, play) => {
        const draftNotes = (play.notes ?? []).filter((n) => n.status === 'DRAFT').length;
        const draftDrawings = (play.drawings ?? []).filter((d) => d.status === 'DRAFT').length;
        return summe + draftNotes + draftDrawings;
      }, 0),
    [reel.plays]
  );

  const aktiveTagFelder = useMemo(() => {
    const aktiv = tagSchema.filter((f) => f.aktiv);
    if (tagGruppeTab === 'ALLE') return aktiv;
    if (tagGruppeTab === 'SITUATION') {
      return aktiv.filter((f) => f.gruppe === 'SITUATION' || f.gruppe === 'RESULT' || f.gruppe === 'CUSTOM');
    }
    return aktiv.filter((f) => f.gruppe === tagGruppeTab || f.gruppe === 'CUSTOM');
  }, [tagSchema, tagGruppeTab]);

  // Native Fullscreen-Events abgleichen
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setVollbildAktiv(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleVollbild = async () => {
    if (!vollbildAktiv) {
      setVollbildAktiv(true);
      try {
        if (playerContainerRef.current?.requestFullscreen) {
          await playerContainerRef.current.requestFullscreen();
        }
      } catch {
        // Fallback: CSS-Vollbild greift automatisch über vollbildAktiv
      }
    } else {
      setVollbildAktiv(false);
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        // ignorieren
      }
    }
  };

  const setzeZeitExakt = (zielMs: number, resetAutoStop = true) => {
    const geklemmt = Math.min(dauerMs, Math.max(0, zielMs));
    const quantisiert = frameZuZeit(zeitZuFrame(geklemmt));
    zeitMsRef.current = quantisiert;
    if (resetAutoStop) {
      gestoppteFramesRef.current.clear();
    }
    setZeitMs(quantisiert);
  };

  const toggleAbspielen = () => {
    setAutoStopMeldung(null);
    if (laeuft) {
      setLaeuft(false);
      // Beim manuellen Pausieren auf exakten Frame einrasten
      const gerastet = frameZuZeit(zeitZuFrame(zeitMsRef.current));
      zeitMsRef.current = gerastet;
      setZeitMs(gerastet);
      return;
    }
    if (zeitMsRef.current >= dauerMs - FRAME_MS) {
      zeitMsRef.current = 0;
      setZeitMs(0);
      gestoppteFramesRef.current.clear();
    }
    setLaeuft(true);
  };

  const wechslePlay = (neuerIndex: number) => {
    if (neuerIndex < 0 || neuerIndex >= reel.plays.length) return;
    setAktiverPlayIndex(neuerIndex);
    setLaeuft(false);
    setAutoStopMeldung(null);
    setAusgewaehlteZeichnungId(null);
    setBearbeiteNotizId(null);
    gestoppteFramesRef.current.clear();

    const zielPlay = reel.plays[neuerIndex];
    const ersteMarkierung =
      zielPlay.drawings?.find((d) => d.angle === aktiverWinkel)?.timestamp_ms ??
      zielPlay.notes?.[0]?.timestamp_ms ??
      0;
    const zielQuantisiert = frameZuZeit(zeitZuFrame(ersteMarkierung));
    zeitMsRef.current = zielQuantisiert;
    setZeitMs(zielQuantisiert);

    if (zielPlay && !zielPlay.sources[aktiverWinkel]) {
      const ersatz = reel.angles.find((w) => zielPlay.sources[w] !== null);
      if (ersatz) setAktiverWinkel(ersatz);
    }
  };

  // Race-freier Playback-Loop: stoppt exakt auf dem Ziel-Frame ohne Nachlauf-Tick
  useEffect(() => {
    if (!laeuft) return;
    let aktiv = true;
    let letzterTick = performance.now();
    let rafId = 0;

    const schritt = (jetzt: number) => {
      if (!aktiv) return;
      const delta = Math.max(0, (jetzt - letzterTick) * geschwindigkeit);
      letzterTick = jetzt;

      const alt = zeitMsRef.current;
      const neu = alt + delta;

      if (autoStop) {
        const treffer = findeNaechstenAutoStopFrame(
          alt,
          neu,
          winkelZeichnungen.map((z) => z.timestamp_ms),
          gestoppteFramesRef.current
        );
        if (treffer) {
          aktiv = false;
          gestoppteFramesRef.current.add(treffer.zielFrame);
          zeitMsRef.current = treffer.zielMs;
          setZeitMs(treffer.zielMs);
          setLaeuft(false);
          setAutoStopMeldung(
            t('filmRoom.autoStopMessage', {
              frame: treffer.zielFrame,
              time: formatiereZeit(treffer.zielMs),
            })
          );
          return;
        }
      }

      if (neu >= dauerMs) {
        aktiv = false;
        const endeMs = frameZuZeit(zeitZuFrame(dauerMs));
        zeitMsRef.current = endeMs;
        setZeitMs(endeMs);
        setLaeuft(false);
        gestoppteFramesRef.current.clear();
        return;
      }

      zeitMsRef.current = neu;
      setZeitMs(neu);
      rafId = requestAnimationFrame(schritt);
    };

    rafId = requestAnimationFrame(schritt);
    return () => {
      aktiv = false;
      cancelAnimationFrame(rafId);
    };
  }, [laeuft, geschwindigkeit, dauerMs, autoStop, winkelZeichnungen, t]);

  // Konfigurierbare Benutzer-Hotkeys + feste Transport-Tasten im Film Room
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (
        ziel &&
        (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key === 'Escape' && vollbildAktiv) {
        setVollbildAktiv(false);
        return;
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        ausgewaehlteZeichnungId &&
        aktiverPlay &&
        istCoach
      ) {
        e.preventDefault();
        onZeichnungEntfernen(reel.id, aktiverPlay.play_number, ausgewaehlteZeichnungId);
        setAusgewaehlteZeichnungId(null);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        toggleAbspielen();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        wechslePlay(sichererIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        wechslePlay(sichererIndex - 1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setLaeuft(false);
        setAutoStopMeldung(null);
        setzeZeitExakt(frameZuZeit(zeitZuFrame(zeitMsRef.current) + 1));
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setLaeuft(false);
        setAutoStopMeldung(null);
        setzeZeitExakt(frameZuZeit(zeitZuFrame(zeitMsRef.current) - 1));
        return;
      }

      const taste = e.key.toLowerCase();

      if (taste === hotkeys.toggleFullscreen) {
        e.preventDefault();
        void toggleVollbild();
        return;
      }

      if (taste === hotkeys.switchAngle && reel.angles.length > 1 && aktiverPlay) {
        e.preventDefault();
        const idx = reel.angles.indexOf(aktiverWinkel);
        const naechster = reel.angles[(idx + 1) % reel.angles.length];
        if (aktiverPlay.sources[naechster]) {
          setAktiverWinkel(naechster);
          setAusgewaehlteZeichnungId(null);
        }
        return;
      }

      if (!istCoach || !aktiverPlay) return;

      const werkzeugZuordnung: Array<[ZeichenWerkzeug, string]> = [
        ['select', hotkeys.select],
        ['pen', hotkeys.pen],
        ['arrow', hotkeys.arrow],
        ['spotlight', hotkeys.spotlight],
        ['text', hotkeys.text],
      ];

      const trefferWerkzeug = werkzeugZuordnung.find(([, key]) => key === taste);
      if (trefferWerkzeug) {
        e.preventDefault();
        setZeichenOverlaySichtbar(true);
        setWerkzeug((alt) => (alt === trefferWerkzeug[0] ? null : trefferWerkzeug[0]));
        return;
      }

      if (taste === hotkeys.toggleDrawBar) {
        e.preventDefault();
        setZeichenOverlaySichtbar((v) => !v);
        return;
      }

      if (taste === hotkeys.undo && winkelZeichnungen.length > 0) {
        e.preventDefault();
        onLetzteZeichnungEntfernen(reel.id, aktiverPlay.play_number, aktiverWinkel);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleNotizSpeichern = () => {
    if (!aktiverPlay || !notizText.trim()) return;
    onNotizHinzufuegen(reel.id, aktiverPlay.play_number, {
      id: `note-${Date.now()}`,
      timestamp_ms: frameZuZeit(zeitZuFrame(zeitMs)),
      text: notizText.trim(),
      status: istCoach ? 'DRAFT' : 'PUBLISHED',
      autorRolle: istCoach ? 'COACH' : 'PLAYER',
    });
    setNotizText('');
  };

  const handlePublish = () => {
    if (gesamtEntwuerfe === 0) return;
    const anzahl = gesamtEntwuerfe;
    onSessionVeroeffentlichen(reel.id);
    setPublishBestaetigung(t('filmRoom.publishConfirmed', { count: anzahl }));
    setTimeout(() => setPublishBestaetigung(null), 2600);
  };

  const hintergrundBild =
    aktiverWinkel === 'ENDZONE' ? THUMB_ENDZONE : reel.thumbnailUrl || THUMB_SIDELINE;

  const fortschrittProzent = Math.min(100, Math.max(0, (zeitMs / dauerMs) * 100));
  const optionalerOffsetMs = aktuelleQuelle?.offset_ms;
  const zeigeOffset = optionalerOffsetMs !== undefined && optionalerOffsetMs !== 0;

  const simulierterScale = 1 + (fortschrittProzent / 100) * 0.04;
  const simulierterShiftX = (fortschrittProzent / 100 - 0.5) * -1.8;

  const istFlagPlay = aktiverPlay?.breakdown?.result?.toUpperCase() === 'FLAG';

  return (
    <div className="space-y-4">
      {/* Datalists für Quick-Tag Comboboxen */}
      {tagSchema
        .filter((f) => f.aktiv && f.typ === 'combobox' && f.definitionen)
        .map((feld) => (
          <datalist key={`qt-dl-${feld.key}`} id={`qt-dl-${feld.key}`}>
            {feld.definitionen!.map((def) => (
              <option key={def} value={def} />
            ))}
          </datalist>
        ))}

      {/* Film Room Kopfzeile */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#232933] bg-[#13171D] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onZurueck}
            className="inline-flex items-center gap-1.5 rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-[#8B949E] transition-colors hover:border-[#36404F] hover:text-white whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('filmRoom.backLibrary')}
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-white">{reel.title}</h1>
            <div className="text-[11px] text-[#8B949E]">
              {aktiverPlay
                ? t('filmRoom.playMeta', {
                    play: aktiverPlay.play_number,
                    total: reel.plays.length,
                    file: aktuelleQuelle?.file ?? t('filmRoom.noClipInAngle'),
                    angle: aktiverWinkel,
                  })
                : t('filmRoom.noPlays')}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {istCoach && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-[#8B949E]">
                {reel.visibility === 'COACHES_ONLY' ? (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Users className="h-3.5 w-3.5 text-[#4ADE80]" aria-hidden="true" />
                )}
                <select
                  aria-label={t('filmRoom.visibilityAria')}
                  value={reel.visibility}
                  onChange={(e) =>
                    onFreigabeAendern(reel.id, e.target.value as SpielerFreigabe)
                  }
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium focus:border-[#F59E0B] focus:outline-none ${
                    reel.visibility === 'COACHES_ONLY'
                      ? 'border-[#232933] bg-[#0B0E11] text-[#8B949E]'
                      : 'border-[#16A34A]/40 bg-[#16A34A]/10 text-[#86EFAC]'
                  }`}
                >
                  {FREIGABE_OPTIONEN.map((opt) => (
                    <option key={opt} value={opt} className="bg-[#13171D] text-[#E6EDF3]">
                      {t('dashboard.visibilityOption', {
                        label: holeVideoFreigabeLabel(opt, locale),
                      })}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={gesamtEntwuerfe === 0}
                onClick={handlePublish}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#F59E0B] px-3.5 py-1.5 text-xs font-semibold text-[#0B0E11] transition-colors hover:bg-[#FBBF24] disabled:cursor-not-allowed disabled:bg-[#232933] disabled:text-[#6E7681] whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                {t('filmRoom.publishSession', { count: gesamtEntwuerfe })}
              </button>
            </>
          )}
        </div>
      </div>

      {publishBestaetigung && (
        <div
          role="status"
          className="rounded-md border border-[#16A34A]/40 bg-[#16A34A]/10 px-4 py-2 text-xs text-[#86EFAC]"
        >
          {publishBestaetigung}
        </div>
      )}

      {/* Oberer Arbeitsbereich: Links Video + Overlays | Rechts Quick Tags & Notizen */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Video-Player Container (unterstützt Vollbildmodus inkl. Zeichen- & Kommentar-Overlays) */}
        <section
          ref={playerContainerRef}
          className={
            vollbildAktiv
              ? 'fixed inset-0 z-50 flex flex-col bg-[#0B0E11]'
              : 'overflow-hidden rounded-lg border border-[#232933] bg-[#13171D]'
          }
        >
          <div
            className={`relative w-full overflow-hidden bg-black ${
              vollbildAktiv ? 'flex-1' : 'aspect-video'
            }`}
          >
            {aktuelleQuelle ? (
              <img
                src={hintergrundBild}
                alt={`Spielfeldansicht ${aktiverWinkel} Play ${aktiverPlay?.play_number ?? ''}`}
                referrerPolicy="no-referrer"
                style={{
                  transform: `scale(${simulierterScale}) translateX(${simulierterShiftX}%)`,
                  transition: laeuft ? 'transform 120ms linear' : 'transform 200ms ease-out',
                }}
                className="h-full w-full select-none object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-[#0B0E11] px-6 text-center">
                <p className="text-sm font-medium text-[#E6EDF3]">
                  {t('filmRoom.noClipTitle', {
                    angle: aktiverWinkel,
                    play: aktiverPlay?.play_number ?? '',
                  })}
                </p>
                <p className="mt-1 text-xs text-[#8B949E]">
                  {t('filmRoom.noClipHint')}
                </p>
              </div>
            )}

            {/* Winkel-gebundenes, editierbares Vektor-Canvas */}
            {aktiverPlay && aktuelleQuelle && (
              <TelestrationCanvas
                zeichnungen={sichtbareZeichnungenJetzt}
                aktivesWerkzeug={istCoach ? werkzeug : null}
                aktiveFarbe={farbe}
                bearbeitbar={istCoach}
                ausgewaehlteId={ausgewaehlteZeichnungId}
                textPlaceholder={t('hotkey.text.label')}
                onAuswaehlen={setAusgewaehlteZeichnungId}
                onZeichnungHinzufuegen={(teil) => {
                  const frameZeit = frameZuZeit(zeitZuFrame(zeitMsRef.current));
                  setLaeuft(false);
                  setzeZeitExakt(frameZeit, false);
                  const neu: CanvasZeichnung = {
                    ...teil,
                    id: `draw-${Date.now()}`,
                    angle: aktiverWinkel,
                    timestamp_ms: frameZeit,
                    status: 'DRAFT',
                  };
                  onZeichnungHinzufuegen(reel.id, aktiverPlay.play_number, neu);
                  if (teil.werkzeug !== 'pen') {
                    setAusgewaehlteZeichnungId(neu.id);
                  }
                }}
                onZeichnungAktualisieren={(id, punkte) =>
                  onZeichnungAktualisieren(reel.id, aktiverPlay.play_number, id, punkte)
                }
              />
            )}

            {/* Verschiebbares Kommentar-Overlay in wählbarer Ecke über dem Video */}
            {kommentarOverlaySichtbar && aktiveOverlayNotizen.length > 0 && (
              <div
                className={`absolute z-20 max-w-xs rounded-md border border-[#232933] bg-[#0B0E11]/88 p-2.5 backdrop-blur-sm ${ECKEN_POSITION_KLASSEN[kommentarEcke]}`}
              >
                <div className="flex items-center justify-between gap-3 border-b border-[#232933] pb-1.5">
                  <span className="text-[10px] font-semibold text-[#F59E0B]">
                    {t('filmRoom.commentsTitle', { play: aktiverPlay?.play_number ?? '–' })}
                  </span>
                  <div className="flex items-center gap-0.5" title={t('filmRoom.switchCornerTitle')}>
                    {ECKEN_BUTTONS.map((btn) => {
                      const eckeTitel = holeVideoEckeLabel(btn.id, locale);
                      return (
                        <button
                          key={btn.id}
                          type="button"
                          title={eckeTitel}
                          aria-label={t('filmRoom.moveCommentsAria', { corner: eckeTitel })}
                          onClick={() => setKommentarEcke(btn.id)}
                          className={`rounded px-1 text-[10px] leading-4 transition-colors ${
                            kommentarEcke === btn.id
                              ? 'bg-[#F59E0B] font-semibold text-[#0B0E11]'
                              : 'text-[#8B949E] hover:bg-[#232933] hover:text-white'
                          }`}
                        >
                          {btn.kurz}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {aktiveOverlayNotizen.map((n, idx) => {
                    const wirdBearbeitet = Boolean(n.id && bearbeiteNotizId === n.id);
                    return (
                      <li key={n.id ?? idx} className="text-[11px] leading-snug text-[#E6EDF3]">
                        {wirdBearbeitet ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={bearbeiteNotizText}
                              onChange={(e) => setBearbeiteNotizText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') speichereNotizBearbeitung();
                                if (e.key === 'Escape') brecheNotizBearbeitungAb();
                              }}
                              aria-label={t('filmRoom.editCommentAria')}
                              className="min-w-0 flex-1 rounded border border-[#F59E0B] bg-[#13171D] px-1.5 py-0.5 text-[11px] text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={speichereNotizBearbeitung}
                              aria-label={t('filmRoom.saveCommentAria')}
                              className="rounded bg-[#F59E0B] p-0.5 text-[#0B0E11]"
                            >
                              <Check className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={brecheNotizBearbeitungAb}
                              aria-label={t('filmRoom.cancelAria')}
                              className="rounded p-0.5 text-[#8B949E] hover:text-white"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="mr-1.5 font-mono text-[10px] text-[#8B949E] tabular-nums">
                                {formatiereZeit(n.timestamp_ms)}
                              </span>
                              {n.status === 'DRAFT' && (
                                <span className="mr-1.5 font-mono text-[10px] text-[#F59E0B]">
                                  [DRAFT]
                                </span>
                              )}
                              <span>{n.text}</span>
                            </div>
                            {darfNotizBearbeiten(n) && (
                              <button
                                type="button"
                                onClick={() => starteNotizBearbeitung(n)}
                                title={t('filmRoom.editCommentAria')}
                                aria-label={t('filmRoom.editCommentAria')}
                                className="shrink-0 rounded p-0.5 text-[#8B949E] hover:bg-[#232933] hover:text-white"
                              >
                                <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Auto-Stop Hinweis */}
            {autoStopMeldung && (
              <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded border border-[#F59E0B]/60 bg-[#0B0E11]/92 px-3 py-1 font-mono text-[11px] text-[#FBBF24]">
                {autoStopMeldung}
              </div>
            )}

            {/* Schwebende Zeichenwerkzeug-Leiste direkt unten über dem Video (auch im Vollbild!) */}
            {istCoach && aktiverPlay && aktuelleQuelle && zeichenOverlaySichtbar && (
              <div className="absolute bottom-3 left-1/2 z-20 flex max-w-[96%] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-md border border-[#303846] bg-[#0B0E11]/92 px-2.5 py-1.5 backdrop-blur-sm">
                {(
                  [
                    { id: 'select', label: t('filmRoom.toolSelect'), Icon: MousePointer2, taste: hotkeys.select },
                    { id: 'pen', label: t('filmRoom.toolPen'), Icon: Pencil, taste: hotkeys.pen },
                    { id: 'arrow', label: t('filmRoom.toolArrow'), Icon: ArrowUpRight, taste: hotkeys.arrow },
                    { id: 'spotlight', label: t('filmRoom.toolSpotlight'), Icon: CircleDot, taste: hotkeys.spotlight },
                    { id: 'text', label: t('filmRoom.toolText'), Icon: Type, taste: hotkeys.text },
                  ] as const
                ).map(({ id, label, Icon, taste }) => {
                  const aktiv = werkzeug === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWerkzeug(aktiv ? null : id)}
                      title={`${label} (${taste.toUpperCase()})`}
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        aktiv
                          ? 'bg-[#F59E0B] text-[#0B0E11]'
                          : 'text-[#E6EDF3] hover:bg-[#1E2530]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">{label}</span>
                      <kbd
                        className={`rounded px-1 font-mono text-[9px] uppercase ${
                          aktiv
                            ? 'bg-[#0B0E11]/20 text-[#0B0E11]'
                            : 'bg-[#161B22] text-[#8B949E]'
                        }`}
                      >
                        {taste}
                      </kbd>
                    </button>
                  );
                })}

                <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-[#232933]" />

                {/* Farbpalette */}
                <div className="flex items-center gap-1">
                  {TEAM_FARBEN.map((swatch) => {
                    const swatchLabel = t(swatch.labelKey);
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        title={swatchLabel}
                        aria-label={swatchLabel}
                        onClick={() => setFarbe(swatch.hex)}
                        style={{ backgroundColor: swatch.hex }}
                        className={`h-4 w-4 rounded border transition-transform ${
                          farbe === swatch.hex
                            ? 'scale-115 border-white ring-1 ring-white'
                            : 'border-[#232933]'
                        }`}
                      />
                    );
                  })}
                </div>

                <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-[#232933]" />

                {ausgewaehlteZeichnungId && (
                  <button
                    type="button"
                    onClick={() => {
                      onZeichnungEntfernen(reel.id, aktiverPlay.play_number, ausgewaehlteZeichnungId);
                      setAusgewaehlteZeichnungId(null);
                    }}
                    title={t('filmRoom.deleteObjectTitle')}
                    className="inline-flex items-center gap-1 rounded border border-[#DC2626]/40 bg-[#DC2626]/15 px-2 py-1 text-[11px] text-[#FCA5A5] hover:bg-[#DC2626]/25"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    {t('filmRoom.deleteObjectLabel')}
                  </button>
                )}

                <button
                  type="button"
                  disabled={winkelZeichnungen.length === 0}
                  onClick={() =>
                    onLetzteZeichnungEntfernen(reel.id, aktiverPlay.play_number, aktiverWinkel)
                  }
                  title={t('filmRoom.undoTitle', { key: hotkeys.undo.toUpperCase() })}
                  className="rounded p-1 text-[#8B949E] hover:bg-[#1E2530] hover:text-white disabled:opacity-35"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={winkelZeichnungen.length === 0}
                  onClick={() => {
                    onAlleZeichnungenLeeren(reel.id, aktiverPlay.play_number, aktiverWinkel);
                    setAusgewaehlteZeichnungId(null);
                  }}
                  title={t('filmRoom.clearTitle')}
                  className="rounded p-1 text-[#8B949E] hover:bg-[#1E2530] hover:text-[#FCA5A5] disabled:opacity-35"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-[#8B949E]">
                  <input
                    type="checkbox"
                    checked={autoStop}
                    onChange={(e) => setAutoStop(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#F59E0B]"
                  />
                  <span>{t('filmRoom.autoStop')}</span>
                </label>
              </div>
            )}
          </div>

          {/* Timeline Scrub-Bar */}
          <div className="border-t border-[#232933] bg-[#0F1318] px-4 pt-2.5 pb-1">
            <div className="relative flex h-5 items-center">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#232933]">
                <div
                  className="h-full bg-[#F59E0B]"
                  style={{ width: `${fortschrittProzent}%` }}
                />
              </div>

              <input
                type="range"
                aria-label={t('filmRoom.timelineAria')}
                min={0}
                max={dauerMs}
                step={FRAME_MS}
                value={frameZuZeit(zeitZuFrame(zeitMs))}
                onChange={(e) => {
                  setLaeuft(false);
                  setAutoStopMeldung(null);
                  setzeZeitExakt(Number(e.target.value));
                }}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              />

              {/* Marker liegen über dem Range-Slider (z-20), damit Klicks exakt auf den Frame springen */}
              {winkelZeichnungen.map((z) => {
                const pos = Math.min(100, Math.max(0, (z.timestamp_ms / dauerMs) * 100));
                const zeichnungsFrame = zeitZuFrame(z.timestamp_ms);
                const istAktiverFrame = istGleicherFrame(z.timestamp_ms, zeitMs);
                return (
                  <button
                    key={z.id}
                    type="button"
                    title={t('filmRoom.markerTitle', {
                      angle: z.angle,
                      frame: zeichnungsFrame,
                      time: formatiereZeit(z.timestamp_ms),
                    })}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLaeuft(false);
                      setAutoStopMeldung(null);
                      setzeZeitExakt(frameZuZeit(zeichnungsFrame));
                    }}
                    style={{ left: `${pos}%` }}
                    className="group absolute top-0 z-20 flex h-5 w-4 -translate-x-1/2 cursor-pointer items-center justify-center"
                  >
                    <span
                      className={`h-4 w-1.5 rounded-sm transition-colors ${
                        istAktiverFrame
                          ? 'bg-[#F59E0B] ring-1 ring-white'
                          : 'bg-[#3B82F6] group-hover:bg-white'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transport-Leiste + Overlays + Winkel + Vollbild */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0F1318] px-4 py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={sichererIndex === 0}
                onClick={() => wechslePlay(sichererIndex - 1)}
                aria-label={t('filmRoom.prevPlayAria')}
                className="rounded p-1.5 text-[#8B949E] hover:bg-[#1E2530] hover:text-white disabled:opacity-35"
              >
                <SkipBack className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLaeuft(false);
                  setAutoStopMeldung(null);
                  setzeZeitExakt(frameZuZeit(zeitZuFrame(zeitMsRef.current) - 1));
                }}
                aria-label={t('filmRoom.prevFrameAria')}
                title={t('filmRoom.prevFrameTitle')}
                className="rounded p-1.5 text-[#8B949E] hover:bg-[#1E2530] hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={toggleAbspielen}
                aria-label={laeuft ? t('filmRoom.pauseAria') : t('filmRoom.playAria')}
                className="rounded-md bg-[#F59E0B] p-1.5 text-[#0B0E11] hover:bg-[#FBBF24]"
              >
                {laeuft ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLaeuft(false);
                  setAutoStopMeldung(null);
                  setzeZeitExakt(frameZuZeit(zeitZuFrame(zeitMsRef.current) + 1));
                }}
                aria-label={t('filmRoom.nextFrameAria')}
                title={t('filmRoom.nextFrameTitle')}
                className="rounded p-1.5 text-[#8B949E] hover:bg-[#1E2530] hover:text-white"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={sichererIndex >= reel.plays.length - 1}
                onClick={() => wechslePlay(sichererIndex + 1)}
                aria-label={t('filmRoom.nextPlayAria')}
                className="rounded p-1.5 text-[#8B949E] hover:bg-[#1E2530] hover:text-white disabled:opacity-35"
              >
                <SkipForward className="h-4 w-4" aria-hidden="true" />
              </button>

              <span className="ml-2 font-mono text-xs text-[#E6EDF3] tabular-nums">
                {formatiereZeit(zeitMs)}{' '}
                <span className="text-[#F59E0B]">· Fr {zeitZuFrame(zeitMs)}</span>{' '}
                <span className="text-[#6E7681]">/ {formatiereZeit(dauerMs)}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setGeschwindigkeit((g) => (g === 1 ? 0.5 : g === 0.5 ? 1.5 : 1))
                }
                className="rounded border border-[#232933] bg-[#13171D] px-2 py-1 font-mono text-[11px] text-[#E6EDF3] hover:border-[#36404F]"
              >
                {geschwindigkeit.toFixed(1)}x
              </button>

              {/* Multi-Angle-Switcher */}
              <div
                role="group"
                aria-label={t('filmRoom.angleGroupAria')}
                title={t('filmRoom.angleGroupTitle', { key: hotkeys.switchAngle.toUpperCase() })}
                className="flex items-center gap-0.5 rounded border border-[#232933] bg-[#13171D] p-0.5"
              >
                {reel.angles.map((winkel) => {
                  const verfuegbar = Boolean(aktiverPlay?.sources[winkel]);
                  const aktiv = aktiverWinkel === winkel;
                  return (
                    <button
                      key={winkel}
                      type="button"
                      disabled={!verfuegbar}
                      onClick={() => {
                        setAktiverWinkel(winkel);
                        setAusgewaehlteZeichnungId(null);
                      }}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        aktiv
                          ? 'bg-[#232933] text-white'
                          : verfuegbar
                            ? 'text-[#8B949E] hover:text-white'
                            : 'cursor-not-allowed text-[#484F58] line-through'
                      }`}
                    >
                      {winkel === 'SIDELINE' ? 'Sideline' : winkel === 'ENDZONE' ? 'Endzone' : winkel}
                    </button>
                  );
                })}
              </div>

              {zeigeOffset && (
                <span className="font-mono text-[11px] text-[#8B949E] tabular-nums">
                  Offset {optionalerOffsetMs! > 0 ? '+' : ''}
                  {(optionalerOffsetMs! / 1000).toFixed(2)}s
                </span>
              )}

              {/* Overlay-Toggles */}
              {istCoach && (
                <button
                  type="button"
                  onClick={() => setZeichenOverlaySichtbar((v) => !v)}
                  title={`${t('hotkey.toggleDrawBar.label')} (${hotkeys.toggleDrawBar.toUpperCase()})`}
                  className={`rounded border p-1.5 transition-colors ${
                    zeichenOverlaySichtbar
                      ? 'border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]'
                      : 'border-[#232933] bg-[#13171D] text-[#8B949E] hover:text-white'
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setKommentarOverlaySichtbar((v) => !v)}
                title={t('filmRoom.commentsTitle', { play: aktiverPlay?.play_number ?? '–' })}
                className={`rounded border p-1.5 transition-colors ${
                  kommentarOverlaySichtbar
                    ? 'border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'border-[#232933] bg-[#13171D] text-[#8B949E] hover:text-white'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              {/* Vollbildmodus */}
              <button
                type="button"
                onClick={() => void toggleVollbild()}
                title={
                  vollbildAktiv
                    ? `${t('filmRoom.fullscreenExit')} (Esc / ${hotkeys.toggleFullscreen.toUpperCase()})`
                    : `${t('filmRoom.fullscreenEnter')} (${hotkeys.toggleFullscreen.toUpperCase()})`
                }
                aria-label={vollbildAktiv ? t('filmRoom.fullscreenExit') : t('filmRoom.fullscreenEnter')}
                className="rounded border border-[#232933] bg-[#13171D] p-1.5 text-[#E6EDF3] hover:border-[#F59E0B] hover:text-white"
              >
                {vollbildAktiv ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Rechte Spalte: Dynamische Quick-Tags + Notizen-Liste */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-[#232933] bg-[#13171D] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-white">
                {t('filmRoom.taggingHeading', { play: aktiverPlay?.play_number ?? '–' })}
              </h2>
              {istTeamAdmin && (
                <button
                  type="button"
                  onClick={onSchemaSettingsOeffnen}
                  className="inline-flex items-center gap-1 text-[11px] text-[#8B949E] hover:text-[#F59E0B]"
                >
                  <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
                  {t('filmRoom.manageFields')}
                </button>
              )}
            </div>

            {/* Kompakte Gruppen-Filter für schnelles Tagging */}
            <div className="mt-2.5 flex items-center gap-1 rounded border border-[#232933] bg-[#0B0E11] p-0.5 text-[11px]">
              {(
                [
                  { id: 'ALLE', label: t('filmRoom.groupAll') },
                  { id: 'SITUATION', label: t('filmRoom.groupSituation') },
                  { id: 'OFFENSE', label: t('filmRoom.groupOffense') },
                  { id: 'DEFENSE', label: t('filmRoom.groupDefense') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTagGruppeTab(tab.id)}
                  className={`flex-1 rounded py-1 font-medium transition-colors ${
                    tagGruppeTab === tab.id
                      ? 'bg-[#232933] text-white'
                      : 'text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {istFlagPlay && (
              <p className="mt-2 text-[11px] text-[#F59E0B]">
                {t('filmRoom.flagPauseNotice')}
              </p>
            )}

            {aktiverPlay && (
              <div className="mt-3 grid max-h-[270px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                {aktiveTagFelder.map((feld) => {
                  const wert = leseBreakdownWert(aktiverPlay.breakdown, feld);
                  return (
                    <label key={feld.key} className="space-y-1 text-[11px] text-[#8B949E]">
                      <span className="block truncate" title={feld.label}>
                        {feld.kurz}
                      </span>

                      {feld.typ === 'select' ? (
                        <select
                          disabled={!istCoach}
                          value={wert ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const konvertiert =
                              feld.key === 'down' ? (raw ? Number(raw) : undefined) : raw || undefined;
                            onFeldAendern(
                              reel.id,
                              aktiverPlay.play_number,
                              feld.key,
                              konvertiert,
                              Boolean(feld.istCustom)
                            );
                          }}
                          className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 font-mono text-xs text-white focus:border-[#F59E0B] focus:outline-none disabled:opacity-60"
                        >
                          <option value="">–</option>
                          {(feld.definitionen ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : feld.typ === 'number' ? (
                        <input
                          type="number"
                          disabled={!istCoach}
                          min={feld.key === 'yard_line' ? -50 : undefined}
                          max={feld.key === 'yard_line' ? 50 : undefined}
                          value={wert ?? ''}
                          onChange={(e) =>
                            onFeldAendern(
                              reel.id,
                              aktiverPlay.play_number,
                              feld.key,
                              e.target.value === '' ? undefined : Number(e.target.value),
                              Boolean(feld.istCustom)
                            )
                          }
                          placeholder={feld.key === 'yard_line' ? '-25 / +20' : '0'}
                          className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 font-mono text-xs text-white placeholder-[#484F58] focus:border-[#F59E0B] focus:outline-none disabled:opacity-60"
                        />
                      ) : (
                        <input
                          type="text"
                          disabled={!istCoach}
                          list={feld.typ === 'combobox' ? `qt-dl-${feld.key}` : undefined}
                          value={wert ?? ''}
                          onChange={(e) =>
                            onFeldAendern(
                              reel.id,
                              aktiverPlay.play_number,
                              feld.key,
                              e.target.value || undefined,
                              Boolean(feld.istCustom)
                            )
                          }
                          onBlur={(e) => {
                            if (feld.typ === 'combobox' && e.target.value.trim()) {
                              onDefinitionLernen(feld.key, e.target.value);
                            }
                          }}
                          placeholder={t('filmRoom.comboPlaceholder')}
                          className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 text-xs text-white placeholder-[#484F58] focus:border-[#F59E0B] focus:outline-none disabled:opacity-60"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {/* Notizen & Kommentare */}
          <section className="flex flex-1 flex-col rounded-lg border border-[#232933] bg-[#13171D] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white">{t('filmRoom.notesHeading')}</h2>
              <span className="font-mono text-[11px] text-[#8B949E] tabular-nums">
                {t('filmRoom.notesCount', { count: playNotizen.length })}
              </span>
            </div>

            <div className="mt-2.5 max-h-40 flex-1 space-y-2 overflow-y-auto">
              {playNotizen.length === 0 ? (
                <p className="py-3 text-center text-xs text-[#6E7681]">
                  {t('filmRoom.notesEmpty', { play: aktiverPlay?.play_number ?? '–' })}
                </p>
              ) : (
                playNotizen.map((notiz, idx) => {
                  const wirdBearbeitet = Boolean(notiz.id && bearbeiteNotizId === notiz.id);
                  const editierbar = darfNotizBearbeiten(notiz);

                  return (
                    <div
                      key={notiz.id ?? idx}
                      className="rounded border border-[#232933] bg-[#0B0E11] p-2.5 transition-colors hover:border-[#36404F]"
                    >
                      <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            setLaeuft(false);
                            setAutoStopMeldung(null);
                            setzeZeitExakt(notiz.timestamp_ms);
                          }}
                          title={t('filmRoom.jumpToTimeTitle')}
                          className="text-[#8B949E] hover:text-white tabular-nums"
                        >
                          {formatiereZeit(notiz.timestamp_ms)}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              notiz.status === 'DRAFT' ? 'text-[#F59E0B]' : 'text-[#4ADE80]'
                            }
                          >
                            {notiz.status === 'DRAFT'
                              ? 'DRAFT'
                              : notiz.autorRolle === 'PLAYER'
                                ? t('filmRoom.noteOwn')
                                : 'PUBLISHED'}
                          </span>

                          {editierbar && !wirdBearbeitet && (
                            <>
                              <button
                                type="button"
                                onClick={() => starteNotizBearbeitung(notiz)}
                                title={t('filmRoom.editCommentAria')}
                                aria-label={t('filmRoom.editCommentAria')}
                                className="rounded p-0.5 text-[#8B949E] hover:bg-[#1E2530] hover:text-white"
                              >
                                <Pencil className="h-3 w-3" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (aktiverPlay && notiz.id) {
                                    onNotizLoeschen(reel.id, aktiverPlay.play_number, notiz.id);
                                  }
                                }}
                                title={t('filmRoom.deleteCommentAria')}
                                aria-label={t('filmRoom.deleteCommentAria')}
                                className="rounded p-0.5 text-[#8B949E] hover:bg-[#DC2626]/15 hover:text-[#FCA5A5]"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {wirdBearbeitet ? (
                        <div className="mt-1.5 flex items-center gap-1">
                          <input
                            type="text"
                            value={bearbeiteNotizText}
                            onChange={(e) => setBearbeiteNotizText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') speichereNotizBearbeitung();
                              if (e.key === 'Escape') brecheNotizBearbeitungAb();
                            }}
                            aria-label={t('filmRoom.editCommentAria')}
                            className="min-w-0 flex-1 rounded border border-[#F59E0B] bg-[#13171D] px-2 py-1 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={speichereNotizBearbeitung}
                            aria-label={t('filmRoom.saveEditAria')}
                            className="rounded bg-[#F59E0B] p-1 text-[#0B0E11] hover:bg-[#FBBF24]"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={brecheNotizBearbeitungAb}
                            aria-label={t('filmRoom.cancelEditAria')}
                            className="rounded border border-[#232933] p-1 text-[#8B949E] hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setLaeuft(false);
                            setAutoStopMeldung(null);
                            setzeZeitExakt(notiz.timestamp_ms);
                          }}
                          className="mt-1 block w-full text-left text-xs leading-snug text-[#E6EDF3]"
                        >
                          {notiz.text}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {aktiverPlay && (
              <div className="mt-3 flex gap-1.5 border-t border-[#232933] pt-3">
                <input
                  type="text"
                  value={notizText}
                  onChange={(e) => setNotizText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNotizSpeichern();
                  }}
                  placeholder={
                    istCoach
                      ? t('filmRoom.noteDraftPlaceholder', { time: formatiereZeit(zeitMs) })
                      : t('filmRoom.notePlayerPlaceholder', { time: formatiereZeit(zeitMs) })
                  }
                  className="min-w-0 flex-1 rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white placeholder-[#6E7681] focus:border-[#F59E0B] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleNotizSpeichern}
                  className="rounded border border-[#232933] bg-[#1E2530] px-3 py-1.5 text-xs font-medium text-white hover:border-[#F59E0B]"
                >
                  +
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Unterer Arbeitsbereich: Dynamisches Breakdown Data Grid */}
      <BreakdownGrid
        reelTitel={reel.title}
        plays={reel.plays}
        aktiverPlayIndex={sichererIndex}
        teamRolle={teamRolle}
        tagSchema={tagSchema}
        locale={locale}
        onPlayWaehlen={wechslePlay}
        onFeldAendern={(playNumber, feldKey, wert, istCustom) =>
          onFeldAendern(reel.id, playNumber, feldKey, wert, istCustom)
        }
        onDefinitionLernen={onDefinitionLernen}
      />
    </div>
  );
}
