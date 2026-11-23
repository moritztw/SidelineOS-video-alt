import { Download } from 'lucide-react';
import type { TeamRolle } from '@sidelineos/plugin-sdk';
import type {
  BreakdownFeldKey,
  Spielzug,
  TagFeldKonfig,
} from '../types.ts';
import { exportiereBreakdownAlsCsv } from '../services/bundleSchema.ts';
import { leseBreakdownWert } from '../services/taggingEngine.ts';
import { createVideoTranslator } from '../i18n.ts';

interface BreakdownGridProps {
  reelTitel: string;
  plays: Spielzug[];
  aktiverPlayIndex: number;
  teamRolle: TeamRolle;
  tagSchema: TagFeldKonfig[];
  locale?: string;
  onPlayWaehlen: (index: number) => void;
  onFeldAendern: (
    playNumber: number,
    feldKey: BreakdownFeldKey,
    wert: string | number | undefined,
    istCustom: boolean
  ) => void;
  onDefinitionLernen: (feldKey: BreakdownFeldKey, wert: string) => void;
}

export function BreakdownGrid({
  reelTitel,
  plays,
  aktiverPlayIndex,
  teamRolle,
  tagSchema,
  locale,
  onPlayWaehlen,
  onFeldAendern,
  onDefinitionLernen,
}: BreakdownGridProps) {
  const t = createVideoTranslator(locale);
  const istBearbeitbar = teamRolle === 'COACH' || teamRolle === 'TEAM_ADMIN';
  const aktiveFelder = tagSchema.filter((f) => f.aktiv);

  const handleCsvExport = () => {
    const csv = exportiereBreakdownAlsCsv(plays, undefined, tagSchema);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datei = reelTitel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    a.href = url;
    a.download = `${datei || 'breakdown'}-hudl.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label={t('grid.ariaLabel')}
      className="overflow-hidden rounded-lg border border-[#232933] bg-[#13171D]"
    >
      {/* Datalists für alle aktiven Wörterbuch-Felder */}
      {aktiveFelder
        .filter((f) => f.typ === 'combobox' && f.definitionen)
        .map((feld) => (
          <datalist key={`grid-dl-${feld.key}`} id={`grid-dl-${feld.key}`}>
            {feld.definitionen!.map((def) => (
              <option key={def} value={def} />
            ))}
          </datalist>
        ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232933] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold text-white">{t('grid.title')}</h2>
          <span className="font-mono text-[11px] text-[#8B949E] tabular-nums">
            {t('grid.meta', { plays: plays.length, columns: aktiveFelder.length })}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCsvExport}
          className="inline-flex items-center gap-1.5 rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1 text-[11px] font-medium text-[#E6EDF3] transition-colors hover:border-[#F59E0B] hover:text-white whitespace-nowrap"
        >
          <Download className="h-3 w-3 text-[#8B949E]" aria-hidden="true" />
          {t('grid.exportCsv')}
        </button>
      </div>

      {plays.length === 0 ? (
        <div className="px-6 py-10 text-center text-xs text-[#8B949E]">
          {t('grid.empty')}
        </div>
      ) : (
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-[#232933] bg-[#0F1318] text-[11px] font-medium text-[#8B949E]">
              <tr>
                <th className="sticky left-0 z-20 bg-[#0F1318] px-3 py-2 font-mono">#</th>
                {aktiveFelder.map((feld) => (
                  <th
                    key={feld.key}
                    className={`px-2 py-2 whitespace-nowrap ${
                      feld.typ === 'number' ? 'text-right' : ''
                    }`}
                  >
                    {feld.kurz}
                  </th>
                ))}
                <th className="px-3 py-2 text-right whitespace-nowrap">{t('grid.anglesCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232933]">
              {plays.map((play, idx) => {
                const istAktiv = idx === aktiverPlayIndex;
                const vorhandeneWinkel = Object.entries(play.sources)
                  .filter(([, q]) => q !== null)
                  .map(([k]) => (k === 'SIDELINE' ? 'SL' : k === 'ENDZONE' ? 'EZ' : k.slice(0, 2)));

                const sichtbareNotizen = (play.notes ?? []).filter((n) =>
                  teamRolle === 'PLAYER' ? n.status === 'PUBLISHED' : true
                ).length;

                return (
                  <tr
                    key={play.play_number}
                    onClick={() => onPlayWaehlen(idx)}
                    className={`h-9 cursor-pointer transition-colors ${
                      istAktiv ? 'bg-[#F59E0B]/12 text-white' : 'text-[#E6EDF3] hover:bg-[#191F27]'
                    }`}
                  >
                    <td
                      className={`sticky left-0 z-10 px-3 py-1.5 font-mono tabular-nums whitespace-nowrap ${
                        istAktiv ? 'bg-[#262014]' : 'bg-[#13171D]'
                      }`}
                    >
                      <span className={istAktiv ? 'font-semibold text-[#F59E0B]' : 'text-[#8B949E]'}>
                        #{play.play_number}
                      </span>
                      {sichtbareNotizen > 0 && (
                        <span className="ml-1 text-[10px] text-[#8B949E]">
                          ({sichtbareNotizen})
                        </span>
                      )}
                    </td>

                    {aktiveFelder.map((feld) => {
                      const wert = leseBreakdownWert(play.breakdown, feld);
                      const istNummer = feld.typ === 'number';
                      const istGnLs = feld.key === 'gn_ls';

                      return (
                        <td
                          key={feld.key}
                          className={`px-2 py-1 whitespace-nowrap ${
                            istNummer ? 'text-right font-mono tabular-nums' : ''
                          }`}
                        >
                          {istAktiv && istBearbeitbar ? (
                            feld.typ === 'select' ? (
                              <select
                                aria-label={`${feld.label} Play ${play.play_number}`}
                                value={wert ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const konvertiert =
                                    feld.key === 'down'
                                      ? raw
                                        ? Number(raw)
                                        : undefined
                                      : raw || undefined;
                                  onFeldAendern(
                                    play.play_number,
                                    feld.key,
                                    konvertiert,
                                    Boolean(feld.istCustom)
                                  );
                                }}
                                className="min-w-[56px] rounded border border-[#36404F] bg-[#0B0E11] px-1 py-0.5 font-mono text-xs text-white focus:border-[#F59E0B] focus:outline-none"
                              >
                                <option value="">–</option>
                                {(feld.definitionen ?? []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : feld.typ === 'number' ? (
                              <input
                                type="number"
                                aria-label={`${feld.label} Play ${play.play_number}`}
                                min={feld.key === 'yard_line' ? -50 : undefined}
                                max={feld.key === 'yard_line' ? 50 : undefined}
                                value={wert ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  onFeldAendern(
                                    play.play_number,
                                    feld.key,
                                    e.target.value === '' ? undefined : Number(e.target.value),
                                    Boolean(feld.istCustom)
                                  )
                                }
                                className="w-16 rounded border border-[#36404F] bg-[#0B0E11] px-1.5 py-0.5 text-right font-mono text-xs text-white focus:border-[#F59E0B] focus:outline-none"
                              />
                            ) : (
                              <input
                                type="text"
                                list={feld.typ === 'combobox' ? `grid-dl-${feld.key}` : undefined}
                                aria-label={`${feld.label} Play ${play.play_number}`}
                                value={wert ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  onFeldAendern(
                                    play.play_number,
                                    feld.key,
                                    e.target.value || undefined,
                                    Boolean(feld.istCustom)
                                  )
                                }
                                onBlur={(e) => {
                                  if (feld.typ === 'combobox' && e.target.value.trim()) {
                                    onDefinitionLernen(feld.key, e.target.value);
                                  }
                                }}
                                className="w-24 rounded border border-[#36404F] bg-[#0B0E11] px-1.5 py-0.5 text-xs text-white focus:border-[#F59E0B] focus:outline-none"
                              />
                            )
                          ) : (
                            <span
                              className={
                                istGnLs && typeof wert === 'number'
                                  ? wert > 0
                                    ? 'text-[#4ADE80]'
                                    : wert < 0
                                      ? 'text-[#FCA5A5]'
                                      : 'text-[#8B949E]'
                                  : feld.key === 'result' && wert === 'FLAG'
                                    ? 'font-mono text-[#F59E0B]'
                                    : ''
                              }
                            >
                              {wert === undefined || wert === ''
                                ? '–'
                                : istGnLs && typeof wert === 'number' && wert > 0
                                  ? `+${wert}`
                                  : wert}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-1 text-right font-mono text-[11px] text-[#8B949E] whitespace-nowrap">
                      {vorhandeneWinkel.join(' / ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
