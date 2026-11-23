import { useMemo, useState } from 'react';
import type { TeamRolle } from '@sidelineos/plugin-sdk';
import { ArrowLeft, Download, Film, ListFilter, Plus, Save, Trash2, X } from 'lucide-react';
import type {
  BreakdownFeldKey,
  FilterOperator,
  PlaylistFilterRegel,
  PlaylistKombinator,
  SmartPlaylist,
  SpielerFreigabe,
  TagFeldKonfig,
  VideoReel,
} from '../types.ts';
import { createVideoTranslator } from '../i18n.ts';
import {
  STANDARD_PLAYLIST_VORLAGEN,
  berechnePlaylistStatistik,
  exportierePlaylistAlsCsv,
  filtereSmartPlaylistTreffer,
} from '../services/playlistEngine.ts';
import { leseBreakdownWert } from '../services/taggingEngine.ts';

interface SmartPlaylistsViewProps {
  teamId: string;
  gewaehlteSaison: string;
  teamRolle: TeamRolle;
  locale?: string;
  reels: VideoReel[];
  tagSchema: TagFeldKonfig[];
  gespeichertePlaylists: SmartPlaylist[];
  onPlaylistSpeichern: (playlist: SmartPlaylist) => void;
  onPlaylistLoeschen: (playlistId: string) => void;
  onImFilmRoomOeffnen: (reelId: string, playNumber: number) => void;
  onZurueckZumDashboard: () => void;
}

const OPERATOREN: FilterOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'gte',
  'lte',
  'in',
  'is_empty',
  'is_not_empty',
];

const FREIGABE_OPTIONEN: SpielerFreigabe[] = [
  'COACHES_ONLY',
  'ALL_PLAYERS',
  'UNIT_OFFENSE',
  'UNIT_DEFENSE',
  'UNIT_SPECIAL_TEAMS',
];

function erstelleLeereRegel(feldKey: BreakdownFeldKey): PlaylistFilterRegel {
  return {
    id: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    feldKey,
    operator: 'equals',
    wert: '',
  };
}

