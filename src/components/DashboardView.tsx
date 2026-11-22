import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  Film,
  Link2,
  Lock,
  Play,
  Search,
  Share2,
  Users,
} from 'lucide-react';
import { filtereNachSaison } from '../../../sdk/plugin.ts';
import type { TeamRolle } from '../../../sdk/plugin.ts';
import type {
  ReelKategorie,
  ShareDownloadLink,
  SpielerFreigabe,
  TagFeldKonfig,
  TeamFreigabeEintrag,
  VideoReel,
} from '../types.ts';
import {
  createVideoTranslator,
  holeVideoFreigabeLabel,
  holeVideoKategorieLabel,
} from '../i18n.ts';
import { istShareLinkGueltig, reelZuBundle } from '../services/bundleSchema.ts';
import { TeamShareModal } from './TeamShareModal.tsx';
import { UploadPanel } from './UploadPanel.tsx';

interface DashboardViewProps {
  teamId: string;
  gewaehlteSaison: string;
  teamAktiveSaison: string;
  teamRolle: TeamRolle;
  locale?: string;
  tagSchema: TagFeldKonfig[];
  reels: VideoReel[];
  uploadHervorgehoben: boolean;
  onNeuesReel: (reel: VideoReel) => void;
  onFreigabeAendern: (reelId: string, freigabe: SpielerFreigabe) => void;
  onTeamFreigabenAendern: (reelId: string, freigaben: TeamFreigabeEintrag[]) => void;
  onShareLinksAendern: (reelId: string, links: ShareDownloadLink[]) => void;
  onReelOeffnen: (reel: VideoReel) => void;
  onShareVorschau?: (token: string) => void;
}

const KATEGORIE_IDS: Array<'ALL' | ReelKategorie> = [
  'ALL',
  'GAME',
  'PRACTICE',
  'SCOUTING',
  'SELF_SCOUT',
];

const FREIGABE_OPTIONEN: SpielerFreigabe[] = [
  'COACHES_ONLY',
  'ALL_PLAYERS',
  'UNIT_OFFENSE',
  'UNIT_DEFENSE',
  'UNIT_SPECIAL_TEAMS',
];

function formatiereDatum(isoDatum: string, locale?: string): string {
  const teile = isoDatum.split('-');
  if (teile.length !== 3) return isoDatum;
  if (locale === 'en') {
    return isoDatum;
  }
  return `${teile[2]}.${teile[1]}.${teile[0]}`;
}

