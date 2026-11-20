import { createContext, useContext } from 'react';
import { translate, type Language, type Translate } from './i18n';

export const LanguageContext = createContext<{ language: Language; t: Translate }>({
  language: 'en',
  t: (message, params) => translate('en', message, params),
});

export function useLanguage() {
  return useContext(LanguageContext);
}