export function SmartPlaylistsView({
  teamId,
  gewaehlteSaison,
  teamRolle,
  locale,
  reels,
  tagSchema,
  gespeichertePlaylists,
  onPlaylistSpeichern,
  onPlaylistLoeschen,
  onImFilmRoomOeffnen,
  onZurueckZumDashboard,
}: SmartPlaylistsViewProps) {
  const t = createVideoTranslator(locale);
  const istCoach = teamRolle === 'COACH' || teamRolle === 'TEAM_ADMIN';
  const aktiveFelder = useMemo(() => tagSchema.filter((f) => f.aktiv), [tagSchema]);

  const sichtbarePlaylists = useMemo(
    () =>
      gespeichertePlaylists.filter(
        (p) =>
          p.teamId === teamId &&
          (teamRolle === 'PLAYER' ? p.sichtbarkeit !== 'COACHES_ONLY' : true)
      ),
    [gespeichertePlaylists, teamId, teamRolle]
  );

  const sichtbareVorlagen = useMemo(
    () =>
      STANDARD_PLAYLIST_VORLAGEN.filter((v) =>
        teamRolle === 'PLAYER' ? v.sichtbarkeit !== 'COACHES_ONLY' : true
      ),
    [teamRolle]
  );

  const [aktivePlaylistId, setAktivePlaylistId] = useState<string | null>(null);
  const [name, setName] = useState<string>(STANDARD_PLAYLIST_VORLAGEN[0].name);
  const [beschreibung, setBeschreibung] = useState<string>(
    STANDARD_PLAYLIST_VORLAGEN[0].beschreibung ?? ''
  );
  const [kombinator, setKombinator] = useState<PlaylistKombinator>('AND');
  const [regeln, setRegeln] = useState<PlaylistFilterRegel[]>(
    STANDARD_PLAYLIST_VORLAGEN[0].regeln
  );
  const [reelIds, setReelIds] = useState<string[]>([]);
  const [sichtbarkeit, setSichtbarkeit] = useState<SpielerFreigabe>('ALL_PLAYERS');
  const [speicherHinweis, setSpeicherHinweis] = useState<string | null>(null);

  const teamReels = useMemo(
    () =>
      reels.filter(
        (r) =>
          r.teamId === teamId &&
          (teamRolle === 'PLAYER' ? r.visibility !== 'COACHES_ONLY' : true)
      ),
    [reels, teamId, teamRolle]
  );

  const treffer = useMemo(
    () =>
      filtereSmartPlaylistTreffer(
        reels,
        {
          kombinator,
          regeln,
          reelIds: reelIds.length > 0 ? reelIds : undefined,
          sichtbarkeit,
        },
        tagSchema,
        { teamId, gewaehlteSaison, teamRolle }
      ),
    [reels, kombinator, regeln, reelIds, sichtbarkeit, tagSchema, teamId, gewaehlteSaison, teamRolle]
  );

  const stats = useMemo(() => berechnePlaylistStatistik(treffer), [treffer]);

  const ladeVorlage = (vorlage: {
    id?: string;
    name: string;
    beschreibung?: string;
    kombinator: PlaylistKombinator;
    regeln: PlaylistFilterRegel[];
    reelIds?: string[];
    sichtbarkeit: SpielerFreigabe;
  }, istGespeichert: boolean) => {
    setAktivePlaylistId(istGespeichert ? vorlage.id ?? null : null);
    setName(vorlage.name);
    setBeschreibung(vorlage.beschreibung ?? '');
    setKombinator(vorlage.kombinator);
    setRegeln(vorlage.regeln.map((r) => ({ ...r, werte: r.werte ? [...r.werte] : undefined })));
    setReelIds(vorlage.reelIds ?? []);
    setSichtbarkeit(vorlage.sichtbarkeit);
    setSpeicherHinweis(null);
  };

  const handleSpeichern = () => {
    if (!name.trim()) return;
    const id = aktivePlaylistId ?? `pl-${Date.now()}`;
    const playlist: SmartPlaylist = {
      id,
      teamId,
      saison: gewaehlteSaison !== 'ALL' ? gewaehlteSaison : undefined,
      name: name.trim(),
      beschreibung: beschreibung.trim() || undefined,
      kombinator,
      regeln,
      reelIds: reelIds.length > 0 ? reelIds : undefined,
      sichtbarkeit,
      erstelltAm: new Date().toISOString().slice(0, 10),
    };
    onPlaylistSpeichern(playlist);
    setAktivePlaylistId(id);
    setSpeicherHinweis(t('playlists.savedNotice', { name: playlist.name }));
  };

  const handleCsvExport = () => {
    const csv = exportierePlaylistAlsCsv(treffer, tagSchema);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    link.href = url;
    link.download = `${slug || 'smart-playlist'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
            {t('playlists.backToLibrary')}
          </button>
          <span className="text-[#232933]">|</span>
          <h1 className="text-base font-semibold text-white">{t('playlists.title')}</h1>
        </div>

        <button
          type="button"
          onClick={handleCsvExport}
          disabled={treffer.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#232933] bg-[#13171D] px-3 py-1.5 text-xs font-medium text-[#E6EDF3] hover:border-[#F59E0B] disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {t('playlists.exportCsv')}
        </button>
      </div>

      <p className="text-xs text-[#8B949E]">{t('playlists.subtitle')}</p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-[#232933] bg-[#13171D] p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#8B949E]">{t('playlists.presetsTitle')}</h2>
              {istCoach && (
                <button
                  type="button"
                  onClick={() =>
                    ladeVorlage(
                      {
                        name: 'Neue Cutup-Liste',
                        kombinator: 'AND',
                        regeln: [erstelleLeereRegel(aktiveFelder[0]?.key ?? 'odk')],
                        sichtbarkeit: 'ALL_PLAYERS',
                      },
                      false
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs text-[#F59E0B] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('playlists.newBtn')}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {sichtbareVorlagen.map((vorlage) => (
                <button
                  key={vorlage.id}
                  type="button"
                  onClick={() => ladeVorlage(vorlage, false)}
                  className="w-full rounded border border-[#232933] bg-[#0B0E11] px-3 py-2 text-left transition-colors hover:border-[#F59E0B]/60"
                >
                  <div className="text-xs font-medium text-white">{vorlage.name}</div>
                  {vorlage.beschreibung && (
                    <div className="mt-0.5 text-[11px] text-[#8B949E]">{vorlage.beschreibung}</div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#232933] bg-[#13171D] p-4">
            <h2 className="mb-2.5 text-xs font-semibold text-[#8B949E]">
              {t('playlists.savedTitle', { count: sichtbarePlaylists.length })}
            </h2>
            {sichtbarePlaylists.length === 0 ? (
              <p className="text-xs text-[#6E7681]">{t('playlists.noSaved')}</p>
            ) : (
              <div className="space-y-1.5">
                {sichtbarePlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    className={`flex items-center justify-between gap-2 rounded border px-3 py-2 ${
                      aktivePlaylistId === pl.id
                        ? 'border-[#F59E0B] bg-[#F59E0B]/10'
                        : 'border-[#232933] bg-[#0B0E11]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => ladeVorlage(pl, true)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-xs font-medium text-white">{pl.name}</div>
                      <div className="font-mono text-[11px] text-[#8B949E]">
                        {pl.regeln.length} · {t(`visibility.${pl.sichtbarkeit}`)}
                      </div>
                    </button>
                    {istCoach && (
                      <button
                        type="button"
                        onClick={() => {
                          onPlaylistLoeschen(pl.id);
                          if (aktivePlaylistId === pl.id) setAktivePlaylistId(null);
                        }}
                        aria-label={t('playlists.deleteBtn')}
                        className="p-1 text-[#8B949E] hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <div className="min-w-0 space-y-4">
          {istCoach && (
            <section className="space-y-4 rounded-lg border border-[#232933] bg-[#13171D] p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B949E]">
                    {t('playlists.nameLabel')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('playlists.namePlaceholder')}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white focus:border-[#F59E0B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B949E]">
                    {t('playlists.combinatorLabel')}
                  </label>
                  <select
                    value={kombinator}
                    onChange={(e) => setKombinator(e.target.value as PlaylistKombinator)}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="AND">{t('playlists.combinatorAnd')}</option>
                    <option value="OR">{t('playlists.combinatorOr')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B949E]">
                    {t('playlists.visibilityLabel')}
                  </label>
                  <select
                    value={sichtbarkeit}
                    onChange={(e) => setSichtbarkeit(e.target.value as SpielerFreigabe)}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white"
                  >
                    {FREIGABE_OPTIONEN.map((opt) => (
                      <option key={opt} value={opt}>
                        {t(`visibility.${opt}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B949E]">
                    {t('playlists.descLabel')}
                  </label>
                  <input
                    type="text"
                    value={beschreibung}
                    onChange={(e) => setBeschreibung(e.target.value)}
                    placeholder={t('playlists.descPlaceholder')}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white focus:border-[#F59E0B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B949E]">
                    {t('playlists.scopeLabel')}
                  </label>
                  <select
                    value={reelIds[0] ?? ''}
                    onChange={(e) => setReelIds(e.target.value ? [e.target.value] : [])}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">{t('playlists.scopeAll')}</option>
                    {teamReels.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#232933] pt-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
                    <ListFilter className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                    {t('playlists.rulesTitle', { count: regeln.length })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRegeln((alt) => [
                        ...alt,
                        erstelleLeereRegel(aktiveFelder[0]?.key ?? 'odk'),
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1 text-xs text-[#E6EDF3] hover:border-[#F59E0B]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('playlists.addRule')}
                  </button>
                </div>

                {regeln.map((regel) => {
                  const feldKonfig = aktiveFelder.find((f) => f.key === regel.feldKey);
                  const brauchtKeinWert =
                    regel.operator === 'is_empty' || regel.operator === 'is_not_empty';

                  return (
                    <div
                      key={regel.id}
                      className="grid grid-cols-1 gap-2 rounded border border-[#232933] bg-[#0B0E11] p-2 sm:grid-cols-[180px_150px_minmax(0,1fr)_auto]"
                    >
                      <select
                        value={String(regel.feldKey)}
                        onChange={(e) =>
                          setRegeln((alt) =>
                            alt.map((r) =>
                              r.id === regel.id
                                ? { ...r, feldKey: e.target.value, wert: '', werte: [] }
                                : r
                            )
                          )
                        }
                        className="rounded border border-[#232933] bg-[#13171D] px-2 py-1 text-xs text-white"
                      >
                        {aktiveFelder.map((f) => (
                          <option key={String(f.key)} value={String(f.key)}>
                            {f.kurz} · {f.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={regel.operator}
                        onChange={(e) =>
                          setRegeln((alt) =>
                            alt.map((r) =>
                              r.id === regel.id
                                ? { ...r, operator: e.target.value as FilterOperator }
                                : r
                            )
                          )
                        }
                        className="rounded border border-[#232933] bg-[#13171D] px-2 py-1 text-xs text-white"
                      >
                        {OPERATOREN.map((op) => (
                          <option key={op} value={op}>
                            {t(`playlists.op.${op}`)}
                          </option>
                        ))}
                      </select>

                      {brauchtKeinWert ? (
                        <div className="flex items-center px-2 text-xs text-[#6E7681]">—</div>
                      ) : regel.operator === 'in' ? (
                        <input
                          type="text"
                          value={(regel.werte ?? []).join(', ')}
                          onChange={(e) => {
                            const teile = e.target.value.split(',').map((s) => s.trim());
                            setRegeln((alt) =>
                              alt.map((r) => (r.id === regel.id ? { ...r, werte: teile } : r))
                            );
                          }}
                          placeholder={t('playlists.valuesCsvPlaceholder')}
                          className="rounded border border-[#232933] bg-[#13171D] px-2 py-1 text-xs text-white"
                        />
                      ) : feldKonfig?.definitionen &&
                        feldKonfig.definitionen.length > 0 &&
                        (regel.operator === 'equals' || regel.operator === 'not_equals') ? (
                        <select
                          value={String(regel.wert ?? '')}
                          onChange={(e) =>
                            setRegeln((alt) =>
                              alt.map((r) =>
                                r.id === regel.id ? { ...r, wert: e.target.value } : r
                              )
                            )
                          }
                          className="rounded border border-[#232933] bg-[#13171D] px-2 py-1 text-xs text-white"
                        >
                          <option value="">{t('playlists.valuePlaceholder')}</option>
                          {feldKonfig.definitionen.map((def) => (
                            <option key={def} value={def}>
                              {def}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={feldKonfig?.typ === 'number' ? 'number' : 'text'}
                          value={regel.wert ?? ''}
                          onChange={(e) => {
                            const val =
                              feldKonfig?.typ === 'number' && e.target.value !== ''
                                ? Number(e.target.value)
                                : e.target.value;
                            setRegeln((alt) =>
                              alt.map((r) => (r.id === regel.id ? { ...r, wert: val } : r))
                            );
                          }}
                          placeholder={t('playlists.valuePlaceholder')}
                          className="rounded border border-[#232933] bg-[#13171D] px-2 py-1 text-xs text-white"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => setRegeln((alt) => alt.filter((r) => r.id !== regel.id))}
                        aria-label={t('playlists.removeRuleAria')}
                        className="rounded p-1 text-[#8B949E] hover:text-red-400"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#232933] pt-3">
                {speicherHinweis ? (
                  <span className="text-xs text-emerald-400">{speicherHinweis}</span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={handleSpeichern}
                  disabled={!name.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#F59E0B] px-3.5 py-1.5 text-xs font-semibold text-[#0B0E11] hover:bg-[#D97706] disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('playlists.saveBtn')}
                </button>
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-md border border-[#232933] bg-[#13171D] p-3">
              <div className="text-[11px] text-[#8B949E]">{t('playlists.kpiPlays')}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                {stats.playCount}
              </div>
            </div>
            <div className="rounded-md border border-[#232933] bg-[#13171D] p-3">
              <div className="text-[11px] text-[#8B949E]">{t('playlists.kpiAvgGain')}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-[#F59E0B] tabular-nums">
                {stats.avgGain !== null ? `${stats.avgGain} Y` : '–'}
              </div>
            </div>
            <div className="rounded-md border border-[#232933] bg-[#13171D] p-3">
              <div className="text-[11px] text-[#8B949E]">{t('playlists.kpiRunPass')}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                {stats.runCount} / {stats.passCount}
              </div>
            </div>
            <div className="rounded-md border border-[#232933] bg-[#13171D] p-3">
              <div className="text-[11px] text-[#8B949E]">{t('playlists.kpiExplosive')}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                {stats.explosiveCount}
              </div>
            </div>
            <div className="rounded-md border border-[#232933] bg-[#13171D] p-3">
              <div className="text-[11px] text-[#8B949E]">{t('playlists.kpiTds')}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                {stats.tdCount}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#232933] bg-[#13171D] p-5">
            <h2 className="mb-3 text-xs font-semibold text-white">
              {t('playlists.resultsTitle', { count: treffer.length })}
            </h2>

            {treffer.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#8B949E]">{t('playlists.noResults')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#232933] text-[#8B949E]">
                      <th className="py-2 pr-3 font-medium">REEL</th>
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">ODK</th>
                      <th className="py-2 pr-3 font-medium">DN / DIST</th>
                      <th className="py-2 pr-3 font-medium">YD LN</th>
                      <th className="py-2 pr-3 font-medium">OFF FORM / PLAY</th>
                      <th className="py-2 pr-3 font-medium">GN/LS</th>
                      <th className="py-2 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232933]">
                    {treffer.map((eintrag) => {
                      const b = eintrag.play.breakdown;
                      const customTeile = aktiveFelder
                        .filter((f) => f.istCustom)
                        .map((f) => {
                          const w = leseBreakdownWert(b, f);
                          return w !== undefined && w !== '' ? `${f.kurz}: ${w}` : null;
                        })
                        .filter(Boolean);

                      return (
                        <tr key={`${eintrag.reelId}-${eintrag.play.play_number}`}>
                          <td className="py-2 pr-3 font-medium text-white">{eintrag.reelTitle}</td>
                          <td className="py-2 pr-3 font-mono text-[#E6EDF3] tabular-nums">
                            P-{String(eintrag.play.play_number).padStart(2, '0')}
                          </td>
                          <td className="py-2 pr-3 font-mono text-[#E6EDF3]">{b?.odk ?? '–'}</td>
                          <td className="py-2 pr-3 font-mono text-[#E6EDF3] tabular-nums">
                            {b?.down ?? '–'} &amp; {b?.distance ?? '–'}
                          </td>
                          <td className="py-2 pr-3 font-mono text-[#E6EDF3] tabular-nums">
                            {b?.yard_line ?? '–'}
                          </td>
                          <td className="py-2 pr-3 text-[#E6EDF3]">
                            {[b?.off_form, b?.off_play, ...customTeile]
                              .filter(Boolean)
                              .join(' · ') || '–'}
                          </td>
                          <td className="py-2 pr-3 font-mono text-[#F59E0B] tabular-nums">
                            {b?.gn_ls !== undefined ? b.gn_ls : '–'}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                onImFilmRoomOeffnen(eintrag.reelId, eintrag.play.play_number)
                              }
                              className="inline-flex items-center gap-1 rounded border border-[#232933] px-2.5 py-1 text-[11px] text-white hover:border-[#F59E0B]"
                            >
                              <Film className="h-3 w-3 text-[#F59E0B]" aria-hidden="true" />
                              {t('playlists.openPlay')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
