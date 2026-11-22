import type { PluginManifest } from '../../sdk/plugin.ts';

/**
 * Typisiertes Plugin-Manifest für das Videoanalyse-Modul.
 * Entspricht exakt der deklarativen `plugin.manifest.json` für die spätere Auslagerung in ein eigenes GitHub-Repo.
 */
export const VIDEO_PLUGIN_MANIFEST: PluginManifest = {
  id: 'video-analysis',
  name: 'Videoanalyse',
  kurzbeschreibung:
    'Multi-Angle Film Room, exakte Frame-Telestration, Hudl-kompatibles Breakdown-Tagging, Team-Sharing und JSON-Import.',
  version: '0.2.0',
  sdkVersion: '1.0',
  autor: 'SidelineOS Core Team',
  repositoryUrl: 'https://github.com/sidelineos/sidelineos-plugin-video',
  icon: 'film',
  status: 'AKTIV',
  standardAktiviert: true,
  permissions: [
    'team:read',
    's3:team-rw',
    's3:cleanup-queue',
    'db:plugin-tables',
    'share:public-links',
  ],
  dbPrefix: 'mod_video_',
  s3Prefix: 'plugins/video-analysis/',
  settingsAnker: {
    user: [
      { id: 'modul-video-hotkeys', label: 'Film-Room-Hotkeys' },
      { id: 'modul-video-player', label: 'Player-Voreinstellungen' },
    ],
    team: [{ id: 'modul-video-tagging', label: 'Tagging-Schema & Wörterbuch' }],
    sysadmin: [{ id: 'modul-video-cleanup', label: 'S3-Cleanup & Schonfrist' }],
  },
};
