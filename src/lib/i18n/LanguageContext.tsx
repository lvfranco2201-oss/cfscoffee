'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from './en.json';
import es from './es.json';

type Locale = 'es' | 'en';

interface LanguageContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

const dictionaries: Record<Locale, any> = { es, en };

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cfs_locale') as Locale;
    if (saved && (saved === 'es' || saved === 'en')) {
      setLocaleState(saved);
    }
    setMounted(true);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem('cfs_locale', next);
  };

  const toggleLanguage = () => {
    setLocale(locale === 'es' ? 'en' : 'es');
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value = dictionaries[locale];
    for (const k of keys) {
      if (value === undefined) break;
      value = value[k];
    }
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, toggleLanguage, t }}>
      <div style={{ visibility: !mounted ? 'hidden' : 'visible' }}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
