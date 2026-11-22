import { useEffect, useState } from 'react';
import { HardDrive, Keyboard, RotateCcw, Trash2 } from 'lucide-react';
import type { PluginSettingsKontext } from '../../../sdk/plugin.ts';
import type { HotkeyAktion, KommentarEcke } from '../types.ts';
import {
  createVideoTranslator,
  holeHotkeyInfo,
  holeVideoEckeLabel,
} from '../i18n.ts';
import {
  HOTKEY_BESCHREIBUNGEN,
  STANDARD_HOTKEYS,
  STANDARD_NUTZER_EINSTELLUNGEN,
  aktualisiereBenutzerHotkey,
} from '../services/frameAndHotkeys.ts';
import { useVideoAnalysis } from '../VideoAnalysisContext.tsx';
import { TaggingSchemaSettings } from './TaggingSchemaSettings.tsx';

const ECKEN_IDS: KommentarEcke[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

const GESCHWINDIGKEITEN: Array<0.5 | 1 | 1.5> = [0.5, 1, 1.5];

interface CleanupEintrag {
  id: string;
  assetPfad: string;
  groesseGb: number;
  geplanteLoeschung: string;
  restTage: number;
}

const INITIALE_QUEUE: CleanupEintrag[] = [
  {
    id: 'gc-1',
    assetPfad: 'plugins/video-analysis/a8f12c90-4b21/clips/',
    groesseGb: 3.4,
    geplanteLoeschung: '04.12.2026',
    restTage: 14,
  },
  {
    id: 'gc-2',
    assetPfad: 'plugins/video-analysis/d390e112-90ab/raw_source.mp4',
    groesseGb: 8.7,
    geplanteLoeschung: '22.11.2026',
    restTage: 2,
  },
];

/**
 * Persönliche Modul-Einstellungen des Videoanalyse-Plugins (Hotkeys & Player-Defaults).
 */
export function VideoUserSettingsPanel({ ctx }: { ctx: PluginSettingsKontext }) {
  const { nutzerEinstellungen, onNutzerEinstellungenAendern } = useVideoAnalysis();
  const t = createVideoTranslator(ctx.locale);
  const istCoach = ctx.aktiveTeamAnsicht === 'COACH' || ctx.aktiveTeamAnsicht === 'TEAM_ADMIN';

  const [aufnahmeAktion, setAufnahmeAktion] = useState<HotkeyAktion | null>(null);
  const [hotkeyFehler, setHotkeyFehler] = useState<string | null>(null);
  const [hotkeyHinweis, setHotkeyHinweis] = useState<string | null>(null);

  useEffect(() => {
    if (!aufnahmeAktion) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setAufnahmeAktion(null);
        setHotkeyFehler(null);
        return;
      }

      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }

      const ergebnis = aktualisiereBenutzerHotkey(
        nutzerEinstellungen.hotkeys,
        aufnahmeAktion,
        e.key
      );
      if (!ergebnis.ok) {
        const konflikt = (
          Object.entries(nutzerEinstellungen.hotkeys) as Array<[HotkeyAktion, string]>
        ).find(
          ([andereAktion, belegteTaste]) =>
            andereAktion !== aufnahmeAktion && belegteTaste === e.key.trim().toLowerCase()
        );
        if (konflikt) {
          setHotkeyFehler(
            t('settings.hotkeyConflict', {
              key: e.key.trim().toUpperCase(),
              action: holeHotkeyInfo(konflikt[0], ctx.locale).label,
            })
          );
        } else {
          setHotkeyFehler(t('settings.hotkeyInvalid'));
        }
        return;
      }

      onNutzerEinstellungenAendern({
        ...nutzerEinstellungen,
        hotkeys: ergebnis.hotkeys,
      });
      setAufnahmeAktion(null);
      setHotkeyFehler(null);
      setHotkeyHinweis(t('settings.hotkeySaved'));
      setTimeout(() => setHotkeyHinweis(null), 2000);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [aufnahmeAktion, nutzerEinstellungen, onNutzerEinstellungenAendern, ctx.locale, t]);

  const sichtbareHotkeys = istCoach
    ? HOTKEY_BESCHREIBUNGEN
    : HOTKEY_BESCHREIBUNGEN.filter(
        (h) => h.aktion === 'toggleFullscreen' || h.aktion === 'switchAngle'
      );

  return (
    <>
      <section
        id="modul-video-hotkeys"
        className="scroll-mt-20 rounded-lg border border-[#232933] bg-[#13171D] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232933] pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-white">{t('settings.hotkeysTitle')}</h2>
              <p className="text-[11px] text-[#8B949E]">{t('settings.hotkeysDesc')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setAufnahmeAktion(null);
              setHotkeyFehler(null);
              onNutzerEinstellungenAendern({
                ...STANDARD_NUTZER_EINSTELLUNGEN,
                hotkeys: { ...STANDARD_HOTKEYS },
              });
              setHotkeyHinweis(t('settings.resetDone'));
              setTimeout(() => setHotkeyHinweis(null), 2200);
            }}
            className="inline-flex items-center gap-1.5 rounded border border-[#232933] bg-[#0B0E11] px-3 py-1.5 text-xs text-[#8B949E] hover:border-[#36404F] hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.resetDefaults')}
          </button>
        </div>

        {hotkeyFehler && (
          <div
            role="alert"
            className="rounded border border-[#DC2626]/50 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#FCA5A5]"
          >
            {hotkeyFehler}
          </div>
        )}
        {hotkeyHinweis && (
          <div
            role="status"
            className="rounded border border-[#16A34A]/40 bg-[#16A34A]/10 px-3 py-2 text-xs text-[#86EFAC]"
          >
            {hotkeyHinweis}
          </div>
        )}

        <div className="divide-y divide-[#232933] rounded-md border border-[#232933] bg-[#0B0E11]">
          {sichtbareHotkeys.map((eintrag) => {
            const aktiv = aufnahmeAktion === eintrag.aktion;
            const belegteTaste = nutzerEinstellungen.hotkeys[eintrag.aktion];
            const info = holeHotkeyInfo(eintrag.aktion, ctx.locale);

            return (
              <div
                key={eintrag.aktion}
                className="flex items-center justify-between gap-4 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#E6EDF3]">{info.label}</div>
                  <div className="text-[11px] text-[#8B949E]">{info.beschreibung}</div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHotkeyFehler(null);
                    setAufnahmeAktion(aktiv ? null : eintrag.aktion);
                  }}
                  className={`min-w-[92px] rounded border px-3 py-1.5 font-mono text-xs font-semibold transition-colors whitespace-nowrap ${
                    aktiv
                      ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                      : 'border-[#232933] bg-[#13171D] text-white hover:border-[#F59E0B]'
                  }`}
                >
                  {aktiv ? t('settings.pressKey') : belegteTaste.toUpperCase()}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section
        id="modul-video-player"
        className="scroll-mt-20 rounded-lg border border-[#232933] bg-[#13171D] p-5 space-y-5"
      >
        <div className="border-b border-[#232933] pb-3">
          <h2 className="text-sm font-semibold text-white">{t('settings.playerTitle')}</h2>
          <p className="mt-0.5 text-[11px] text-[#8B949E]">{t('settings.playerDesc')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#E6EDF3]">
              {t('settings.defaultCorner')}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {ECKEN_IDS.map((eckeId) => {
                const aktiv = nutzerEinstellungen.standardKommentarEcke === eckeId;
                return (
                  <button
                    key={eckeId}
                    type="button"
                    onClick={() =>
                      onNutzerEinstellungenAendern({
                        ...nutzerEinstellungen,
                        standardKommentarEcke: eckeId,
                      })
                    }
                    className={`rounded border px-3 py-2 text-xs font-medium transition-colors ${
                      aktiv
                        ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]'
                        : 'border-[#232933] bg-[#0B0E11] text-[#8B949E] hover:text-white'
                    }`}
                  >
                    {holeVideoEckeLabel(eckeId, ctx.locale)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <span className="block text-xs font-medium text-[#E6EDF3]">
                {t('settings.defaultSpeed')}
              </span>
              <div className="flex items-center gap-2">
                {GESCHWINDIGKEITEN.map((tempo) => {
                  const aktiv = nutzerEinstellungen.standardGeschwindigkeit === tempo;
                  return (
                    <button
                      key={tempo}
                      type="button"
                      onClick={() =>
                        onNutzerEinstellungenAendern({
                          ...nutzerEinstellungen,
                          standardGeschwindigkeit: tempo,
                        })
                      }
                      className={`flex-1 rounded border py-1.5 font-mono text-xs font-medium transition-colors ${
                        aktiv
                          ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]'
                          : 'border-[#232933] bg-[#0B0E11] text-[#8B949E] hover:text-white'
                      }`}
                    >
                      {tempo.toFixed(1)}x
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <input
                type="checkbox"
                checked={nutzerEinstellungen.standardAutoStop}
                onChange={(e) =>
                  onNutzerEinstellungenAendern({
                    ...nutzerEinstellungen,
                    standardAutoStop: e.target.checked,
                  })
                }
                className="mt-0.5 h-3.5 w-3.5 accent-[#F59E0B]"
              />
              <div>
                <div className="font-medium text-[#E6EDF3]">
                  {t('settings.defaultAutoStop')}
                </div>
                <p className="mt-0.5 text-[11px] text-[#8B949E]">
                  {t('settings.defaultAutoStopDesc')}
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Team-Admin-Panel des Videoanalyse-Plugins (Tagging-Schema & Wörterbuch).
 */
export function VideoTeamSettingsPanel({ ctx }: { ctx: PluginSettingsKontext }) {
  const {
    tagSchema,
    onFeldToggle,
    onDefinitionLernen,
    onDefinitionLoeschen,
    onCustomFeldErstellen,
    onCustomFeldLoeschen,
  } = useVideoAnalysis();

  return (
    <div id="modul-video-tagging" className="scroll-mt-20">
      <TaggingSchemaSettings
        teamRolle={ctx.aktiveTeamAnsicht ?? 'TEAM_ADMIN'}
        locale={ctx.locale}
        tagSchema={tagSchema}
        onFeldToggle={onFeldToggle}
        onDefinitionHinzufuegen={onDefinitionLernen}
        onDefinitionLoeschen={onDefinitionLoeschen}
        onCustomFeldErstellen={onCustomFeldErstellen}
        onCustomFeldLoeschen={onCustomFeldLoeschen}
      />
    </div>
  );
}

/**
 * Sysadmin-Panel des Videoanalyse-Plugins (S3-Cleanup-Queue & Schonfrist).
 */
export function VideoSysadminSettingsPanel({ ctx }: { ctx: PluginSettingsKontext }) {
  const t = createVideoTranslator(ctx.locale);
  const [retentionTage, setRetentionTage] = useState<number>(14);
  const [queue, setQueue] = useState<CleanupEintrag[]>(INITIALE_QUEUE);
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);

  return (
    <section
      id="modul-video-cleanup"
      className="scroll-mt-20 rounded-lg border border-[#232933] bg-[#13171D] p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#232933] pb-4">
        <div className="flex items-center gap-2.5">
          <HardDrive className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-white">{t('settings.cleanupTitle')}</h2>
            <p className="text-xs text-[#8B949E]">
              {t('settings.cleanupDescBefore')}{' '}
              <span className="font-mono text-[#E6EDF3]">{ctx.s3Konfig.bucket}</span>{' '}
              {t('settings.cleanupDescAfter')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#8B949E]">
            {t('settings.retentionDays')}
            <input
              type="number"
              min={1}
              max={90}
              value={retentionTage}
              onChange={(e) => setRetentionTage(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded border border-[#232933] bg-[#0B0E11] px-2 py-1 font-mono text-xs text-white tabular-nums focus:border-[#F59E0B] focus:outline-none"
            />
          </label>

          <button
            type="button"
            disabled={queue.length === 0}
            onClick={() => {
              const anzahl = queue.length;
              if (anzahl === 0) return;
              setQueue([]);
              setCleanupStatus(t('settings.cleanupRan', { count: anzahl }));
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-1.5 text-xs font-medium text-[#FCA5A5] transition-colors hover:bg-[#DC2626]/20 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.cleanupRun')}
          </button>
        </div>
      </div>

      {cleanupStatus && (
        <div
          role="status"
          className="rounded-md border border-[#16A34A]/30 bg-[#16A34A]/10 px-3 py-2 text-xs text-[#86EFAC]"
        >
          {cleanupStatus}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#8B949E]">
          {t('settings.cleanupEmpty')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#232933] text-[#8B949E]">
                <th className="py-2 font-medium">{t('settings.cleanupPathCol')}</th>
                <th className="py-2 text-right font-medium">{t('settings.cleanupSizeCol')}</th>
                <th className="py-2 text-right font-medium">{t('settings.cleanupDateCol')}</th>
                <th className="py-2 text-right font-medium">{t('settings.cleanupActionCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232933]">
              {queue.map((eintrag) => (
                <tr key={eintrag.id} className="hover:bg-[#191F27]">
                  <td className="py-3 font-mono text-[#E6EDF3]">{eintrag.assetPfad}</td>
                  <td className="py-3 text-right font-mono text-[#E6EDF3] tabular-nums">
                    {eintrag.groesseGb.toFixed(1)} GB
                  </td>
                  <td className="py-3 text-right font-mono text-[#8B949E] tabular-nums">
                    {eintrag.geplanteLoeschung} (
                    {t('settings.cleanupDaysShort', { days: eintrag.restTage })})
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setQueue((alt) => alt.filter((item) => item.id !== eintrag.id));
                        setCleanupStatus(t('settings.cleanupRestored'));
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1 text-xs font-medium text-[#E6EDF3] transition-colors hover:border-[#F59E0B] hover:text-white"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      {t('settings.cleanupRestore')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
