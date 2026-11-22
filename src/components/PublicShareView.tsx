import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  Film,
  Lock,
  Play,
} from 'lucide-react';
import { holeAktuelleBrandKonfig, teileWortmarke } from '../../../sdk/plugin.ts';
import { useVideoAnalysis } from '../VideoAnalysisContext.tsx';
import { createVideoTranslator, holeVideoKategorieLabel } from '../i18n.ts';
import {
  exportiereBreakdownAlsCsv,
  filtereBundleFuerFreigabe,
  istShareLinkGueltig,
} from '../services/bundleSchema.ts';
import { leseBreakdownWert } from '../services/taggingEngine.ts';
import { THUMB_ENDZONE, THUMB_SIDELINE } from '../data/demoReels.ts';

interface PublicShareViewProps {
  token: string;
  locale?: string;
  onSchliessen: () => void;
}

export function PublicShareView({ token, locale, onSchliessen }: PublicShareViewProps) {
  const { reels, tagSchema } = useVideoAnalysis();
  const t = createVideoTranslator(locale);
  const brand = holeAktuelleBrandKonfig();
  const { basis, akzent } = teileWortmarke(brand.produktName);

  let gefundenerTreffer: {
    reel: (typeof reels)[number];
    link: (typeof reels)[number]['shareLinks'][number];
  } | null = null;

  for (const reel of reels) {
    const link = reel.shareLinks.find((l) => l.token === token);
    if (link) {
      gefundenerTreffer = { reel, link };
      break;
    }
  }

  const [aktiverPlayIndex, setAktiverPlayIndex] = useState(0);
  const [aktiverWinkel, setAktiverWinkel] = useState<string>(
    gefundenerTreffer?.reel.angles[0] ?? 'SIDELINE'
  );

  if (!gefundenerTreffer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E11] px-4 py-10 text-[#E6EDF3]">
        <div className="w-full max-w-md rounded-xl border border-[#232933] bg-[#13171D] p-6 space-y-4 text-center">
          <div className="mx-auto inline-flex rounded-full border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-[#FCA5A5]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="font-mono text-xs text-[#FCA5A5]">HTTP 404 Not Found</div>
          <h1 className="text-base font-semibold text-white">{t('publicShare.notFoundTitle')}</h1>
          <p className="text-xs text-[#8B949E]">
            {t('publicShare.notFoundBody', { path: `/share/${token}` })}
          </p>
          <button
            type="button"
            onClick={onSchliessen}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#232933] bg-[#0B0E11] px-4 py-2 text-xs font-medium text-white hover:border-[#F59E0B]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('publicShare.backToBrand', { brand: brand.produktName })}
          </button>
        </div>
      </div>
    );
  }

  const { reel, link } = gefundenerTreffer;
  const gueltig = istShareLinkGueltig(link);

  if (!gueltig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E11] px-4 py-10 text-[#E6EDF3]">
        <div className="w-full max-w-md rounded-xl border border-[#232933] bg-[#13171D] p-6 space-y-4 text-center">
          <div className="mx-auto inline-flex rounded-full border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-[#FCA5A5]">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="font-mono text-xs text-[#FCA5A5]">HTTP 410 Gone</div>
          <h1 className="text-base font-semibold text-white">{t('publicShare.expiredTitle')}</h1>
          <p className="text-xs text-[#8B949E]">
            {t('publicShare.expiredBody', { name: link.bezeichnung })}
          </p>
          <button
            type="button"
            onClick={onSchliessen}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#232933] bg-[#0B0E11] px-4 py-2 text-xs font-medium text-white hover:border-[#F59E0B]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('publicShare.backToBrand', { brand: brand.produktName })}
          </button>
        </div>
      </div>
    );
  }

  const gefiltertesBundle = filtereBundleFuerFreigabe(reel, link.freigegebeneFelder);
  const freigegebeneSpalten = tagSchema.filter((f) => link.freigegebeneFelder.includes(f.key));
  const aktiverPlay = gefiltertesBundle.plays[aktiverPlayIndex] ?? gefiltertesBundle.plays[0];
  const vorschauBild = aktiverWinkel === 'ENDZONE' ? THUMB_ENDZONE : THUMB_SIDELINE;
  const datumLocale = locale === 'en' ? 'en-US' : 'de-DE';

  const handleDownload = (format: 'json' | 'csv') => {
    const inhalt =
      format === 'json'
        ? JSON.stringify(gefiltertesBundle, null, 2)
        : exportiereBreakdownAlsCsv(gefiltertesBundle.plays, link.freigegebeneFelder, tagSchema);
    const mime = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
    const blob = new Blob([inhalt], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${link.token}.${format === 'json' ? 'sideline.json' : 'csv'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0B0E11] text-[#E6EDF3]">
      {/* Öffentliche Kopfzeile */}
      <header className="border-b border-[#232933] bg-[#0F1318]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold tracking-tight text-white">
              {basis}
              {akzent && <span className="text-[#F59E0B]">{akzent}</span>}
              <span className="font-medium text-[#8B949E]">-Core</span>
            </span>
            <span className="text-[#36404F]">/</span>
            <span className="font-mono text-xs text-[#F59E0B]">{link.pfad}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownload('json')}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#F59E0B] px-3 py-1.5 text-xs font-semibold text-[#0B0E11] hover:bg-[#FBBF24]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t('publicShare.downloadJson')}
            </button>
            {freigegebeneSpalten.length > 0 && (
              <button
                type="button"
                onClick={() => handleDownload('csv')}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#232933] bg-[#13171D] px-3 py-1.5 text-xs font-medium text-white hover:border-[#F59E0B]"
              >
                <Download className="h-3.5 w-3.5 text-[#8B949E]" aria-hidden="true" />
                {t('publicShare.downloadCsv')}
              </button>
            )}
            <button
              type="button"
              onClick={onSchliessen}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#232933] bg-[#0B0E11] px-3 py-1.5 text-xs text-[#8B949E] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t('publicShare.toApp')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] space-y-6 px-6 py-6">
        {/* Metadaten & Datenschutz-Hinweis */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#232933] bg-[#13171D] p-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#8B949E]">
              <Film className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
              <span>{t('publicShare.readOnlyBadge')}</span>
              <span>·</span>
              <span>{holeVideoKategorieLabel(reel.category, locale)}</span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-white">{link.bezeichnung}</h1>
            <p className="text-xs text-[#8B949E]">
              {t('publicShare.metaLine', {
                title: reel.title,
                plays: gefiltertesBundle.plays.length,
                angles: reel.angles.join(' + '),
              })}
            </p>
          </div>

          <div className="space-y-1 text-right text-xs">
            <div className="inline-flex items-center gap-1.5 font-mono text-[#4ADE80]">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {t('publicShare.validUntil', {
                date: new Date(link.gueltigBis).toLocaleDateString(datumLocale),
              })}
            </div>
            <div className="flex items-center justify-end gap-1 text-[11px] text-[#8B949E]">
              <Lock className="h-3 w-3" aria-hidden="true" />
              {t('publicShare.privateHint')}
            </div>
          </div>
        </section>

        {/* Video-Vorschau & Play-Liste */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3 rounded-lg border border-[#232933] bg-[#13171D] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-xs text-white">
                {t('publicShare.playAngleTitle', {
                  play: aktiverPlay?.play_number ?? 1,
                  angle: aktiverWinkel,
                })}
              </div>
              <div className="flex items-center gap-1">
                {reel.angles.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setAktiverWinkel(w)}
                    className={`rounded border px-2.5 py-1 font-mono text-[11px] ${
                      aktiverWinkel === w
                        ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                        : 'border-[#232933] bg-[#0B0E11] text-[#8B949E] hover:text-white'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative aspect-video overflow-hidden rounded border border-[#232933] bg-[#0B0E11]">
              <img
                src={vorschauBild}
                alt={t('publicShare.previewAlt', { play: aktiverPlay?.play_number ?? 1 })}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#F59E0B]/60 bg-[#0B0E11]/90 px-4 py-2 text-xs font-medium text-white">
                  <Play className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                  {t('publicShare.streamPreview', {
                    file: aktiverPlay?.sources[aktiverWinkel]?.file ?? 'Clip',
                  })}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-[#232933] bg-[#13171D] p-4 space-y-2">
            <h2 className="text-xs font-semibold text-white">
              {t('publicShare.playsIncluded', { count: gefiltertesBundle.plays.length })}
            </h2>
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {gefiltertesBundle.plays.map((play, idx) => {
                const aktiv = idx === aktiverPlayIndex;
                return (
                  <button
                    key={play.play_number}
                    type="button"
                    onClick={() => setAktiverPlayIndex(idx)}
                    className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs ${
                      aktiv
                        ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-white'
                        : 'border-[#232933] bg-[#0B0E11] text-[#8B949E] hover:text-white'
                    }`}
                  >
                    <span className="font-mono">Play #{play.play_number}</span>
                    <span className="font-mono text-[11px]">
                      {play.sources[aktiverWinkel]
                        ? play.sources[aktiverWinkel]!.file
                        : t('publicShare.angleMissing')}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>

        {/* Ausschließlich freigegebene Tagging-Spalten */}
        <section className="rounded-lg border border-[#232933] bg-[#13171D] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">
            {t('publicShare.sharedDataTitle', { count: freigegebeneSpalten.length })}
          </h2>

          {freigegebeneSpalten.length === 0 ? (
            <p className="rounded border border-[#232933] bg-[#0B0E11] px-4 py-5 text-center text-xs text-[#8B949E]">
              {t('publicShare.noTagColumns')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#232933] text-[#8B949E]">
                    <th className="py-2 pr-3 font-mono font-medium">PLAY #</th>
                    {freigegebeneSpalten.map((feld) => (
                      <th key={feld.key} className="py-2 pr-3 font-mono font-medium">
                        {feld.kurz}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232933]">
                  {gefiltertesBundle.plays.map((play, idx) => (
                    <tr
                      key={play.play_number}
                      onClick={() => setAktiverPlayIndex(idx)}
                      className={`cursor-pointer transition-colors ${
                        idx === aktiverPlayIndex ? 'bg-[#1E2530]/60' : 'hover:bg-[#191F27]'
                      }`}
                    >
                      <td className="py-2 pr-3 font-mono text-[#F59E0B]">{play.play_number}</td>
                      {freigegebeneSpalten.map((feld) => (
                        <td key={feld.key} className="py-2 pr-3 font-mono text-[#E6EDF3]">
                          {leseBreakdownWert(play.breakdown, feld) ?? '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
