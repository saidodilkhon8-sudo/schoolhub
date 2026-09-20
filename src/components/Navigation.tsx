import React, { useState } from 'react';
import { Home, Calendar, CheckSquare, GraduationCap, Users, User, Sparkles, ChevronRight, ShieldCheck, LogOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';

export type NavTab = 'dashboard' | 'schedule' | 'homework' | 'grades' | 'class' | 'profile' | 'admin';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export function MobileNavigation({ currentTab, onTabChange }: NavigationProps) {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();

  const tabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: Home },
    { id: 'schedule', label: t('nav_schedule'), icon: Calendar },
    { id: 'homework', label: t('nav_homework'), icon: CheckSquare },
    { id: 'grades', label: t('nav_grades'), icon: GraduationCap },
    { id: 'class', label: t('nav_class'), icon: Users },
    { id: 'profile', label: t('nav_profile'), icon: User },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin', label: 'Админ', icon: ShieldCheck });
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 safe-area-pb transition-colors">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[50px] min-h-[46px] rounded-xl transition-all relative ${
                isActive
                  ? 'text-blue-500 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-blue-600/15 text-blue-500 scale-105 shadow-xs' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-0.5">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopSidebar({ currentTab, onTabChange }: NavigationProps) {
  const { t } = useLanguage();
  const { profile, isAdmin, signOut } = useAuth();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);

  const tabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: Home },
    { id: 'schedule', label: t('nav_schedule'), icon: Calendar },
    { id: 'homework', label: t('nav_homework'), icon: CheckSquare },
    { id: 'grades', label: t('nav_grades'), icon: GraduationCap },
    { id: 'class', label: t('nav_class'), icon: Users },
    { id: 'profile', label: t('nav_profile'), icon: User },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800/80 p-5 shrink-0 select-none transition-colors">
      {/* App Logo */}
      <div
        onClick={() => onTabChange('dashboard')}
        className="flex items-center gap-3 px-2 mb-8 cursor-pointer group"
      >
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/25 group-hover:scale-105 transition-transform duration-200">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-extrabold text-lg text-zinc-100 tracking-tight leading-none">
              SchoolHub
            </h1>
            <span className="px-1.5 py-0.2 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-extrabold text-blue-400">
              PRO
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 font-medium">Школьный органайзер</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group active:scale-[0.98] ${
                isActive
                  ? 'bg-blue-600/15 text-blue-500 border border-blue-500/30 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-blue-500' : 'text-zinc-400'
                  }`}
                />
                <span>{tab.label}</span>
              </div>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}

        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-zinc-800/80">
            <div className="px-3 pb-1.5 text-[11px] font-bold text-amber-400/80 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Управление</span>
            </div>
            <button
              onClick={() => onTabChange('admin')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group active:scale-[0.98] ${
                currentTab === 'admin'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    currentTab === 'admin' ? 'text-amber-400' : 'text-zinc-400 group-hover:text-amber-400'
                  }`}
                />
                <span>Админ-панель</span>
              </div>
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ADMIN
              </span>
            </button>
          </div>
        )}
      </nav>

      {/* Class and Student Profile badge in sidebar with quick logout */}
      {profile && (
        <div className="mt-auto flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 shadow-xs">
          <button
            onClick={() => onTabChange('profile')}
            className="flex-1 min-w-0 text-left flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-zinc-900/90 transition-all group"
            title="Открыть профиль"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-xs shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.first_name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                `${profile.grade || ''}${profile.letter || ''}`
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
                {profile.first_name} {profile.last_name}
              </p>
              <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                <span>Класс</span>
                <strong className="text-zinc-300">
                  {profile.grade ? `${profile.grade}-${profile.letter}` : 'Не выбран'}
                </strong>
              </p>
            </div>
          </button>
          <button
            id="sidebar-signout-btn"
            type="button"
            onClick={() => setIsSignOutOpen(true)}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            title={t('sign_out')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CONFIRM DIALOG: Sidebar Sign Out */}
      <ConfirmDialog
        isOpen={isSignOutOpen}
        onClose={() => setIsSignOutOpen(false)}
        onConfirm={async () => {
          await signOut();
        }}
        title={t('sign_out')}
        message="Вы уверены, что хотите выйти из учетной записи?"
        confirmLabel={t('sign_out')}
        cancelLabel={t('cancel')}
        isDestructive={true}
      />
    </aside>
  );
}

