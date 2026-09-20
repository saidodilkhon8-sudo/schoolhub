import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatDateCustom } from '../utils/format';
import { School, Sparkles, Globe, Sun, Moon, CalendarDays, Bell, ShieldCheck } from 'lucide-react';
import { SupportedLanguage } from '../types';
import { useNotifications } from '../contexts/NotificationContext';

interface HeaderProps {
  onOpenProfile: () => void;
  onOpenAdmin?: () => void;
}

export function Header({ onOpenProfile, onOpenAdmin }: HeaderProps) {
  const { profile, isAdmin } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount, setIsCenterOpen, realtimeStatus } = useNotifications();
  const todayStr = formatDateCustom(new Date(), language);

  const toggleLanguage = () => {
    const nextLang: Record<SupportedLanguage, SupportedLanguage> = {
      ru: 'uz',
      uz: 'en',
      en: 'ru',
    };
    setLanguage(nextLang[language]);
  };

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 px-4 sm:px-6 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-3 sm:gap-4 max-w-7xl mx-auto">
        {/* Left: Mobile Brand / Live Date chip */}
        <div className="flex items-center gap-3">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-base text-zinc-100 tracking-tight">SchoolHub</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 shadow-xs">
            <CalendarDays className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-zinc-400 font-medium">
              {t('today_is')}: <strong className="text-zinc-200 font-semibold">{todayStr}</strong>
            </span>
          </div>
        </div>

        {/* Center / Right: School and Class info badge & controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {profile?.grade && profile?.letter && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs font-semibold text-zinc-200 shadow-xs">
              <School className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-bold text-blue-400">
                {profile.grade}-{profile.letter}
              </span>
            </div>
          )}

          {/* Admin Header Shortcut */}
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 h-8 sm:h-9 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs transition-all active:scale-95 shadow-xs"
              title="Открыть панель администратора"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Админ</span>
            </button>
          )}

          {/* Real-time Notification Bell Button */}
          <button
            id="notification-bell-btn"
            onClick={() => setIsCenterOpen((prev) => !prev)}
            className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-850 active:scale-95 transition-all shadow-xs"
            title="Уведомления в реальном времени"
            aria-label="Уведомления"
          >
            <Bell className="w-4 h-4 text-zinc-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white shadow-xs animate-in zoom-in-50">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span
              className={`absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full ${
                realtimeStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              title={realtimeStatus === 'connected' ? 'Realtime подключен' : 'Realtime подключается'}
            />
          </button>

          {/* Theme Quick Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-850 active:scale-95 transition-all shadow-xs"
            title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            aria-label="Переключить тему оформления"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-blue-600 transition-transform duration-300 hover:-rotate-12" />
            )}
          </button>

          {/* Language Switcher Quick Button */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2.5 sm:px-3 h-8 sm:h-9 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs font-bold text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-850 active:scale-95 transition-all shadow-xs uppercase tracking-wider"
            title="Сменить язык / Change language / Tilni o'zgartirish"
          >
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            <span>{language}</span>
          </button>

          {/* Avatar button */}
          {profile && (
            <button
              onClick={onOpenProfile}
              className="group flex items-center gap-2 p-1 sm:pr-3 rounded-full bg-zinc-900/80 border border-zinc-800/80 hover:border-blue-500/50 hover:bg-zinc-850 active:scale-95 transition-all shadow-xs"
              title="Открыть профиль"
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow-inner">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.first_name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    profile.first_name.charAt(0).toUpperCase()
                  )}
                </div>
                {/* Live Online Badge */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-900" />
              </div>
              <span className="hidden sm:inline text-xs font-bold text-zinc-200 group-hover:text-blue-400 transition-colors truncate max-w-[110px]">
                {profile.first_name}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

