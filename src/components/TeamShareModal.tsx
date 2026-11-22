import { useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Plus,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  BreakdownFeldKey,
  ShareDownloadLink,
  TagFeldKonfig,
  TeamFreigabeEintrag,
  VideoReel,
} from '../types.ts';
import { BASIS_TAGGING_FELDER } from '../types.ts';
import { VERFUEGBARE_TAUSCH_TEAMS } from '../data/demoReels.ts';
import {
  exportiereBreakdownAlsCsv,
  filtereBundleFuerFreigabe,
  generiereShareLinkPfad,
  istShareLinkGueltig,
} from '../services/bundleSchema.ts';
import { createVideoTranslator } from '../i18n.ts';

interface TeamShareModalProps {
  reel: VideoReel;
  tagSchema: TagFeldKonfig[];
  locale?: string;
  onSchliessen: () => void;
  onTeamFreigabenAendern: (reelId: string, freigaben: TeamFreigabeEintrag[]) => void;
  onShareLinksAendern: (reelId: string, links: ShareDownloadLink[]) => void;
  onShareVorschau?: (token: string) => void;
}

type ShareTab = 'teams' | 'links';
type AblaufPreset = '24h' | '7d' | '14d' | '30d' | 'custom';

function berechneAblaufIso(preset: AblaufPreset, eigenesDatum: string): string {
  const jetzt = new Date();
  if (preset === 'custom' && eigenesDatum) {
    return `${eigenesDatum}T23:59:59.000Z`;
  }
  const stunden =
    preset === '24h' ? 24 : preset === '7d' ? 24 * 7 : preset === '14d' ? 24 * 14 : 24 * 30;
  return new Date(jetzt.getTime() + stunden * 3600 * 1000).toISOString();
}