function ReelThumbnail({
  src,
  titel,
  vorschauLabel,
  altText,
}: {
  src: string;
  titel: string;
  vorschauLabel: string;
  altText: string;
}) {
  const [bildFehler, setBildFehler] = useState(false);

  if (bildFehler) {
    return (
      <div className="flex aspect-video w-36 shrink-0 flex-col items-center justify-center rounded border border-[#232933] bg-[#0B0E11] text-[#8B949E]">
        <Film className="h-5 w-5" aria-hidden="true" />
        <span className="mt-1 text-[10px]">{vorschauLabel}</span>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded border border-[#232933] bg-[#0B0E11]">
      <img
        src={src}
        alt={altText || titel}
        referrerPolicy="no-referrer"
        onError={() => setBildFehler(true)}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
      />
    </div>
  );
}

export function DashboardView({
  teamId,
  gewaehlteSaison,
  teamAktiveSaison,
  teamRolle,
  locale,
  tagSchema,
  reels,
  uploadHervorgehoben,
  onNeuesReel,
  onFreigabeAendern,
  onTeamFreigabenAendern,
  onShareLinksAendern,
  onReelOeffnen,
  onShareVorschau,
}: DashboardViewProps) {
  const t = createVideoTranslator(locale);
  const istCoach = teamRolle === 'COACH' || teamRolle === 'TEAM_ADMIN';
  const istArchivSaison = gewaehlteSaison !== 'ALL' && gewaehlteSaison !== teamAktiveSaison;
  const [aktiveKategorie, setAktiveKategorie] = useState<'ALL' | ReelKategorie>('ALL');
  const [suchbegriff, setSuchbegriff] = useState('');
  const [teilenReelId, setTeilenReelId] = useState<string | null>(null);

  const gefilterteReels = useMemo(() => {
    const query = suchbegriff.trim().toLowerCase();
    const teamReels = reels.filter((reel) => reel.teamId === teamId);
    const saisonReels = filtereNachSaison(teamReels, gewaehlteSaison);
    return saisonReels
      .filter((reel) => (teamRolle === 'PLAYER' ? reel.visibility !== 'COACHES_ONLY' : true))
      .filter((reel) => (aktiveKategorie === 'ALL' ? true : reel.category === aktiveKategorie))
      .filter((reel) =>
        query ? reel.title.toLowerCase().includes(query) || reel.eventDate.includes(query) : true
      )
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }, [reels, teamId, gewaehlteSaison, teamRolle, aktiveKategorie, suchbegriff]);

  const teilenReel = reels.find((r) => r.id === teilenReelId) ?? null;

  const handleJsonExport = (reel: VideoReel) => {
    const bundle = reelZuBundle(reel);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateiname = reel.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    link.href = url;
    link.download = `${dateiname || reel.id}.sideline.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label={t('dashboard.filterAria')}
          className="flex items-center gap-1 rounded-md border border-[#232933] bg-[#13171D] p-1"
        >
          {KATEGORIE_IDS.map((katId) => {
            const aktiv = aktiveKategorie === katId;
            return (
              <button
                key={katId}
                role="tab"
                type="button"
                aria-selected={aktiv}
                onClick={() => setAktiveKategorie(katId)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  aktiv ? 'bg-[#232933] text-white' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                }`}
              >
                {t(`category.${katId}`)}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B949E]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={suchbegriff}
            onChange={(e) => setSuchbegriff(e.target.value)}
            placeholder={t('dashboard.searchPlaceholder')}
            aria-label={t('dashboard.searchAria')}
            className="w-full rounded-md border border-[#232933] bg-[#13171D] py-2 pl-8 pr-3 text-xs text-white placeholder-[#6E7681] focus:border-[#F59E0B] focus:outline-none"
          />
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${
          istCoach ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''
        }`}
      >
        <section aria-label={t('dashboard.libraryAria')} className="min-w-0 space-y-3">
          {istArchivSaison && (
            <div className="flex items-center justify-between rounded-md border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-4 py-2.5 text-xs text-[#FDE68A]">
              <span>
                {t('dashboard.archiveNoticePrefix')}{' '}
                <strong className="font-mono text-white">{gewaehlteSaison}</strong>
                {t('dashboard.archiveNoticeSuffix')}
              </span>
              <span className="font-mono text-white tabular-nums">
                {t('dashboard.tapesCount', { count: gefilterteReels.length })}
              </span>
            </div>
          )}

          {teamRolle === 'PLAYER' && (
            <div className="flex items-center justify-between rounded-md border border-[#232933] bg-[#13171D] px-4 py-2.5 text-xs text-[#8B949E]">
              <span>{t('dashboard.playerNotice')}</span>
              <span className="font-mono text-[#E6EDF3] tabular-nums">
                {t('dashboard.releasedCount', { count: gefilterteReels.length })}
              </span>
            </div>
          )}

          {gefilterteReels.length === 0 ? (
            <div className="rounded-lg border border-[#232933] bg-[#13171D] px-6 py-14 text-center">
              <p className="text-sm font-medium text-[#E6EDF3]">{t('dashboard.emptyTitle')}</p>
              <p className="mt-1 text-xs text-[#8B949E]">
                {istCoach ? t('dashboard.emptyCoach') : t('dashboard.emptyPlayer')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#232933] overflow-hidden rounded-lg border border-[#232933] bg-[#13171D]">
              {gefilterteReels.map((reel) => {
                const prozent =
                  reel.playCount > 0 ? Math.round((reel.taggedCount / reel.playCount) * 100) : 0;
                const istNurCoaches = reel.visibility === 'COACHES_ONLY';
                const aktiveLinks = reel.shareLinks.filter((l) => istShareLinkGueltig(l)).length;

                return (
                  <article
                    key={reel.id}
                    className="group flex flex-col gap-4 p-4 transition-colors hover:bg-[#171C24] xl:flex-row xl:items-center xl:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <button
                        type="button"
                        onClick={() => onReelOeffnen(reel)}
                        className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
                        aria-label={t('dashboard.openInFilmRoomAria', { title: reel.title })}
                      >
                        <ReelThumbnail
                          src={reel.thumbnailUrl}
                          titel={reel.title}
                          vorschauLabel={t('dashboard.preview')}
                          altText={t('dashboard.previewAlt', { title: reel.title })}
                        />
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => onReelOeffnen(reel)}
                          className="block truncate text-left text-sm font-semibold text-white transition-colors hover:text-[#F59E0B]"
                        >
                          {reel.title}
                        </button>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#8B949E]">
                          <span>{holeVideoKategorieLabel(reel.category, locale)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatiereDatum(reel.eventDate, locale)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{reel.angles.join(' + ')}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {reel.sourceMode === 'TIME_SLICE'
                              ? t('dashboard.modeTimeSlice')
                              : t('dashboard.modeClips')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#E6EDF3] tabular-nums">
                              {t('dashboard.playsCount', { count: reel.playCount })}
                            </span>
                            <div
                              className="h-1.5 w-24 overflow-hidden rounded-full bg-[#232933]"
                              aria-label={t('dashboard.taggedAria', { percent: prozent })}
                            >
                              <div
                                className="h-full bg-[#F59E0B]"
                                style={{ width: `${prozent}%` }}
                              />
                            </div>
                            <span className="font-mono text-[#8B949E] tabular-nums">
                              {t('dashboard.taggedPercent', { percent: prozent })}
                            </span>
                          </div>

                          {reel.teamFreigaben.length > 0 && (
                            <span className="text-[#8B949E]">
                              {t('dashboard.sharedWith')}{' '}
                              {reel.teamFreigaben
                                .map((tEntry) =>
                                  tEntry.freigegebeneFelder.length > 0
                                    ? t('dashboard.sharedTagsCount', {
                                        team: tEntry.teamName,
                                        count: tEntry.freigegebeneFelder.length,
                                      })
                                    : t('dashboard.sharedVideoOnly', { team: tEntry.teamName })
                                )
                                .join(', ')}
                            </span>
                          )}

                          {aktiveLinks > 0 && istCoach && (
                            <span className="inline-flex items-center gap-1 text-[#8B949E]">
                              <Link2 className="h-3 w-3 text-[#F59E0B]" aria-hidden="true" />
                              {aktiveLinks} /share/-Link{aktiveLinks > 1 ? 's' : ''}
                            </span>
                          )}

                          {reel.receivedFromTeam && (
                            <span className="text-[#8B949E]">
                              {t('dashboard.receivedFrom', { team: reel.receivedFromTeam })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#232933] pt-3 xl:justify-end xl:border-t-0 xl:pt-0">
                      {istCoach ? (
                        <label className="flex items-center gap-2 text-xs text-[#8B949E]">
                          {istNurCoaches ? (
                            <Lock className="h-3.5 w-3.5 text-[#8B949E]" aria-hidden="true" />
                          ) : (
                            <Users className="h-3.5 w-3.5 text-[#4ADE80]" aria-hidden="true" />
                          )}
                          <span className="sr-only">
                            {t('dashboard.visibilityAria', { title: reel.title })}
                          </span>
                          <select
                            value={reel.visibility}
                            onChange={(e) =>
                              onFreigabeAendern(reel.id, e.target.value as SpielerFreigabe)
                            }
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium focus:border-[#F59E0B] focus:outline-none ${
                              istNurCoaches
                                ? 'border-[#232933] bg-[#0B0E11] text-[#8B949E]'
                                : 'border-[#16A34A]/40 bg-[#16A34A]/10 text-[#86EFAC]'
                            }`}
                          >
                            {FREIGABE_OPTIONEN.map((option) => (
                              <option
                                key={option}
                                value={option}
                                className="bg-[#13171D] text-[#E6EDF3]"
                              >
                                {t('dashboard.visibilityOption', {
                                  label: holeVideoFreigabeLabel(option, locale),
                                })}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#86EFAC]">
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('dashboard.visibilityPlayerBadge', {
                            label: holeVideoFreigabeLabel(reel.visibility, locale),
                          })}
                        </span>
                      )}

                      <div className="flex items-center gap-1.5">
                        {istCoach && (
                          <>
                            <button
                              type="button"
                              onClick={() => setTeilenReelId(reel.id)}
                              title={t('dashboard.shareBtnTitle')}
                              className="inline-flex items-center gap-1 rounded-md border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs font-medium text-[#E6EDF3] transition-colors hover:border-[#36404F] hover:text-white whitespace-nowrap"
                            >
                              <Share2 className="h-3.5 w-3.5 text-[#8B949E]" aria-hidden="true" />
                              {t('dashboard.shareBtn')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleJsonExport(reel)}
                              title={t('dashboard.jsonBtnTitle')}
                              className="inline-flex items-center gap-1 rounded-md border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs font-medium text-[#E6EDF3] transition-colors hover:border-[#36404F] hover:text-white whitespace-nowrap"
                            >
                              <Download
                                className="h-3.5 w-3.5 text-[#8B949E]"
                                aria-hidden="true"
                              />
                              JSON
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => onReelOeffnen(reel)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#232933] bg-[#1E2530] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#F59E0B] whitespace-nowrap"
                        >
                          <Play className="h-3 w-3 text-[#F59E0B]" aria-hidden="true" />
                          {t('dashboard.openBtn')}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {istCoach && (
          <UploadPanel
            teamId={teamId}
            saison={gewaehlteSaison === 'ALL' ? teamAktiveSaison : gewaehlteSaison}
            locale={locale}
            hervorgehoben={uploadHervorgehoben}
            onNeuesReelHinzufuegen={onNeuesReel}
          />
        )}
      </div>

      {teilenReel && (
        <TeamShareModal
          reel={teilenReel}
          locale={locale}
          tagSchema={tagSchema}
          onSchliessen={() => setTeilenReelId(null)}
          onTeamFreigabenAendern={onTeamFreigabenAendern}
          onShareLinksAendern={onShareLinksAendern}
          onShareVorschau={onShareVorschau}
        />
      )}
    </div>
  );
}
