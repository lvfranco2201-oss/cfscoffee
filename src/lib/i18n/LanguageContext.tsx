'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from './en.json';
import es from './es.json';

type Locale = 'es' | 'en';
type Translations = typeof es;

interface LanguageContextProps {
  locale: Locale;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

const dictionaries: Record<Locale, any> = {
  es,
  en
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>('es');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cfs_locale') as Locale;
    if (saved && (saved === 'es' || saved === 'en')) {
      setLocale(saved);
    }
    setMounted(true);
  }, []);

  const toggleLanguage = () => {
    const nextLocale = locale === 'es' ? 'en' : 'es';
    setLocale(nextLocale);
    localStorage.setItem('cfs_locale', nextLocale);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value = dictionaries[locale];
    for (const k of keys) {
      if (value === undefined) break;
      value = value[k];
    }
    return value || key; // Retorna la llave si no encuentra la traducción
  };

  // En SSR devolvemos el proveedor con el idioma default para no romper ganchos
  return (
    <LanguageContext.Provider value={{ locale, toggleLanguage, t }}>
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
