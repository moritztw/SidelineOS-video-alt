import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  Upload,
} from 'lucide-react';
import type { VideoReel } from '../types.ts';
import { createVideoTranslator } from '../i18n.ts';
import {
  bundleZuReel,
  erstelleBeispielBundle,
  validiereUndParseBundle,
} from '../services/bundleSchema.ts';
import { THUMB_ENDZONE, THUMB_SIDELINE } from '../data/demoReels.ts';

interface UploadPanelProps {
  teamId: string;
  saison: string;
  locale?: string;
  hervorgehoben: boolean;
  onNeuesReelHinzufuegen: (reel: VideoReel) => void;
}

interface UploadProtokoll {
  id: string;
  titel: string;
  details: string;
  status: 'ok' | 'fehler';
}

export function UploadPanel({
  teamId,
  saison,
  locale,
  hervorgehoben,
  onNeuesReelHinzufuegen,
}: UploadPanelProps) {
  const t = createVideoTranslator(locale);
  const dateiInputRef = useRef<HTMLInputElement | null>(null);
  const [dragAktiv, setDragAktiv] = useState(false);
  const [fehlerListe, setFehlerListe] = useState<string[]>([]);
  const [hinweisListe, setHinweisListe] = useState<string[]>([]);
  const [protokoll, setProtokoll] = useState<UploadProtokoll[]>([
    {
      id: 'init-1',
      titel: 'vs. Berlin Rebels (Spieltag 9)',
      details: '142 Einzelclips · Sideline + Endzone',
      status: 'ok',
    },
  ]);

  const fuegeProtokollHinzu = (eintrag: UploadProtokoll) => {
    setProtokoll((alt) => [eintrag, ...alt].slice(0, 5));
  };

  const verarbeiteDateien = async (dateien: FileList | null) => {
    if (!dateien || dateien.length === 0) return;

    setFehlerListe([]);
    setHinweisListe([]);

    const dateiListe = Array.from(dateien);
    const jsonDatei = dateiListe.find((d) => d.name.toLowerCase().endsWith('.json'));
    const videoDateien = dateiListe.filter((d) =>
      /\.(mp4|mov|mkv|webm)$/i.test(d.name)
    );

    if (jsonDatei) {
      try {
        const inhalt = await jsonDatei.text();
        const ergebnis = validiereUndParseBundle(inhalt);
        if (!ergebnis.ok || !ergebnis.bundle) {
          setFehlerListe(ergebnis.fehler);
          fuegeProtokollHinzu({
            id: `err-${Date.now()}`,
            titel: jsonDatei.name,
            details: t('upload.validationErrors', { count: ergebnis.fehler.length }),
            status: 'fehler',
          });
          return;
        }

        const neuesReel: VideoReel = {
          ...bundleZuReel(ergebnis.bundle, teamId, THUMB_SIDELINE),
          saison,
        };
        onNeuesReelHinzufuegen(neuesReel);
        setHinweisListe([
          t('upload.bundleImported', {
            title: neuesReel.title,
            plays: neuesReel.playCount,
            tagged: neuesReel.taggedCount,
          }),
          ...ergebnis.hinweise,
        ]);
        fuegeProtokollHinzu({
          id: neuesReel.id,
          titel: neuesReel.title,
          details: t('upload.bundleLog', { count: neuesReel.playCount }),
          status: 'ok',
        });
      } catch {
        setFehlerListe([t('upload.errJsonRead')]);
      }
      return;
    }

    if (videoDateien.length > 0) {
      const istEinzeldatei = videoDateien.length === 1;
      const basisName = videoDateien[0].name.replace(/\.[^/.]+$/, '');
      const neuesReel: VideoReel = {
        id: `reel-${Date.now()}`,
        teamId,
        saison,
        title: istEinzeldatei
          ? basisName
          : t('upload.clipUploadTitle', { count: videoDateien.length }),
        category: 'GAME',
        eventDate: new Date().toISOString().slice(0, 10),
        thumbnailUrl: istEinzeldatei ? THUMB_ENDZONE : THUMB_SIDELINE,
        angles: ['SIDELINE'],
        sourceMode: istEinzeldatei ? 'TIME_SLICE' : 'CLIP_FILE',
        playCount: istEinzeldatei ? 0 : videoDateien.length,
        taggedCount: 0,
        visibility: 'COACHES_ONLY',
        teamFreigaben: [],
        shareLinks: [],
        draftNoteCount: 0,
        plays: istEinzeldatei
          ? []
          : videoDateien.map((datei, idx) => ({
              play_number: idx + 1,
              sources: {
                SIDELINE: {
                  file: datei.name,
                  source_mode: 'CLIP_FILE',
                  start_ms: 0,
                  end_ms: 8000,
                },
              },
            })),
      };

      onNeuesReelHinzufuegen(neuesReel);
      setHinweisListe([
        istEinzeldatei
          ? t('upload.msgTimeSliceCreated')
          : t('upload.msgClipsCreated', { count: videoDateien.length }),
      ]);
      fuegeProtokollHinzu({
        id: neuesReel.id,
        titel: neuesReel.title,
        details: istEinzeldatei
          ? t('upload.logTimeSlice')
          : t('upload.logClips', { count: videoDateien.length }),
        status: 'ok',
      });
      return;
    }

    setFehlerListe([t('upload.errUnsupportedFiles')]);
  };

  const handleBeispielImport = () => {
    setFehlerListe([]);
    const beispiel = erstelleBeispielBundle();
    const validiert = validiereUndParseBundle(JSON.stringify(beispiel));
    if (!validiert.ok || !validiert.bundle) {
      setFehlerListe(validiert.fehler);
      return;
    }
    const reel: VideoReel = {
      ...bundleZuReel(validiert.bundle, teamId, THUMB_SIDELINE),
      saison,
    };
    onNeuesReelHinzufuegen(reel);
    setHinweisListe([
      t('upload.demoImported', { title: reel.title, count: reel.playCount }),
      ...validiert.hinweise,
    ]);
    fuegeProtokollHinzu({
      id: reel.id,
      titel: reel.title,
      details: `${reel.playCount} Plays · JSON v1.0`,
      status: 'ok',
    });
  };

  const handleVorlageDownload = () => {
    const beispiel = erstelleBeispielBundle();
    const blob = new Blob([JSON.stringify(beispiel, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sideline-bundle.example.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      id="upload-panel"
      className={`rounded-lg border bg-[#13171D] p-5 transition-colors ${
        hervorgehoben ? 'border-[#F59E0B]' : 'border-[#232933]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{t('upload.title')}</h2>
        <span className="font-mono text-[11px] text-[#8B949E]">v1.0</span>
      </div>
      <p className="mt-1 text-xs text-[#8B949E]">
        {t('upload.subtitleBefore')}
        <span className="font-mono text-[#E6EDF3]">sideline-bundle.json</span>
        {t('upload.subtitleAfter')}
      </p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragAktiv(true);
        }}
        onDragLeave={() => setDragAktiv(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragAktiv(false);
          void verarbeiteDateien(e.dataTransfer.files);
        }}
        onClick={() => dateiInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dateiInputRef.current?.click();
          }
        }}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-7 text-center transition-colors focus-visible:outline-2 focus-visible:outline-[#F59E0B] ${
          dragAktiv
            ? 'border-[#F59E0B] bg-[#F59E0B]/10'
            : 'border-[#303846] bg-[#0B0E11] hover:border-[#4B5563]'
        }`}
      >
        <Upload className="h-5 w-5 text-[#8B949E]" aria-hidden="true" />
        <span className="mt-2.5 text-sm font-medium text-[#E6EDF3]">{t('upload.dropTitle')}</span>
        <span className="mt-1 text-xs text-[#8B949E]">{t('upload.dropHint')}</span>
        <input
          ref={dateiInputRef}
          type="file"
          multiple
          accept=".json,.mp4,.mov,.mkv,.webm,application/json,video/*"
          onChange={(e) => {
            void verarbeiteDateien(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {/* Schnellaktionen für JSON-Bundle-Test */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <button
          type="button"
          onClick={handleBeispielImport}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-[#232933] bg-[#0B0E11] px-3 py-2 text-xs font-medium text-[#E6EDF3] transition-colors hover:border-[#F59E0B] hover:text-white"
        >
          <FileJson className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
          {t('upload.importDemo')}
        </button>
        <button
          type="button"
          onClick={handleVorlageDownload}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-[#232933] bg-transparent px-3 py-2 text-xs font-medium text-[#8B949E] transition-colors hover:border-[#36404F] hover:text-[#E6EDF3]"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {t('upload.downloadTemplate')}
        </button>
      </div>

      {/* Validierungs-Rückmeldung */}
      {fehlerListe.length > 0 && (
        <div
          role="alert"
          className="mt-4 space-y-1 rounded-md border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-xs text-[#FCA5A5]"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('upload.rejected')}
          </div>
          <ul className="list-disc space-y-0.5 pl-4">
            {fehlerListe.map((meldung, idx) => (
              <li key={idx}>{meldung}</li>
            ))}
          </ul>
        </div>
      )}

      {hinweisListe.length > 0 && (
        <div
          role="status"
          className="mt-4 space-y-1 rounded-md border border-[#16A34A]/35 bg-[#16A34A]/10 p-3 text-xs text-[#86EFAC]"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('upload.succeeded')}
          </div>
          <ul className="space-y-0.5">
            {hinweisListe.map((hinweis, idx) => (
              <li key={idx}>{hinweis}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Letzte Uploads */}
      <div className="mt-5 border-t border-[#232933] pt-4">
        <h3 className="text-xs font-medium text-[#8B949E]">{t('upload.recent')}</h3>
        <ul className="mt-2.5 space-y-2.5">
          {protokoll.map((eintrag) => (
            <li
              key={eintrag.id}
              className="flex items-start justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-[#E6EDF3]">{eintrag.titel}</div>
                <div className="text-[11px] text-[#8B949E]">{eintrag.details}</div>
              </div>
              <span
                className={`shrink-0 font-mono text-[11px] ${
                  eintrag.status === 'ok' ? 'text-[#4ADE80]' : 'text-[#FCA5A5]'
                }`}
              >
                {eintrag.status === 'ok' ? t('upload.statusOk') : t('upload.statusError')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
