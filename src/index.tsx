import type { PluginLaufzeitKontext, PluginTab, SidelinePlugin } from '../../sdk/plugin.ts';
import type { VideoModulTab } from './types.ts';
import { VIDEO_PLUGIN_MANIFEST } from './manifest.ts';
import { createVideoTranslator } from './i18n.ts';
import { VideoAnalysisProvider, useVideoAnalysis } from './VideoAnalysisContext.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { FilmRoomView } from './components/FilmRoomView.tsx';
import { PublicShareView } from './components/PublicShareView.tsx';
import { VideoCutSyncPlaceholder } from './components/VideoCutSyncPlaceholder.tsx';
import {
  VideoSysadminSettingsPanel,
  VideoTeamSettingsPanel,
  VideoUserSettingsPanel,
} from './components/VideoSettingsPanels.tsx';

function VideoAnalysisMainView({ ctx }: { ctx: PluginLaufzeitKontext }) {
  const video = useVideoAnalysis();
  const aktiverTab = (ctx.aktuellerTab || 'dashboard') as VideoModulTab;
  const aktivesReel = video.ermittleAusgewaehltesReel(
    ctx.team.id,
    ctx.gewaehlteSaison,
    ctx.aktiveTeamAnsicht
  );

  if (aktiverTab === 'film-room' && aktivesReel) {
    return (
      <FilmRoomView
        key={aktivesReel.id}
        reel={aktivesReel}
        teamRolle={ctx.aktiveTeamAnsicht}
        locale={ctx.locale}
        tagSchema={video.tagSchema}
        nutzerEinstellungen={video.nutzerEinstellungen}
        onZurueck={() => ctx.onTabWechseln('dashboard')}
        onSchemaSettingsOeffnen={ctx.onTeamSettingsOeffnen}
        onFreigabeAendern={video.onFreigabeAendern}
        onFeldAendern={video.onFeldAendern}
        onDefinitionLernen={video.onDefinitionLernen}
        onNotizHinzufuegen={video.onNotizHinzufuegen}
        onNotizBearbeiten={video.onNotizBearbeiten}
        onNotizLoeschen={video.onNotizLoeschen}
        onZeichnungHinzufuegen={video.onZeichnungHinzufuegen}
        onZeichnungAktualisieren={video.onZeichnungAktualisieren}
        onZeichnungEntfernen={video.onZeichnungEntfernen}
        onLetzteZeichnungEntfernen={video.onLetzteZeichnungEntfernen}
        onAlleZeichnungenLeeren={video.onAlleZeichnungenLeeren}
        onSessionVeroeffentlichen={video.onSessionVeroeffentlichen}
      />
    );
  }

  if (aktiverTab === 'cut-sync' || aktiverTab === 'playlists') {
    return (
      <VideoCutSyncPlaceholder
        ansicht={aktiverTab}
        locale={ctx.locale}
        ausgewaehltesReel={aktivesReel}
        onZurueckZumDashboard={() => ctx.onTabWechseln('dashboard')}
      />
    );
  }

  return (
    <DashboardView
      teamId={ctx.team.id}
      gewaehlteSaison={ctx.gewaehlteSaison}
      teamAktiveSaison={ctx.team.aktiveSaison}
      teamRolle={ctx.aktiveTeamAnsicht}
      locale={ctx.locale}
      tagSchema={video.tagSchema}
      reels={video.reels}
      uploadHervorgehoben={video.uploadHervorgehoben}
      onNeuesReel={video.onNeuesReel}
      onFreigabeAendern={video.onFreigabeAendern}
      onTeamFreigabenAendern={video.onTeamFreigabenAendern}
      onShareLinksAendern={video.onShareLinksAendern}
      onReelOeffnen={(reel) => {
        video.setAusgewaehltesReelId(reel.id);
        ctx.onTabWechseln('film-room');
      }}
      onShareVorschau={ctx.onPublicShareOeffnen}
    />
  );
}

function VideoPrimaerAktionButton({
  ctx,
  className,
}: {
  ctx: PluginLaufzeitKontext;
  className: string;
}) {
  const video = useVideoAnalysis();
  const t = createVideoTranslator(ctx.locale);
  const istCoach = ctx.aktiveTeamAnsicht === 'COACH' || ctx.aktiveTeamAnsicht === 'TEAM_ADMIN';

  return (
    <button
      type="button"
      onClick={() => {
        if (istCoach) {
          ctx.onTabWechseln('dashboard');
          video.highlightUpload();
        } else {
          ctx.onTabWechseln('film-room');
        }
      }}
      className={className}
    >
      {istCoach ? t('primaryAction.upload') : t('primaryAction.openFilmRoom')}
    </button>
  );
}

/**
 * Eigenständiges Videoanalyse-Plugin gemäß `@sidelineos/plugin-sdk`.
 * Kann unverändert in ein eigenes GitHub-Repository (`sidelineos-plugin-video`) extrahiert werden.
 */
export const videoAnalysisPlugin: SidelinePlugin = {
  manifest: VIDEO_PLUGIN_MANIFEST,
  Provider: VideoAnalysisProvider,
  defaultTab: 'dashboard',
  getTabs: ({ teamRolle, locale }) => {
    const t = createVideoTranslator(locale);
    const istCoach = teamRolle === 'COACH' || teamRolle === 'TEAM_ADMIN';
    const tabs: PluginTab[] = [{ id: 'dashboard', label: t('tab.dashboard') }];
    if (istCoach) {
      tabs.push({ id: 'cut-sync', label: t('tab.cutSync') });
    }
    tabs.push({ id: 'film-room', label: t('tab.filmRoom') });
    tabs.push({ id: 'playlists', label: t('tab.playlists') });
    return tabs;
  },
  PrimaerAktion: VideoPrimaerAktionButton,
  renderMainView: (ctx) => <VideoAnalysisMainView ctx={ctx} />,
  renderPublicShareView: ({ token, locale, onSchliessen }) => (
    <PublicShareView token={token} locale={locale} onSchliessen={onSchliessen} />
  ),
  settingsPanels: {
    user: VideoUserSettingsPanel,
    team: VideoTeamSettingsPanel,
    sysadmin: VideoSysadminSettingsPanel,
  },
};
