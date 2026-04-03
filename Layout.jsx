import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Leaf, BarChart2, Cloud, User, LogOut, Menu, X, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES } from '@/lib/translations';

export default function Layout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { lang, setLanguage, t } = useLanguage();

  const navItems = [
    { path: '/', label: t('dashboard'), icon: Leaf },
    { path: '/predict', label: t('cropPrediction'), icon: Leaf },
    { path: '/risk', label: t('riskAnalysis'), icon: BarChart2 },
    { path: '/weather', label: t('weatherForecast'), icon: Cloud },
    { path: '/profile', label: t('profile'), icon: User },
  ];

  const currentLang = LANGUAGES.find(l => l.code === lang);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-primary">{t('appName')}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  location.pathname === path
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="p-2 rounded-lg hover:bg-muted flex items-center gap-1 text-sm text-muted-foreground"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{currentLang?.flag}</span>
              </button>
              {langOpen && (
                <div className="absolute right-0 top-10 bg-white border border-border rounded-lg shadow-lg z-50 min-w-36">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left ${lang === l.code ? 'font-semibold text-primary' : ''}`}
                    >
                      <span>{l.flag}</span>
                      <span>{l.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => base44.auth.logout()}
              className="hidden md:flex p-2 rounded-lg hover:bg-muted text-muted-foreground"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile menu */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 py-2">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium ${
                  location.pathname === path
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <button
              onClick={() => base44.auth.logout()}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg w-full"
            >
              <LogOut className="w-4 h-4" />
              {t('logout')}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
