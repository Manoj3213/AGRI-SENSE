import { useState, useEffect } from 'react';
import { translations } from './translations';

export function useLanguage() {
  const [lang, setLang] = useState(() => localStorage.getItem('agrisense_lang') || 'en');

  const setLanguage = (code) => {
    setLang(code);
    localStorage.setItem('agrisense_lang', code);
  };

  const t = (key) => translations[lang]?.[key] || translations['en'][key] || key;

  return { lang, setLanguage, t };
}
