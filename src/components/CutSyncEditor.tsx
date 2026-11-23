import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Film,
  Pause,
  Play,
  Scissors,
  Trash2,
} from 'lucide-react';
import type { JklGeschwindigkeit, Spielzug, VideoReel } from '../types.ts';
import { THUMB_ENDZONE, THUMB_SIDELINE } from '../data/demoReels.ts';
import { createVideoTranslator } from '../i18n.ts';
import { FRAME_MS, frameZuZeit, zeitZuFrame } from '../services/frameAndHotkeys.ts';
import {
  aktualisierePlaySchnitt,
  berechneJklGeschwindigkeit,
  berechneSynchronisierteZeit,
  entferneWinkelClip,
  erkenneSyncProbleme,
  loescheGeschnittenesPlay,
  quantisiereAufFrame,
  schneideTimeSlicePlay,
  setzeClipOffset,
  tauscheClipMitNachbar,
  uebernehmeOffsetAufFolgePlays,
} from '../services/cutSyncEngine.ts';

interface CutSyncEditorProps {
  reels: VideoReel[];
  ausgewaehltesReel: VideoReel | null;
  locale?: string;
  onReelWaehlen: (reelId: string) => void;
  onPlaysAktualisieren: (reelId: string, neuePlays: Spielzug[]) => void;
  onImFilmRoomOeffnen: (reelId: string, playNumber?: number) => void;
  onZurueckZumDashboard: () => void;
}

function formatiereTimecode(ms: number): string {
  const geklemmt = Math.max(0, ms);
  const sekundenGesamt = Math.floor(geklemmt / 1000);
  const minuten = Math.floor(sekundenGesamt / 60);
  const sekunden = sekundenGesamt % 60;
  const hundertstel = Math.floor((geklemmt % 1000) / 10);
  return `${String(minuten).padStart(2, '0')}:${String(sekunden).padStart(2, '0')}.${String(hundertstel).padStart(2, '0')}`;
}