function formatiereAblaufDatum(iso: string, locale?: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return iso;
  return datum.toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TaggingFeldAuswahl({
  felder,
  ausgewaehlt,
  locale,
  onAendern,
}: {
  felder: TagFeldKonfig[];
  ausgewaehlt: BreakdownFeldKey[];
  locale?: string;
  onAendern: (felder: BreakdownFeldKey[]) => void;
}) {
  const t = createVideoTranslator(locale);
  const alleKeys = felder.map((f) => f.key);
  const basisKeys = BASIS_TAGGING_FELDER.filter((k) => alleKeys.includes(k));

  const toggleFeld = (key: BreakdownFeldKey) => {
    const neu = ausgewaehlt.includes(key)
      ? ausgewaehlt.filter((f) => f !== key)
      : [...ausgewaehlt, key];
    onAendern(neu);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#8B949E]">
          {t('shareModal.selectedFields', { selected: ausgewaehlt.length, total: felder.length })}
        </span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => onAendern([])}
            className="rounded border border-[#232933] px-2 py-0.5 text-[#8B949E] hover:border-[#36404F] hover:text-white"
          >
            {t('shareModal.presetVideoOnly')}
          </button>
          <button
            type="button"
            onClick={() => onAendern([...basisKeys])}
            className="rounded border border-[#232933] px-2 py-0.5 text-[#8B949E] hover:border-[#36404F] hover:text-white"
          >
            {t('shareModal.presetBasic')}
          </button>
          <button
            type="button"
            onClick={() => onAendern([...alleKeys])}
            className="rounded border border-[#232933] px-2 py-0.5 text-[#8B949E] hover:border-[#36404F] hover:text-white"
          >
            {t('shareModal.presetAll')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {felder.map((feld) => {
          const aktiv = ausgewaehlt.includes(feld.key);
          return (
            <button
              key={feld.key}
              type="button"
              onClick={() => toggleFeld(feld.key)}
              className={`flex items-center justify-between rounded border px-2 py-1 text-left text-[11px] transition-colors ${
                aktiv
                  ? 'border-[#F59E0B]/60 bg-[#F59E0B]/10 text-white'
                  : 'border-[#232933] bg-[#0B0E11] text-[#8B949E] hover:border-[#36404F] hover:text-[#E6EDF3]'
              }`}
            >
              <span className="truncate">{feld.kurz}</span>
              {aktiv && <Check className="h-3 w-3 shrink-0 text-[#F59E0B]" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TeamShareModal({
  reel,
  tagSchema,
  locale,
  onSchliessen,
  onTeamFreigabenAendern,
  onShareLinksAendern,
  onShareVorschau,
}: TeamShareModalProps) {
  const t = createVideoTranslator(locale);
  const aktiveFelder = tagSchema.filter((f) => f.aktiv);
  const [aktiverTab, setAktiverTab] = useState<ShareTab>('teams');
  const [aufgeklapptesTeam, setAufgeklapptesTeam] = useState<string | null>(
    reel.teamFreigaben[0]?.teamName ?? null
  );

  // State für neuen /share/ Link
  const [linkName, setLinkName] = useState('');
  const [ablaufPreset, setAblaufPreset] = useState<AblaufPreset>('7d');
  const [eigenesAblaufDatum, setEigenesAblaufDatum] = useState(() => {
    const in14Tagen = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    return in14Tagen.toISOString().slice(0, 10);
  });
  const [linkFelder, setLinkFelder] = useState<BreakdownFeldKey[]>([...BASIS_TAGGING_FELDER]);
  const [kopiertLinkId, setKopiertLinkId] = useState<string | null>(null);

  const basisOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://sideline.local';

  const toggleTeam = (teamName: string) => {
    const existiert = reel.teamFreigaben.some((t) => t.teamName === teamName);
    if (existiert) {
      onTeamFreigabenAendern(
        reel.id,
        reel.teamFreigaben.filter((t) => t.teamName !== teamName)
      );
      if (aufgeklapptesTeam === teamName) setAufgeklapptesTeam(null);
    } else {
      const neu: TeamFreigabeEintrag = {
        teamName,
        freigegebeneFelder: [],
        geteiltAm: new Date().toISOString().slice(0, 10),
      };
      onTeamFreigabenAendern(reel.id, [...reel.teamFreigaben, neu]);
      setAufgeklapptesTeam(teamName);
    }
  };

  const aktualisiereTeamFelder = (teamName: string, felder: BreakdownFeldKey[]) => {
    onTeamFreigabenAendern(
      reel.id,
      reel.teamFreigaben.map((eintrag) =>
        eintrag.teamName === teamName ? { ...eintrag, freigegebeneFelder: felder } : eintrag
      )
    );
  };

  const handleLinkErstellen = () => {
    const { token, pfad } = generiereShareLinkPfad();
    const neuerLink: ShareDownloadLink = {
      id: `link-${Date.now()}`,
      token,
      pfad,
      bezeichnung: linkName.trim() || `Download-Link (${reel.title})`,
      erstelltAm: new Date().toISOString(),
      gueltigBis: berechneAblaufIso(ablaufPreset, eigenesAblaufDatum),
      freigegebeneFelder: [...linkFelder],
      aktiv: true,
    };
    onShareLinksAendern(reel.id, [neuerLink, ...reel.shareLinks]);
    setLinkName('');
  };

  const handleLinkWiderrufen = (linkId: string) => {
    onShareLinksAendern(
      reel.id,
      reel.shareLinks.filter((l) => l.id !== linkId)
    );
  };

  const handleKopieren = async (link: ShareDownloadLink) => {
    const vollUrl = `${basisOrigin}${link.pfad}`;
    try {
      await navigator.clipboard.writeText(vollUrl);
    } catch {
      // Fallback für restriktive iFrame-Umgebungen
    }
    setKopiertLinkId(link.id);
    setTimeout(() => setKopiertLinkId((alt) => (alt === link.id ? null : alt)), 1800);
  };

  const handleGefiltertenDownload = (
    dateiPraefix: string,
    felder: BreakdownFeldKey[],
    format: 'json' | 'csv'
  ) => {
    const inhalt =
      format === 'json'
        ? JSON.stringify(filtereBundleFuerFreigabe(reel, felder), null, 2)
        : exportiereBreakdownAlsCsv(reel.plays, felder, tagSchema);
    const mime = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
    const blob = new Blob([inhalt], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dateiPraefix}.${format === 'json' ? 'sideline.json' : 'csv'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-share-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-[#232933] bg-[#13171D]">
        {/* Kopfbereich */}
        <div className="flex items-start justify-between gap-4 border-b border-[#232933] px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
              <h2 id="team-share-title" className="text-base font-semibold text-white">
                {t('shareModal.title')}
              </h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-[#8B949E]">{reel.title}</p>
          </div>
          <button
            type="button"
            onClick={onSchliessen}
            aria-label={t('shareModal.closeAria')}
            className="rounded p-1 text-[#8B949E] transition-colors hover:bg-[#1E2530] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modus-Tabs */}
        <div className="flex items-center gap-1 border-b border-[#232933] bg-[#0F1318] px-6 py-2.5">
          <button
            type="button"
            onClick={() => setAktiverTab('teams')}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              aktiverTab === 'teams'
                ? 'bg-[#232933] text-white'
                : 'text-[#8B949E] hover:text-[#E6EDF3]'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {t('shareModal.tabTeams', { count: reel.teamFreigaben.length })}
          </button>
          <button
            type="button"
            onClick={() => setAktiverTab('links')}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              aktiverTab === 'links'
                ? 'bg-[#232933] text-white'
                : 'text-[#8B949E] hover:text-[#E6EDF3]'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('shareModal.tabLinks', { count: reel.shareLinks.length })}
          </button>
        </div>

        {/* Scrollbarer Inhalt */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-xs leading-relaxed text-[#8B949E]">
            {t('shareModal.hint')}
          </p>

          {aktiverTab === 'teams' ? (
            <div className="space-y-2.5">
              {VERFUEGBARE_TAUSCH_TEAMS.map((teamName) => {
                const freigabe = reel.teamFreigaben.find((t) => t.teamName === teamName);
                const aktiv = Boolean(freigabe);
                const offen = aufgeklapptesTeam === teamName && aktiv;

                return (
                  <div
                    key={teamName}
                    className={`rounded-md border transition-colors ${
                      aktiv
                        ? 'border-[#F59E0B]/50 bg-[#0B0E11]'
                        : 'border-[#232933] bg-[#0B0E11]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleTeam(teamName)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            aktiv
                              ? 'border-[#F59E0B] bg-[#F59E0B] text-[#0B0E11]'
                              : 'border-[#36404F] bg-transparent'
                          }`}
                        >
                          {aktiv && <Check className="h-3 w-3" aria-hidden="true" />}
                        </span>
                        <span className="text-sm font-medium text-[#E6EDF3]">{teamName}</span>
                      </button>

                      {aktiv && freigabe && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[#8B949E]">
                            {freigabe.freigegebeneFelder.length === 0
                              ? t('shareModal.onlyVideo')
                              : t('shareModal.tagColumnsCount', {
                                  count: freigabe.freigegebeneFelder.length,
                                })}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAufgeklapptesTeam(offen ? null : teamName)
                            }
                            className="rounded border border-[#232933] px-2 py-1 text-[11px] text-[#E6EDF3] hover:border-[#F59E0B]"
                          >
                            {offen ? t('shareModal.closePanel') : t('shareModal.selectTagging')}
                          </button>
                        </div>
                      )}
                    </div>

                    {offen && freigabe && (
                      <div className="border-t border-[#232933] bg-[#13171D]/60 px-3.5 py-3">
                        <TaggingFeldAuswahl
                          felder={aktiveFelder}
                          ausgewaehlt={freigabe.freigegebeneFelder}
                          locale={locale}
                          onAendern={(felder) => aktualisiereTeamFelder(teamName, felder)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Neuen /share/ Download-Link anlegen */}
              <div className="space-y-4 rounded-md border border-[#232933] bg-[#0B0E11] p-4">
                <div className="text-xs font-semibold text-white">
                  {t('shareModal.newLinkTitle')}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-[#8B949E]">
                    <span>{t('shareModal.linkLabel')}</span>
                    <input
                      type="text"
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      placeholder={t('shareModal.linkPlaceholder')}
                      className="w-full rounded border border-[#232933] bg-[#13171D] px-2.5 py-1.5 text-xs text-white placeholder-[#6E7681] focus:border-[#F59E0B] focus:outline-none"
                    />
                  </label>

                  <label className="space-y-1 text-xs text-[#8B949E]">
                    <span>{t('shareModal.expiryLabel')}</span>
                    <div className="flex gap-2">
                      <select
                        value={ablaufPreset}
                        onChange={(e) => setAblaufPreset(e.target.value as AblaufPreset)}
                        className="flex-1 rounded border border-[#232933] bg-[#13171D] px-2.5 py-1.5 text-xs text-white focus:border-[#F59E0B] focus:outline-none"
                      >
                        <option value="24h">{t('shareModal.expiry24h')}</option>
                        <option value="7d">{t('shareModal.expiry7d')}</option>
                        <option value="14d">{t('shareModal.expiry14d')}</option>
                        <option value="30d">{t('shareModal.expiry30d')}</option>
                        <option value="custom">{t('shareModal.expiryCustom')}</option>
                      </select>
                      {ablaufPreset === 'custom' && (
                        <input
                          type="date"
                          value={eigenesAblaufDatum}
                          onChange={(e) => setEigenesAblaufDatum(e.target.value)}
                          className="rounded border border-[#232933] bg-[#13171D] px-2 py-1.5 font-mono text-xs text-white focus:border-[#F59E0B] focus:outline-none"
                        />
                      )}
                    </div>
                  </label>
                </div>

                <TaggingFeldAuswahl
                  felder={aktiveFelder}
                  ausgewaehlt={linkFelder}
                  locale={locale}
                  onAendern={setLinkFelder}
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleLinkErstellen}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#F59E0B] px-3.5 py-1.5 text-xs font-semibold text-[#0B0E11] transition-colors hover:bg-[#FBBF24]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('shareModal.createLink')}
                  </button>
                </div>
              </div>

              {/* Bestehende Links */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-[#8B949E]">
                  {t('shareModal.existingLinks')}
                </h3>
                {reel.shareLinks.length === 0 ? (
                  <p className="rounded border border-[#232933] bg-[#0B0E11] px-4 py-6 text-center text-xs text-[#8B949E]">
                    {t('shareModal.noLinks')}
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {reel.shareLinks.map((link) => {
                      const gueltig = istShareLinkGueltig(link);
                      return (
                        <li
                          key={link.id}
                          className="rounded-md border border-[#232933] bg-[#0B0E11] p-3.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-white">{link.bezeichnung}</span>
                                <span
                                  className={`font-mono text-[11px] ${
                                    gueltig ? 'text-[#4ADE80]' : 'text-[#FCA5A5]'
                                  }`}
                                >
                                  {gueltig ? t('shareModal.statusActive') : t('shareModal.statusExpired')}
                                </span>
                              </div>
                              <div className="truncate font-mono text-xs text-[#F59E0B]">
                                {basisOrigin}
                                {link.pfad}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8B949E]">
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  {t('shareModal.validUntil', {
                                    date: formatiereAblaufDatum(link.gueltigBis, locale),
                                  })}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {link.freigegebeneFelder.length === 0
                                    ? t('shareModal.noTagsInfo')
                                    : t('shareModal.tagsList', {
                                        tags: link.freigegebeneFelder.join(', '),
                                      })}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {onShareVorschau && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSchliessen();
                                    onShareVorschau(link.token);
                                  }}
                                  title={t('shareModal.openShareTitle')}
                                  className="inline-flex items-center gap-1 rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-1 text-[11px] font-medium text-[#F59E0B] hover:bg-[#F59E0B]/20"
                                >
                                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                  {t('shareModal.openBtn')}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleKopieren(link)}
                                className="inline-flex items-center gap-1 rounded border border-[#232933] bg-[#13171D] px-2.5 py-1 text-[11px] text-[#E6EDF3] hover:border-[#F59E0B]"
                              >
                                <Copy className="h-3 w-3" aria-hidden="true" />
                                {kopiertLinkId === link.id
                                  ? t('shareModal.copied')
                                  : t('shareModal.copy')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleGefiltertenDownload(
                                    link.token,
                                    link.freigegebeneFelder,
                                    'json'
                                  )
                                }
                                title={t('shareModal.testJson')}
                                className="inline-flex items-center gap-1 rounded border border-[#232933] bg-[#13171D] px-2 py-1 text-[11px] text-[#8B949E] hover:border-[#36404F] hover:text-white"
                              >
                                <Download className="h-3 w-3" aria-hidden="true" />
                                JSON
                              </button>
                              {link.freigegebeneFelder.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleGefiltertenDownload(
                                      link.token,
                                      link.freigegebeneFelder,
                                      'csv'
                                    )
                                  }
                                  title={t('shareModal.testCsv')}
                                  className="inline-flex items-center gap-1 rounded border border-[#232933] bg-[#13171D] px-2 py-1 text-[11px] text-[#8B949E] hover:border-[#36404F] hover:text-white"
                                >
                                  <Download className="h-3 w-3" aria-hidden="true" />
                                  CSV
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleLinkWiderrufen(link.id)}
                                aria-label={t('shareModal.revokeAria', { name: link.bezeichnung })}
                                className="rounded border border-[#DC2626]/30 bg-[#DC2626]/10 p-1 text-[#FCA5A5] hover:bg-[#DC2626]/20"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#232933] px-6 py-3.5">
          <button
            type="button"
            onClick={onSchliessen}
            className="rounded-md bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-[#0B0E11] transition-colors hover:bg-[#FBBF24]"
          >
            {t('shareModal.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
