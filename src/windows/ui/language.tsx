import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'en' | 'vi';
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (en: string, vi: string) => string };
const KEY = 'tuhamho-language';
const LanguageContext = createContext<LanguageContextValue>({ language: 'en', setLanguage: () => undefined, t: (en) => en });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem(KEY) === 'vi' ? 'vi' : 'en'));
  useEffect(() => localStorage.setItem(KEY, language), [language]);
  const value: LanguageContextValue = { language, setLanguage, t: (en, vi) => (language === 'vi' ? vi : en) };
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
