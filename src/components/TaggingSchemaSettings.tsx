import { useState } from 'react';
import { Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { TeamRolle } from '../../../sdk/plugin.ts';
import type {
  BreakdownFeldKey,
  TagFeldKonfig,
  TagFeldTyp,
} from '../types.ts';
import { createVideoTranslator, holeVideoGruppeLabel } from '../i18n.ts';

interface TaggingSchemaSettingsProps {
  teamRolle: TeamRolle;
  tagSchema: TagFeldKonfig[];
  locale?: string;
  onFeldToggle: (feldKey: BreakdownFeldKey) => void;
  onDefinitionHinzufuegen: (feldKey: BreakdownFeldKey, begriff: string) => void;
  onDefinitionLoeschen: (feldKey: BreakdownFeldKey, begriff: string) => void;
  onCustomFeldErstellen: (feld: TagFeldKonfig) => void;
  onCustomFeldLoeschen: (feldKey: BreakdownFeldKey) => void;
}

export function TaggingSchemaSettings({
  teamRolle,
  tagSchema,
  locale,
  onFeldToggle,
  onDefinitionHinzufuegen,
  onDefinitionLoeschen,
  onCustomFeldErstellen,
  onCustomFeldLoeschen,
}: TaggingSchemaSettingsProps) {
  const t = createVideoTranslator(locale);
  const istTeamAdmin = teamRolle === 'TEAM_ADMIN';

  const [ausgewaehltesFeldKey, setAusgewaehltesFeldKey] = useState<string>('off_form');
  const [neuerBegriff, setNeuerBegriff] = useState('');

  // Formular für neues Custom-Feld
  const [customLabel, setCustomLabel] = useState('');
  const [customKurz, setCustomKurz] = useState('');
  const [customTyp, setCustomTyp] = useState<TagFeldTyp>('combobox');
  const [customStartWerte, setCustomStartWerte] = useState('');
  const [customFehler, setCustomFehler] = useState<string | null>(null);

  const ausgewaehltesFeld =
    tagSchema.find((f) => f.key === ausgewaehltesFeldKey) ??
    tagSchema.find((f) => f.typ === 'combobox') ??
    null;

  const handleBegriffSpeichern = () => {
    if (!ausgewaehltesFeld || !neuerBegriff.trim()) return;
    onDefinitionHinzufuegen(ausgewaehltesFeld.key, neuerBegriff.trim());
    setNeuerBegriff('');
  };

  const handleCustomErstellen = () => {
    setCustomFehler(null);
    const titel = customLabel.trim();
    const kurz = (customKurz.trim() || titel.slice(0, 10)).toUpperCase();
    if (!titel) {
      setCustomFehler(t('tagging.errNameRequired'));
      return;
    }

    const slug = titel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '');
    const key = `custom_${slug || Date.now()}`;

    if (tagSchema.some((f) => f.key === key)) {
      setCustomFehler(t('tagging.errKeyExists'));
      return;
    }

    const definitionen =
      customTyp === 'combobox'
        ? customStartWerte
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const neuesFeld: TagFeldKonfig = {
      key,
      label: titel,
      kurz,
      gruppe: 'CUSTOM',
      typ: customTyp,
      aktiv: true,
      istCustom: true,
      ...(definitionen ? { definitionen } : {}),
    };

    onCustomFeldErstellen(neuesFeld);
    setCustomLabel('');
    setCustomKurz('');
    setCustomStartWerte('');
    if (customTyp === 'combobox') {
      setAusgewaehltesFeldKey(key);
    }
  };

  const gruppen: Array<TagFeldKonfig['gruppe']> = [
    'SITUATION',
    'OFFENSE',
    'RESULT',
    'DEFENSE',
    'CUSTOM',
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#232933] bg-[#13171D] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md border border-[#232933] bg-[#0B0E11] p-2 text-[#F59E0B]">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">
                {t('tagging.title')}
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-[#8B949E]">
                {t('tagging.subtitle')}
              </p>
            </div>
          </div>

          {!istTeamAdmin && (
            <span className="rounded border border-[#232933] bg-[#0B0E11] px-3 py-1.5 text-xs text-[#8B949E]">
              {t('tagging.readOnlyBadge')}
            </span>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Linke Spalte: Felder aktivieren/deaktivieren + Custom-Feld anlegen */}
        <div className="space-y-6">
          <section className="rounded-lg border border-[#232933] bg-[#13171D] p-5">
            <h2 className="text-sm font-semibold text-white">{t('tagging.activeFieldsTitle')}</h2>
            <p className="mt-1 text-xs text-[#8B949E]">
              {t('tagging.activeFieldsDesc')}
            </p>

            <div className="mt-4 space-y-5">
              {gruppen.map((gruppe) => {
                const felder = tagSchema.filter((f) => f.gruppe === gruppe);
                if (felder.length === 0) return null;

                return (
                  <div key={gruppe} className="space-y-2">
                    <h3 className="text-xs font-medium text-[#8B949E]">
                      {holeVideoGruppeLabel(gruppe, locale)}
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {felder.map((feld) => {
                        const istWorterbuch = feld.typ === 'combobox';
                        const selektiert = feld.key === ausgewaehltesFeld?.key;
                        return (
                          <div
                            key={feld.key}
                            className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${
                              selektiert
                                ? 'border-[#F59E0B]/60 bg-[#0B0E11]'
                                : 'border-[#232933] bg-[#0B0E11]'
                            }`}
                          >
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                              <input
                                type="checkbox"
                                disabled={!istTeamAdmin}
                                checked={feld.aktiv}
                                onChange={() => onFeldToggle(feld.key)}
                                className="h-3.5 w-3.5 accent-[#F59E0B] disabled:opacity-50"
                              />
                              <div className="min-w-0">
                                <div className="truncate font-medium text-[#E6EDF3]">
                                  {feld.kurz}
                                </div>
                                <div className="truncate text-[11px] text-[#8B949E]">
                                  {feld.label}
                                </div>
                              </div>
                            </label>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {istWorterbuch && (
                                <button
                                  type="button"
                                  onClick={() => setAusgewaehltesFeldKey(feld.key)}
                                  className="rounded border border-[#232933] px-2 py-0.5 font-mono text-[10px] text-[#8B949E] hover:border-[#F59E0B] hover:text-white"
                                >
                                  {t('tagging.valuesCount', {
                                    count: feld.definitionen?.length ?? 0,
                                  })}
                                </button>
                              )}
                              {feld.istCustom && istTeamAdmin && (
                                <button
                                  type="button"
                                  onClick={() => onCustomFeldLoeschen(feld.key)}
                                  aria-label={t('tagging.deleteCustomAria', { label: feld.label })}
                                  className="rounded p-1 text-[#8B949E] hover:text-[#FCA5A5]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Neues Custom-Feld anlegen */}
          {istTeamAdmin && (
            <section className="rounded-lg border border-[#232933] bg-[#13171D] p-5">
              <h2 className="text-sm font-semibold text-white">{t('tagging.addCustomTitle')}</h2>
              <p className="mt-1 text-xs text-[#8B949E]">
                {t('tagging.addCustomDesc')}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-xs text-[#8B949E]">
                  <span>{t('tagging.fieldName')}</span>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder={t('tagging.fieldNamePlaceholder')}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white placeholder-[#6E7681] focus:border-[#F59E0B] focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-xs text-[#8B949E]">
                  <span>{t('tagging.shortCode')}</span>
                  <input
                    type="text"
                    value={customKurz}
                    onChange={(e) => setCustomKurz(e.target.value)}
                    placeholder={t('tagging.shortCodePlaceholder')}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 font-mono text-xs uppercase text-white placeholder-[#6E7681] focus:border-[#F59E0B] focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-xs text-[#8B949E]">
                  <span>{t('tagging.fieldType')}</span>
                  <select
                    value={customTyp}
                    onChange={(e) => setCustomTyp(e.target.value as TagFeldTyp)}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white focus:border-[#F59E0B] focus:outline-none"
                  >
                    <option value="combobox">{t('tagging.typeCombobox')}</option>
                    <option value="text">{t('tagging.typeText')}</option>
                    <option value="number">{t('tagging.typeNumber')}</option>
                  </select>
                </label>
              </div>

              {customTyp === 'combobox' && (
                <label className="mt-3 block space-y-1 text-xs text-[#8B949E]">
                  <span>{t('tagging.startValues')}</span>
                  <input
                    type="text"
                    value={customStartWerte}
                    onChange={(e) => setCustomStartWerte(e.target.value)}
                    placeholder={t('tagging.startValuesPlaceholder')}
                    className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white placeholder-[#6E7681] focus:border-[#F59E0B] focus:outline-none"
                  />
                </label>
              )}

              {customFehler && <p className="mt-2 text-xs text-[#FCA5A5]">{customFehler}</p>}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleCustomErstellen}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#F59E0B] px-3.5 py-1.5 text-xs font-semibold text-[#0B0E11] transition-colors hover:bg-[#FBBF24]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('tagging.addCustomBtn')}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Rechte Spalte: Wörterbuch-Verwaltung (Definitionen pflegen & Fehleinträge löschen) */}
        <aside className="rounded-lg border border-[#232933] bg-[#13171D] p-5">
          <h2 className="text-sm font-semibold text-white">{t('tagging.dictTitle')}</h2>
          <p className="mt-1 text-xs text-[#8B949E]">
            {t('tagging.dictDesc')}
          </p>

          <label className="mt-4 block space-y-1 text-xs text-[#8B949E]">
            <span>{t('tagging.selectField')}</span>
            <select
              value={ausgewaehltesFeld?.key ?? ''}
              onChange={(e) => setAusgewaehltesFeldKey(e.target.value)}
              className="w-full rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white focus:border-[#F59E0B] focus:outline-none"
            >
              {tagSchema
                .filter((f) => f.typ === 'combobox')
                .map((feld) => (
                  <option key={feld.key} value={feld.key}>
                    {feld.kurz} — {feld.label} ({feld.definitionen?.length ?? 0})
                  </option>
                ))}
            </select>
          </label>

          {ausgewaehltesFeld && (
            <div className="mt-4 space-y-3">
              {istTeamAdmin && (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={neuerBegriff}
                    onChange={(e) => setNeuerBegriff(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleBegriffSpeichern();
                    }}
                    placeholder={t('tagging.newEntryPlaceholder', { short: ausgewaehltesFeld.kurz })}
                    className="min-w-0 flex-1 rounded border border-[#232933] bg-[#0B0E11] px-2.5 py-1.5 text-xs text-white placeholder-[#6E7681] focus:border-[#F59E0B] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBegriffSpeichern}
                    className="rounded border border-[#232933] bg-[#1E2530] px-3 py-1.5 text-xs font-medium text-white hover:border-[#F59E0B]"
                  >
                    +
                  </button>
                </div>
              )}

              <ul className="max-h-[380px] divide-y divide-[#232933] overflow-y-auto rounded-md border border-[#232933] bg-[#0B0E11]">
                {(ausgewaehltesFeld.definitionen ?? []).length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-[#6E7681]">
                    {t('tagging.noDefinitions')}
                  </li>
                ) : (
                  (ausgewaehltesFeld.definitionen ?? []).map((begriff) => (
                    <li
                      key={begriff}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[#E6EDF3]"
                    >
                      <span className="truncate">{begriff}</span>
                      {istTeamAdmin && (
                        <button
                          type="button"
                          onClick={() => onDefinitionLoeschen(ausgewaehltesFeld.key, begriff)}
                          title={t('tagging.deleteEntryTitle', { term: begriff })}
                          aria-label={t('tagging.deleteEntryAria', { term: begriff })}
                          className="rounded p-0.5 text-[#8B949E] transition-colors hover:bg-[#DC2626]/15 hover:text-[#FCA5A5]"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