export function CutSyncEditor({
  reels,
  ausgewaehltesReel,
  locale,
  onReelWaehlen,
  onPlaysAktualisieren,
  onImFilmRoomOeffnen,
  onZurueckZumDashboard,
}: CutSyncEditorProps) {
  const t = createVideoTranslator(locale);
  const reel = ausgewaehltesReel ?? reels[0] ?? null;

  const [aktiverPlayIndex, setAktiverPlayIndex] = useState(0);
  const [masterAngle, setMasterAngle] = useState<string>(reel?.angles[0] ?? 'SIDELINE');
  const [secondaryAngle, setSecondaryAngle] = useState<string>(
    reel?.angles[1] ?? reel?.angles[0] ?? 'ENDZONE'
  );
  const [laeuft, setLaeuft] = useState(false);
  const [syncZeitMs, setSyncZeitMs] = useState(0);
  const [statusHinweis, setStatusHinweis] = useState<string | null>(null);

  // Fast-Cut State (TIME_SLICE)
  const [rawZeitMs, setRawZeitMs] = useState(0);
  const [inPunktMs, setInPunktMs] = useState(0);
  const [outPunktMs, setOutPunktMs] = useState(6000);
  const [autoCutOnOut, setAutoCutOnOut] = useState(true);
  const [jklSpeed, setJklSpeed] = useState<JklGeschwindigkeit>(0);

  useEffect(() => {
    if (!reel) return;
    setAktiverPlayIndex(0);
    setMasterAngle(reel.angles[0] ?? 'SIDELINE');
    setSecondaryAngle(reel.angles[1] ?? reel.angles[0] ?? 'SIDELINE');
    setSyncZeitMs(0);
    setLaeuft(false);
    setJklSpeed(0);
    setStatusHinweis(null);
  }, [reel?.id]);

  const aktiverPlay = reel?.plays[aktiverPlayIndex] ?? reel?.plays[0] ?? null;
  const masterQuelle = aktiverPlay?.sources[masterAngle] ?? null;
  const masterDauerMs = masterQuelle
    ? Math.max(1000, masterQuelle.end_ms - masterQuelle.start_ms)
    : 8400;

  // Simulierte Transport-Uhr für Dual-Viewport Sync-Vorschau
  useEffect(() => {
    if (!laeuft || reel?.sourceMode === 'TIME_SLICE') return;
    const timer = window.setInterval(() => {
      setSyncZeitMs((alt) => {
        const naechste = alt + FRAME_MS;
        if (naechste >= masterDauerMs) {
          setLaeuft(false);
          return masterDauerMs;
        }
        return naechste;
      });
    }, FRAME_MS);
    return () => window.clearInterval(timer);
  }, [laeuft, masterDauerMs, reel?.sourceMode]);

  // Fast-Cut J/K/L Transport-Uhr
  const rawTapeMaxMs = useMemo(() => {
    if (!reel) return 180_000;
    const maxEnd = reel.plays.reduce((acc, p) => {
      const q = p.sources[masterAngle] ?? Object.values(p.sources).find(Boolean);
      return q ? Math.max(acc, q.end_ms) : acc;
    }, 0);
    return Math.max(180_000, maxEnd + 30_000);
  }, [reel, masterAngle]);

  useEffect(() => {
    if (reel?.sourceMode !== 'TIME_SLICE' || jklSpeed === 0) return;
    const timer = window.setInterval(() => {
      setRawZeitMs((alt) => {
        const neu = Math.max(0, Math.min(rawTapeMaxMs, alt + FRAME_MS * jklSpeed));
        if (neu === 0 || neu === rawTapeMaxMs) {
          setJklSpeed(0);
        }
        return neu;
      });
    }, FRAME_MS);
    return () => window.clearInterval(timer);
  }, [reel?.sourceMode, jklSpeed, rawTapeMaxMs]);

  const rawDateiname = useMemo(() => {
    if (!reel) return 'raw_tape.mp4';
    for (const p of reel.plays) {
      const q = p.sources[masterAngle] ?? Object.values(p.sources).find(Boolean);
      if (q?.file) return q.file;
    }
    return 'raw_tape.mp4';
  }, [reel, masterAngle]);

  const handleTimeSliceCut = (zielInMs: number, zielOutMs: number) => {
    if (!reel) return;
    const ergebnis = schneideTimeSlicePlay(reel.plays, {
      inMs: zielInMs,
      outMs: zielOutMs,
      angle: masterAngle,
      file: rawDateiname,
    });
    if (!ergebnis.ok) {
      setStatusHinweis(ergebnis.fehler ?? null);
      return;
    }
    onPlaysAktualisieren(reel.id, ergebnis.plays);
    setInPunktMs(quantisiereAufFrame(zielOutMs));
    setStatusHinweis(
      t('cutSync.cutSuccess', {
        play: ergebnis.plays.length,
        start: formatiereTimecode(zielInMs),
        end: formatiereTimecode(zielOutMs),
      })
    );
  };

  // Hotkeys im Fast-Cut Editor (I / O / J-K-L / ← / →)
  useEffect(() => {
    if (reel?.sourceMode !== 'TIME_SLICE') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      const key = event.key.toLowerCase();
      if (key === 'j' || key === 'k' || key === 'l') {
        event.preventDefault();
        setJklSpeed((alt) => berechneJklGeschwindigkeit(alt, key));
      } else if (key === ' ') {
        event.preventDefault();
        setJklSpeed((alt) => (alt === 0 ? 1 : 0));
      } else if (key === 'i') {
        event.preventDefault();
        setInPunktMs(quantisiereAufFrame(rawZeitMs));
      } else if (key === 'o') {
        event.preventDefault();
        const out = quantisiereAufFrame(rawZeitMs);
        setOutPunktMs(out);
        if (autoCutOnOut && out > inPunktMs) {
          handleTimeSliceCut(inPunktMs, out);
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setJklSpeed(0);
        setRawZeitMs((alt) => Math.max(0, quantisiereAufFrame(alt - FRAME_MS)));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setJklSpeed(0);
        setRawZeitMs((alt) => Math.min(rawTapeMaxMs, quantisiereAufFrame(alt + FRAME_MS)));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const syncProbleme = useMemo(() => (reel ? erkenneSyncProbleme(reel) : []), [reel]);

  if (!reel) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onZurueckZumDashboard}
          className="inline-flex items-center gap-2 text-sm text-[#8B949E] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('cutSync.backToLibrary')}
        </button>
        <div className="rounded-lg border border-[#232933] bg-[#13171D] p-8 text-sm text-[#8B949E]">
          {t('cutSync.noReels')}
        </div>
      </div>
    );
  }

  const hatZweitenWinkel = reel.angles.length > 1 && secondaryAngle !== masterAngle;
  const sekundarQuelle = aktiverPlay?.sources[secondaryAngle] ?? null;
  const sekundarOffset = sekundarQuelle?.offset_ms ?? 0;
  const syncSekundar = aktiverPlay
    ? berechneSynchronisierteZeit(aktiverPlay, secondaryAngle, syncZeitMs)
    : { verfuegbar: false, angleMs: 0, inBereich: false, dauerMs: 0 };

  const aendereOffset = (neuerOffsetMs: number) => {
    if (!aktiverPlay) return;
    const aktualisiert = setzeClipOffset(
      reel.plays,
      aktiverPlay.play_number,
      secondaryAngle,
      neuerOffsetMs
    );
    onPlaysAktualisieren(reel.id, aktualisiert);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onZurueckZumDashboard}
            className="inline-flex items-center gap-2 text-sm text-[#8B949E] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('cutSync.backToLibrary')}
          </button>
          <span className="text-[#232933]">|</span>
          <h1 className="text-base font-semibold text-white">{t('cutSync.title')}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="cutsync-reel-select">
            {t('cutSync.selectReel')}
          </label>
          <select
            id="cutsync-reel-select"
            value={reel.id}
            onChange={(e) => onReelWaehlen(e.target.value)}
            className="rounded-md border border-[#232933] bg-[#13171D] px-3 py-1.5 text-xs text-white focus:border-[#F59E0B] focus:outline-none"
          >
            {reels.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({r.sourceMode === 'TIME_SLICE' ? 'Time-Slice' : 'Clips'})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onImFilmRoomOeffnen(reel.id, aktiverPlay?.play_number)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#F59E0B] px-3 py-1.5 text-xs font-semibold text-[#0B0E11] transition-colors hover:bg-[#D97706]"
          >
            <Film className="h-3.5 w-3.5" aria-hidden="true" />
            {t('cutSync.openFilmRoom')}
          </button>
        </div>
      </div>

      <p className="text-xs text-[#8B949E]">{t('cutSync.subtitle')}</p>

      {statusHinweis && (
        <div className="rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#FDE68A]">
          {statusHinweis}
        </div>
      )}

      {reel.sourceMode === 'TIME_SLICE' ? (
        <section className="space-y-4 rounded-lg border border-[#232933] bg-[#13171D] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">{t('cutSync.fastCutTitle')}</h2>
              <p className="mt-0.5 text-xs text-[#8B949E]">{t('cutSync.fastCutHint')}</p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
              <span className="rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1 text-[#F59E0B]">
                {t('cutSync.speedLabel', { speed: jklSpeed })}
              </span>
              <span className="text-[#E6EDF3]">
                {t('cutSync.frameReadout', {
                  frame: zeitZuFrame(rawZeitMs),
                  time: formatiereTimecode(rawZeitMs),
                })}
              </span>
            </div>
          </div>

          <div className="relative flex aspect-[21/9] items-center justify-center overflow-hidden rounded-md border border-[#232933] bg-[#0B0E11]">
            <img
              src={THUMB_SIDELINE}
              alt={reel.title}
              className="h-full w-full object-cover opacity-55"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-[#0B0E11] to-transparent px-4 py-3 text-xs">
              <span className="font-mono text-[#E6EDF3]">{rawDateiname}</span>
              <span className="font-mono text-[#F59E0B] tabular-nums">
                {t('cutSync.inOutReadout', {
                  inTime: formatiereTimecode(inPunktMs),
                  outTime: formatiereTimecode(outPunktMs),
                })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={rawTapeMaxMs}
              step={FRAME_MS}
              value={rawZeitMs}
              aria-label={t('cutSync.rawTimeline')}
              onChange={(e) => {
                setJklSpeed(0);
                setRawZeitMs(Number(e.target.value));
              }}
              className="w-full accent-[#F59E0B]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setJklSpeed((alt) => berechneJklGeschwindigkeit(alt, 'j'))}
                  className="rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 font-mono text-xs text-[#E6EDF3] hover:border-[#F59E0B]"
                >
                  J ◄◄
                </button>
                <button
                  type="button"
                  onClick={() => setJklSpeed(0)}
                  className="rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 font-mono text-xs text-[#E6EDF3] hover:border-[#F59E0B]"
                >
                  K ■
                </button>
                <button
                  type="button"
                  onClick={() => setJklSpeed((alt) => berechneJklGeschwindigkeit(alt, 'l'))}
                  className="rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 font-mono text-xs text-[#E6EDF3] hover:border-[#F59E0B]"
                >
                  L ►►
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJklSpeed(0);
                    setRawZeitMs((alt) => Math.max(0, quantisiereAufFrame(alt - FRAME_MS)));
                  }}
                  className="rounded border border-[#232933] bg-[#0B0E11] p-1.5 text-[#E6EDF3] hover:border-[#F59E0B]"
                  aria-label="1 Frame -"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJklSpeed(0);
                    setRawZeitMs((alt) =>
                      Math.min(rawTapeMaxMs, quantisiereAufFrame(alt + FRAME_MS))
                    );
                  }}
                  className="rounded border border-[#232933] bg-[#0B0E11] p-1.5 text-[#E6EDF3] hover:border-[#F59E0B]"
                  aria-label="1 Frame +"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInPunktMs(quantisiereAufFrame(rawZeitMs))}
                  className="rounded border border-[#232933] bg-[#0B0E11] px-3 py-1.5 text-xs text-white hover:border-[#F59E0B]"
                >
                  {t('cutSync.setIn')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const out = quantisiereAufFrame(rawZeitMs);
                    setOutPunktMs(out);
                    if (autoCutOnOut && out > inPunktMs) {
                      handleTimeSliceCut(inPunktMs, out);
                    }
                  }}
                  className="rounded border border-[#232933] bg-[#0B0E11] px-3 py-1.5 text-xs text-white hover:border-[#F59E0B]"
                >
                  {t('cutSync.setOut')}
                </button>
                <label className="flex items-center gap-1.5 text-xs text-[#8B949E]">
                  <input
                    type="checkbox"
                    checked={autoCutOnOut}
                    onChange={(e) => setAutoCutOnOut(e.target.checked)}
                    className="accent-[#F59E0B]"
                  />
                  {t('cutSync.autoCutOnOut')}
                </label>
                <button
                  type="button"
                  onClick={() => handleTimeSliceCut(inPunktMs, outPunktMs)}
                  className="inline-flex items-center gap-1.5 rounded bg-[#F59E0B] px-3 py-1.5 text-xs font-semibold text-[#0B0E11] hover:bg-[#D97706]"
                >
                  <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('cutSync.cutPlayBtn')}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-[#232933] pt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#232933] text-[#8B949E]">
                  <th className="py-2 font-medium">{t('cutSync.colPlay')}</th>
                  <th className="py-2 font-medium">{t('cutSync.colRange')}</th>
                  <th className="py-2 font-medium">{t('cutSync.colDuration')}</th>
                  <th className="py-2 text-right font-medium">{t('cutSync.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232933]">
                {reel.plays.map((play) => {
                  const q = play.sources[masterAngle] ?? Object.values(play.sources).find(Boolean);
                  const dauer = q ? q.end_ms - q.start_ms : 0;
                  return (
                    <tr key={play.play_number}>
                      <td className="py-2 font-mono text-white tabular-nums">
                        P-{String(play.play_number).padStart(2, '0')}
                      </td>
                      <td className="py-2 font-mono text-[#E6EDF3] tabular-nums">
                        {q
                          ? `${formatiereTimecode(q.start_ms)} – ${formatiereTimecode(q.end_ms)}`
                          : '–'}
                      </td>
                      <td className="py-2 font-mono text-[#8B949E] tabular-nums">
                        {(dauer / 1000).toFixed(2)} s
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          {q && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setJklSpeed(0);
                                  setRawZeitMs(q.start_ms);
                                  setInPunktMs(q.start_ms);
                                  setOutPunktMs(q.end_ms);
                                }}
                                className="rounded border border-[#232933] px-2 py-1 text-[11px] text-[#E6EDF3] hover:border-[#F59E0B]"
                              >
                                {t('cutSync.jumpPlay')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const res = aktualisierePlaySchnitt(
                                    reel.plays,
                                    play.play_number,
                                    masterAngle,
                                    inPunktMs,
                                    outPunktMs
                                  );
                                  if (res.ok) {
                                    onPlaysAktualisieren(reel.id, res.plays);
                                  } else {
                                    setStatusHinweis(res.fehler ?? null);
                                  }
                                }}
                                className="rounded border border-[#232933] px-2 py-1 text-[11px] text-[#8B949E] hover:text-white"
                              >
                                In/Out ↺
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onPlaysAktualisieren(
                                reel.id,
                                loescheGeschnittenesPlay(reel.plays, play.play_number)
                              );
                              setStatusHinweis(t('cutSync.cutDeleted'));
                            }}
                            aria-label={t('cutSync.deletePlayAria', { play: play.play_number })}
                            className="rounded p-1 text-[#8B949E] hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          <section className="rounded-lg border border-[#232933] bg-[#13171D] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-2 text-[#8B949E]">
                  {t('cutSync.masterAngle')}
                  <select
                    value={masterAngle}
                    onChange={(e) => setMasterAngle(e.target.value)}
                    className="rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1 text-white"
                  >
                    {reel.angles.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[#8B949E]">
                  {t('cutSync.secondaryAngle')}
                  <select
                    value={secondaryAngle}
                    onChange={(e) => setSecondaryAngle(e.target.value)}
                    disabled={reel.angles.length < 2}
                    className="rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1 text-white disabled:opacity-50"
                  >
                    {reel.angles.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="font-mono text-xs text-[#E6EDF3] tabular-nums">
                P-{String(aktiverPlay?.play_number ?? 1).padStart(2, '0')} ·{' '}
                {t('cutSync.frameReadout', {
                  frame: zeitZuFrame(syncZeitMs),
                  time: formatiereTimecode(syncZeitMs),
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-md border border-[#232933] bg-[#0B0E11]">
                <div className="flex items-center justify-between border-b border-[#232933] px-3 py-2 text-xs">
                  <span className="font-semibold text-white">{masterAngle}</span>
                  <span className="font-mono text-[#8B949E]">
                    {masterQuelle?.file ?? t('cutSync.statusGap')}
                  </span>
                </div>
                <div className="relative aspect-video bg-[#0B0E11]">
                  {masterQuelle ? (
                    <img
                      src={THUMB_SIDELINE}
                      alt={masterAngle}
                      className="h-full w-full object-cover opacity-70"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[#8B949E]">
                      {t('cutSync.missingClipNotice', { angle: masterAngle })}
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 rounded bg-[#0B0E11]/90 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums">
                    {formatiereTimecode(syncZeitMs)}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-md border border-[#232933] bg-[#0B0E11]">
                <div className="flex items-center justify-between border-b border-[#232933] px-3 py-2 text-xs">
                  <span className="font-semibold text-[#F59E0B]">
                    {hatZweitenWinkel ? secondaryAngle : t('cutSync.noSecondary')}
                  </span>
                  <span className="font-mono text-[#8B949E]">
                    {sekundarQuelle?.file ?? t('cutSync.statusGap')}
                  </span>
                </div>
                <div className="relative aspect-video bg-[#0B0E11]">
                  {sekundarQuelle ? (
                    <>
                      <img
                        src={THUMB_ENDZONE}
                        alt={secondaryAngle}
                        className={`h-full w-full object-cover ${
                          syncSekundar.inBereich ? 'opacity-70' : 'opacity-30'
                        }`}
                      />
                      {!syncSekundar.inBereich && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded border border-[#F59E0B]/50 bg-[#0B0E11]/90 px-2.5 py-1 text-xs text-[#F59E0B]">
                            {t('cutSync.outOfRange')}
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 rounded bg-[#0B0E11]/90 px-2 py-0.5 font-mono text-[11px] text-[#F59E0B] tabular-nums">
                        {formatiereTimecode(syncSekundar.angleMs)} ({sekundarOffset >= 0 ? '+' : ''}
                        {sekundarOffset} ms)
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[#8B949E]">
                      {t('cutSync.missingClipNotice', { angle: secondaryAngle })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3 border-t border-[#232933] pt-4">
              <input
                type="range"
                min={0}
                max={masterDauerMs}
                step={FRAME_MS}
                value={syncZeitMs}
                aria-label={t('cutSync.syncTransport')}
                onChange={(e) => {
                  setLaeuft(false);
                  setSyncZeitMs(frameZuZeit(zeitZuFrame(Number(e.target.value))));
                }}
                className="w-full accent-[#F59E0B]"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLaeuft(false);
                      setSyncZeitMs((alt) => Math.max(0, quantisiereAufFrame(alt - FRAME_MS)));
                    }}
                    className="rounded border border-[#232933] bg-[#0B0E11] p-1.5 text-[#E6EDF3] hover:border-[#F59E0B]"
                    aria-label="1 Frame -"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLaeuft((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded bg-[#F59E0B] px-3 py-1.5 text-xs font-semibold text-[#0B0E11] hover:bg-[#D97706]"
                  >
                    {laeuft ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {laeuft ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLaeuft(false);
                      setSyncZeitMs((alt) =>
                        Math.min(masterDauerMs, quantisiereAufFrame(alt + FRAME_MS))
                      );
                    }}
                    className="rounded border border-[#232933] bg-[#0B0E11] p-1.5 text-[#E6EDF3] hover:border-[#F59E0B]"
                    aria-label="1 Frame +"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {hatZweitenWinkel && aktiverPlay && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[#8B949E]">
                      {t('cutSync.offsetLabel', { angle: secondaryAngle })}:
                    </span>
                    <button
                      type="button"
                      disabled={!sekundarQuelle}
                      onClick={() => aendereOffset(sekundarOffset - 200)}
                      className="rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 font-mono text-[#E6EDF3] hover:border-[#F59E0B] disabled:opacity-40"
                    >
                      -200ms
                    </button>
                    <button
                      type="button"
                      disabled={!sekundarQuelle}
                      onClick={() => aendereOffset(sekundarOffset - FRAME_MS)}
                      className="rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 font-mono text-[#E6EDF3] hover:border-[#F59E0B] disabled:opacity-40"
                    >
                      -40ms
                    </button>
                    <input
                      type="number"
                      step={FRAME_MS}
                      disabled={!sekundarQuelle}
                      value={sekundarOffset}
                      onChange={(e) => aendereOffset(Number(e.target.value) || 0)}
                      className="w-20 rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 text-right font-mono text-white tabular-nums disabled:opacity-40"
                    />
                    <button
                      type="button"
                      disabled={!sekundarQuelle}
                      onClick={() => aendereOffset(sekundarOffset + FRAME_MS)}
                      className="rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 font-mono text-[#E6EDF3] hover:border-[#F59E0B] disabled:opacity-40"
                    >
                      +40ms
                    </button>
                    <button
                      type="button"
                      disabled={!sekundarQuelle}
                      onClick={() => aendereOffset(sekundarOffset + 200)}
                      className="rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 font-mono text-[#E6EDF3] hover:border-[#F59E0B] disabled:opacity-40"
                    >
                      +200ms
                    </button>
                    <button
                      type="button"
                      disabled={!sekundarQuelle || sekundarOffset === 0}
                      onClick={() => aendereOffset(0)}
                      className="rounded border border-[#232933] px-2 py-1 text-[#8B949E] hover:text-white disabled:opacity-40"
                    >
                      {t('cutSync.resetOffset')}
                    </button>
                    <button
                      type="button"
                      disabled={!sekundarQuelle}
                      onClick={() => {
                        const neu = uebernehmeOffsetAufFolgePlays(
                          reel.plays,
                          aktiverPlay.play_number,
                          secondaryAngle,
                          sekundarOffset
                        );
                        onPlaysAktualisieren(reel.id, neu);
                        setStatusHinweis(
                          t('cutSync.applyFollowingDone', {
                            offset: sekundarOffset,
                            play: aktiverPlay.play_number,
                          })
                        );
                      }}
                      className="rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-1 text-[#F59E0B] hover:bg-[#F59E0B]/20 disabled:opacity-40"
                    >
                      {t('cutSync.applyFollowing')}
                    </button>
                    <button
                      type="button"
                      disabled={aktiverPlayIndex === 0}
                      onClick={() => {
                        const neu = tauscheClipMitNachbar(
                          reel.plays,
                          aktiverPlay.play_number,
                          secondaryAngle,
                          -1
                        );
                        onPlaysAktualisieren(reel.id, neu);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[#232933] px-2 py-1 text-[#E6EDF3] hover:border-[#F59E0B] disabled:opacity-40"
                    >
                      <ArrowLeftRight className="h-3 w-3" />
                      {t('cutSync.swapPrev')}
                    </button>
                    <button
                      type="button"
                      disabled={aktiverPlayIndex >= reel.plays.length - 1}
                      onClick={() => {
                        const neu = tauscheClipMitNachbar(
                          reel.plays,
                          aktiverPlay.play_number,
                          secondaryAngle,
                          1
                        );
                        onPlaysAktualisieren(reel.id, neu);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[#232933] px-2 py-1 text-[#E6EDF3] hover:border-[#F59E0B] disabled:opacity-40"
                    >
                      <ArrowLeftRight className="h-3 w-3" />
                      {t('cutSync.swapNext')}
                    </button>
                    <button
                      type="button"
                      disabled={!sekundarQuelle}
                      onClick={() => {
                        const neu = entferneWinkelClip(
                          reel.plays,
                          aktiverPlay.play_number,
                          secondaryAngle
                        );
                        onPlaysAktualisieren(reel.id, neu);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[#232933] px-2 py-1 text-red-400 hover:border-red-400/50 disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('cutSync.removeMissingClip')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#232933] bg-[#13171D] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white">
                {t('cutSync.playsTableTitle', { count: reel.plays.length })}
              </h2>
              {syncProbleme.length > 0 && (
                <span className="inline-flex items-center gap-1 font-mono text-xs text-[#F59E0B]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('cutSync.problemsCount', { count: syncProbleme.length })}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#232933] text-[#8B949E]">
                    <th className="py-2 font-medium">{t('cutSync.colPlay')}</th>
                    <th className="py-2 font-medium">
                      {t('cutSync.colMaster', { angle: masterAngle })}
                    </th>
                    <th className="py-2 font-medium">
                      {t('cutSync.colSecondary', { angle: secondaryAngle })}
                    </th>
                    <th className="py-2 font-medium">{t('cutSync.colOffset')}</th>
                    <th className="py-2 font-medium">{t('cutSync.colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232933]">
                  {reel.plays.map((play, idx) => {
                    const mQ = play.sources[masterAngle] ?? null;
                    const sQ = play.sources[secondaryAngle] ?? null;
                    const ausgewaehlt = idx === aktiverPlayIndex;
                    const playProblem = syncProbleme.find((p) => p.playNumber === play.play_number);

                    return (
                      <tr
                        key={play.play_number}
                        onClick={() => {
                          setAktiverPlayIndex(idx);
                          setSyncZeitMs(0);
                          setLaeuft(false);
                        }}
                        className={`cursor-pointer transition-colors ${
                          ausgewaehlt ? 'bg-[#F59E0B]/10' : 'hover:bg-[#0B0E11]/60'
                        }`}
                      >
                        <td className="py-2 font-mono text-white tabular-nums">
                          P-{String(play.play_number).padStart(2, '0')}
                        </td>
                        <td className="py-2 font-mono text-[#E6EDF3]">
                          {mQ ? mQ.file : t('cutSync.statusGap')}
                        </td>
                        <td className="py-2 font-mono text-[#E6EDF3]">
                          {sQ ? sQ.file : t('cutSync.statusGap')}
                        </td>
                        <td className="py-2 font-mono text-[#8B949E] tabular-nums">
                          {sQ?.offset_ms ? `${sQ.offset_ms > 0 ? '+' : ''}${sQ.offset_ms} ms` : '0 ms'}
                        </td>
                        <td className="py-2 text-xs">
                          {playProblem?.typ === 'MISSING_CLIP' ? (
                            <span className="text-red-400">{t('cutSync.statusGap')}</span>
                          ) : playProblem?.typ === 'DURATION_MISMATCH' ? (
                            <span className="text-[#F59E0B]">
                              {t('cutSync.statusDuration', { ms: playProblem.detailMs ?? 0 })}
                            </span>
                          ) : playProblem?.typ === 'OFFSET_APPLIED' ? (
                            <span className="text-[#F59E0B]">
                              {t('cutSync.statusOffset', { ms: playProblem.detailMs ?? 0 })}
                            </span>
                          ) : (
                            <span className="text-emerald-400">{t('cutSync.statusOk')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
