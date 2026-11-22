import { createPluginTranslator, type SprachWoerterbuecher } from '../../sdk/plugin.ts';
import type {
  HotkeyAktion,
  KommentarEcke,
  ReelKategorie,
  SpielerFreigabe,
  TagFeldKonfig,
} from './types.ts';
import deLocale from './locales/de.json';
import enLocale from './locales/en.json';

export const VIDEO_WOERTERBUECHER: SprachWoerterbuecher = {
  de: deLocale,
  en: enLocale,
};

export function createVideoTranslator(locale?: string) {
  return createPluginTranslator(VIDEO_WOERTERBUECHER, locale);
}

export function holeVideoKategorieLabel(kategorie: ReelKategorie, locale?: string): string {
  return createVideoTranslator(locale)(`category.${kategorie}`);
}

export function holeVideoFreigabeLabel(freigabe: SpielerFreigabe, locale?: string): string {
  return createVideoTranslator(locale)(`visibility.${freigabe}`);
}

export function holeVideoEckeLabel(ecke: KommentarEcke, locale?: string): string {
  return createVideoTranslator(locale)(`corner.${ecke}`);
}

export function holeVideoGruppeLabel(
  gruppe: TagFeldKonfig['gruppe'],
  locale?: string
): string {
  return createVideoTranslator(locale)(`tagging.group.${gruppe}`);
}

export function holeHotkeyInfo(
  aktion: HotkeyAktion,
  locale?: string
): { label: string; beschreibung: string } {
  const t = createVideoTranslator(locale);
  return {
    label: t(`hotkey.${aktion}.label`),
    beschreibung: t(`hotkey.${aktion}.desc`),
  };
}
