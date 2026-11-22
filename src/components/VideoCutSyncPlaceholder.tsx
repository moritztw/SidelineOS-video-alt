import { ArrowLeft, Layers, ListFilter } from 'lucide-react';
import type { VideoReel } from '../types.ts';
import {
  createVideoTranslator,
  holeVideoFreigabeLabel,
  holeVideoKategorieLabel,
} from '../i18n.ts';

type PlatzhalterAnsicht = 'cut-sync' | 'playlists';

interface VideoCutSyncPlaceholderProps {
  ansicht: PlatzhalterAnsicht;
  locale?: string;
  ausgewaehltesReel: VideoReel | null;
  onZurueckZumDashboard: () => void;
}

export function VideoCutSyncPlaceholder({
  ansicht,
  locale,
  ausgewaehltesReel,
  onZurueckZumDashboard,
}: VideoCutSyncPlaceholderProps) {
  const t = createVideoTranslator(locale);
  const istCutSync = ansicht === 'cut-sync';
  const titel = istCutSync ? t('placeholder.cutSyncTitle') : t('placeholder.playlistsTitle');
  const paket = istCutSync ? t('placeholder.cutSyncPkg') : t('placeholder.playlistsPkg');
  const beschreibung = istCutSync
    ? t('placeholder.cutSyncDesc')
    : t('placeholder.playlistsDesc');
  const Icon = istCutSync ? Layers : ListFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onZurueckZumDashboard}
          className="inline-flex items-center gap-2 text-sm text-[#8B949E] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('placeholder.backToLibrary')}
        </button>
      </div>

      <section className="rounded-lg border border-[#232933] bg-[#13171D] p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-md border border-[#232933] bg-[#0B0E11] p-3 text-[#F59E0B]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs text-[#F59E0B]">
              {t('placeholder.plannedIn', { pkg: paket })}
            </p>
            <h1 className="text-xl font-semibold text-white">{titel}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[#8B949E]">{beschreibung}</p>
          </div>
        </div>

        {ausgewaehltesReel && istCutSync && (
          <div className="mt-6 border-t border-[#232933] pt-6">
            <h2 className="text-xs font-medium text-[#8B949E]">{t('placeholder.selectedReel')}</h2>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-md border border-[#232933] bg-[#0B0E11] p-4">
              <div>
                <div className="text-sm font-semibold text-white">{ausgewaehltesReel.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8B949E]">
                  <span>{holeVideoKategorieLabel(ausgewaehltesReel.category, locale)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{ausgewaehltesReel.eventDate}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {t('dashboard.playsCount', { count: ausgewaehltesReel.playCount })}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t('placeholder.angles', { angles: ausgewaehltesReel.angles.join(' + ') })}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t('placeholder.visibility', {
                      visibility: holeVideoFreigabeLabel(ausgewaehltesReel.visibility, locale),
                    })}
                  </span>
                </div>
              </div>
              <span className="font-mono text-xs text-[#8B949E]">
                {t('placeholder.modePrefix')}{' '}
                {ausgewaehltesReel.sourceMode === 'TIME_SLICE'
                  ? t('dashboard.modeTimeSlice')
                  : t('dashboard.modeClips')}
              </span>
            </div>

            {ausgewaehltesReel.plays.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#232933] text-[#8B949E]">
                      <th className="py-2 font-medium">#</th>
                      <th className="py-2 font-medium">{t('placeholder.colSources')}</th>
                      <th className="py-2 font-medium">{t('placeholder.colOffset')}</th>
                      <th className="py-2 font-medium">{t('placeholder.colSituation')}</th>
                      <th className="py-2 font-medium">{t('placeholder.colPlayType')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232933]">
                    {ausgewaehltesReel.plays.map((play) => {
                      const winkelEintraege = Object.entries(play.sources);
                      const offsets = winkelEintraege
                        .filter(([, q]) => q?.offset_ms !== undefined && q.offset_ms !== 0)
                        .map(([w, q]) => `${w}: ${(q!.offset_ms! / 1000).toFixed(2)}s`);

                      return (
                        <tr key={play.play_number}>
                          <td className="py-2.5 font-mono text-[#E6EDF3] tabular-nums">
                            P-{String(play.play_number).padStart(2, '0')}
                          </td>
                          <td className="py-2.5 font-mono text-[#E6EDF3]">
                            {winkelEintraege
                              .map(([w, q]) =>
                                q ? `${w} (${q.file})` : `${w} (${t('placeholder.missingAngle')})`
                              )
                              .join(' · ')}
                          </td>
                          <td className="py-2.5 font-mono text-[#8B949E] tabular-nums">
                            {offsets.length > 0 ? offsets.join(', ') : t('placeholder.noOffset')}
                          </td>
                          <td className="py-2.5 font-mono text-[#E6EDF3] tabular-nums">
                            {play.breakdown?.odk ?? '–'} · {play.breakdown?.down ?? '–'} &amp;{' '}
                            {play.breakdown?.distance ?? '–'}
                          </td>
                          <td className="py-2.5 text-[#E6EDF3]">
                            {play.breakdown?.play_type ?? '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
