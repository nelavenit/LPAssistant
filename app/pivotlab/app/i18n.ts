import { russian, russianExampleTitles } from './ru';

export type Language = 'en' | 'ru';
export type LanguagePreference = 'system' | Language;
type Parameters = Record<string, string | number>;
export type Translate = (message: string, parameters?: Parameters) => string;

export function resolveLanguage(preference: LanguagePreference, languages: readonly string[]): Language {
  if (preference !== 'system') return preference;
  for (const locale of languages) {
    const language = locale.toLowerCase().split(/[-_]/)[0];
    if (language === 'ru' || language === 'en') return language;
  }
  return 'en';
}

export function translate(language: Language, message: string, parameters: Parameters = {}): string {
  const pattern = language === 'ru' && Object.hasOwn(russian, message) ? russian[message] : message;
  return pattern.replace(/\{(\w+)\}/g, (match, name: string) => String(parameters[name] ?? match));
}

export class AppError extends Error {
  constructor(readonly messageKey: string, readonly parameters?: Parameters) {
    super(translate('en', messageKey, parameters));
  }
}

export function errorText(t: Translate, error: unknown, fallback: string): string {
  if (error instanceof AppError) return t(error.messageKey, error.parameters);
  return error instanceof Error && Object.hasOwn(russian, error.message) ? t(error.message) : t(fallback);
}

export function tableauTitle(t: Translate, title: string): string {
  return ['Example 7.4.1', 'Untitled tableau', 'Imported tableau'].includes(title)
    || Object.hasOwn(russianExampleTitles, title) ? t(title) : title;
}
