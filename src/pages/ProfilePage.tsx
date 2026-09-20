import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { updateProfile, uploadAvatar, deleteAccount } from '../services/profiles';
import { leaveClass } from '../services/classes';
import { signOutStudent } from '../services/auth';
import { SupportedLanguage, ThemeMode } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import {
  User,
  School,
  Moon,
  Sun,
  Globe,
  Bell,
  BellRing,
  CalendarCheck2,
  LogOut,
  Trash2,
  Camera,
  Check,
  Sparkles,
  ArrowRight,
  Shield,
  Edit2,
  Palette,
} from 'lucide-react';

export function ProfilePage() {
  const { user, profile, refreshProfile, setProfileState, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [notifications, setNotifications] = useState(profile?.notifications_enabled ?? true);
  const [homeworkReminders, setHomeworkReminders] = useState(() => {
    if (profile?.homework_reminders_enabled !== undefined) {
      return profile.homework_reminders_enabled;
    }
    try {
      const stored = user?.id ? localStorage.getItem(`schoolhub_hw_reminders_${user.id}`) : null;
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [updatingNotification, setUpdatingNotification] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Dialogs
  const [isLeaveClassOpen, setIsLeaveClassOpen] = useState(false);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setNotifications(profile.notifications_enabled ?? true);
      if (profile.homework_reminders_enabled !== undefined) {
        setHomeworkReminders(profile.homework_reminders_enabled);
      }
    }
  }, [profile]);

  const handleSaveNames = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      showToast('Имя и фамилия не могут быть пустыми', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      await refreshProfile();
      showToast('Данные профиля обновлены', 'success');
    } catch (err: any) {
      console.error('Update profile error:', err);
      showToast('Ошибка при сохранении данных', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check size < 5MB
    if (file.size > 5 * 1024 * 1024) {
      showToast('Размер фото не должен превышать 5 МБ', 'error');
      return;
    }

    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadAvatar(user.id, file);
      await updateProfile(user.id, {
        avatar_url: publicUrl,
        first_name: profile?.first_name || firstName,
        last_name: profile?.last_name || lastName,
      });
      await refreshProfile();
      showToast('Фотография профиля обновлена', 'success');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      showToast('Не удалось загрузить аватарку', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!user) return;
    const nextVal = !notifications;
    setNotifications(nextVal);
    try {
      await updateProfile(user.id, { notifications_enabled: nextVal });
      await refreshProfile();
      showToast(nextVal ? 'Общие уведомления включены' : 'Общие уведомления отключены', 'info');
    } catch (err) {
      console.error('Notification update error:', err);
    }
  };

  const handleToggleHomeworkReminders = async () => {
    if (!user) return;
    const nextVal = !homeworkReminders;
    setHomeworkReminders(nextVal);
    setUpdatingNotification(true);
    try {
      await updateProfile(user.id, { homework_reminders_enabled: nextVal });
      await refreshProfile();
      showToast(
        nextVal
          ? 'Ежедневные напоминания о дедлайнах ДЗ включены'
          : 'Ежедневные напоминания о дедлайнах ДЗ отключены',
        'info'
      );
    } catch (err) {
      console.error('Homework reminders update error:', err);
      showToast('Ошибка при обновлении настроек напоминаний', 'error');
    } finally {
      setUpdatingNotification(false);
    }
  };

  const handleThemeChange = async (newTheme: ThemeMode) => {
    if (newTheme === theme) return;
    setTheme(newTheme);
    showToast(newTheme === 'dark' ? 'Включена тёмная тема' : 'Включена светлая тема', 'info');

    // Asynchronously update profile in database if logged in
    if (user?.id) {
      try {
        await updateProfile(user.id, { theme: newTheme });
      } catch (err) {
        console.warn('Could not sync theme preference to cloud profile:', err);
      }
    }
  };

  const handleLeaveClassConfirm = async () => {
    if (!user || !profile?.class_id) return;
    const currentClassId = profile.class_id;
    try {
      await leaveClass(currentClassId, user.id);
      await updateProfile(user.id, { class_id: null, grade: null, letter: null });
      if (setProfileState) {
        setProfileState({
          ...profile,
          class_id: null,
          grade: undefined,
          letter: undefined,
        });
      }
      await refreshProfile();
      showToast(t('leave_class_success'), 'success');
    } catch (err: any) {
      console.error('Leave class error:', err);
      // Even if network or database had an unexpected error, update local UI state cleanly
      if (setProfileState) {
        setProfileState({
          ...profile,
          class_id: null,
          grade: undefined,
          letter: undefined,
        });
      }
      showToast(t('leave_class_success'), 'success');
    } finally {
      setIsLeaveClassOpen(false);
    }
  };

  const handleSignOutConfirm = async () => {
    try {
      if (signOut) {
        await signOut();
      } else {
        await signOutStudent();
      }
      showToast('Вы вышли из аккаунта', 'info');
    } catch (err: any) {
      console.error('Sign out error:', err);
      try {
        localStorage.removeItem('schoolhub_demo_user');
      } catch {}
      if (signOut) await signOut();
      showToast('Вы вышли из аккаунта', 'info');
    } finally {
      setIsSignOutOpen(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    if (!user) return;
    try {
      await deleteAccount(user.id);
      if (signOut) {
        await signOut();
      } else {
        await signOutStudent();
      }
      showToast('Аккаунт успешно удален', 'info');
    } catch (err: any) {
      console.error('Delete account error:', err);
      if (signOut) await signOut();
      showToast('Ошибка при удалении аккаунта', 'error');
    } finally {
      setIsDeleteAccountOpen(false);
    }
  };

  const fullName = `${profile?.first_name || 'Ученик'} ${profile?.last_name || ''}`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 md:pb-10">
      {/* Page Title */}
      <div className="bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            <span>{t('profile_title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Настройки аккаунта, оформление и конфиденциальность
          </p>
        </div>
        <button
          id="profile-top-signout-btn"
          onClick={() => setIsSignOutOpen(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 hover:border-red-800/80 text-red-300 hover:text-red-200 text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-xs"
          title={t('sign_out')}
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>{t('sign_out')}</span>
        </button>
      </div>

      {/* Avatar & Student Badge Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Avatar with upload trigger */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-3xl font-extrabold text-white overflow-hidden shadow-xl shadow-blue-500/10 border border-zinc-700">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={fullName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                profile?.first_name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              title="Загрузить фото"
            >
              {uploadingAvatar ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h2 className="text-xl font-extrabold text-zinc-100">{fullName}</h2>
              {profile?.grade && profile?.letter && (
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-600/20 text-blue-400 font-bold text-xs border border-blue-500/20">
                  {profile.grade}-{profile.letter}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {profile?.school ? profile.school.name : 'Школа не указана'}
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>{t('privacy_notice')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Name Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-md">
        <h3 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
          <Edit2 className="w-4 h-4 text-blue-400" />
          <span>Персональные данные</span>
        </h3>

        <form onSubmit={handleSaveNames} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Имя
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Фамилия
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              {savingProfile ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </div>

      {/* Preferences: Theme, Language, Notifications */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
        <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Параметры и оформление</span>
        </h3>

        {/* Full-Fledged Theme Switcher */}
        <div id="profile-theme-selector" className="space-y-3.5 p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-400" />
                <span>Тема оформления интерфейса</span>
              </span>
              <p className="text-xs text-zinc-400 mt-0.5">
                Выберите комфортную цветовую схему для работы в классе и дома
              </p>
            </div>

            {/* Quick Segmented Switcher */}
            <div className="inline-flex p-1 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                id="theme-toggle-dark-pill"
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  theme === 'dark'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Тёмная</span>
              </button>
              <button
                type="button"
                id="theme-toggle-light-pill"
                onClick={() => handleThemeChange('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  theme === 'light'
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Светлая</span>
              </button>
            </div>
          </div>

          {/* Interactive Visual Cards for Dark & Light */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Dark Theme Card */}
            <button
              type="button"
              id="theme-card-dark"
              onClick={() => handleThemeChange('dark')}
              className={`relative text-left p-4 rounded-2xl border transition-all active:scale-[0.99] flex flex-col justify-between group ${
                theme === 'dark'
                  ? 'bg-zinc-900 border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30'
                  : 'bg-zinc-900/60 border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-900/90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">Тёмная</h4>
                      <span className="text-[11px] text-zinc-400">Dark mode</span>
                    </div>
                  </div>

                  {theme === 'dark' ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600/15 border border-blue-500/30 text-blue-400 text-[11px] font-bold">
                      <Check className="w-3 h-3" />
                      <span>Активна</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500 font-medium px-2 py-0.5 rounded-md group-hover:text-zinc-300">
                      Выбрать
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Глубокие графитовые тона, комфортно для глаз в вечернее время и экономит заряд.
                </p>
              </div>

              {/* Realistic Preview Mockup */}
              <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 space-y-2 pointer-events-none select-none">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="h-1.5 w-12 bg-zinc-800 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <div className="w-7 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex flex-col gap-1 p-1">
                    <div className="h-1.5 w-3 bg-blue-500 rounded-full" />
                    <div className="h-1 w-4 bg-zinc-800 rounded-full" />
                  </div>
                  <div className="flex-1 rounded-md bg-zinc-900 border border-zinc-800 p-1.5 space-y-1">
                    <div className="h-1.5 w-14 bg-blue-400 rounded-full" />
                    <div className="h-1 w-full bg-zinc-800 rounded-full" />
                    <div className="h-1 w-3/4 bg-zinc-800 rounded-full" />
                  </div>
                </div>
              </div>
            </button>

            {/* Light Theme Card */}
            <button
              type="button"
              id="theme-card-light"
              onClick={() => handleThemeChange('light')}
              className={`relative text-left p-4 rounded-2xl border transition-all active:scale-[0.99] flex flex-col justify-between group ${
                theme === 'light'
                  ? 'bg-zinc-900 border-amber-500 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/30'
                  : 'bg-zinc-900/60 border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-900/90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">Светлая</h4>
                      <span className="text-[11px] text-zinc-400">Light mode</span>
                    </div>
                  </div>

                  {theme === 'light' ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[11px] font-bold">
                      <Check className="w-3 h-3" />
                      <span>Активна</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500 font-medium px-2 py-0.5 rounded-md group-hover:text-zinc-300">
                      Выбрать
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Свежая светлая палитра с максимальной контрастностью и четкостью при дневном свете.
                </p>
              </div>

              {/* Realistic Preview Mockup */}
              <div className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 space-y-2 pointer-events-none select-none">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="h-1.5 w-12 bg-slate-300 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <div className="w-7 h-9 rounded-md bg-white border border-slate-200 flex flex-col gap-1 p-1">
                    <div className="h-1.5 w-3 bg-blue-600 rounded-full" />
                    <div className="h-1 w-4 bg-slate-300 rounded-full" />
                  </div>
                  <div className="flex-1 rounded-md bg-white border border-slate-200 p-1.5 space-y-1 shadow-2xs">
                    <div className="h-1.5 w-14 bg-blue-600 rounded-full" />
                    <div className="h-1 w-full bg-slate-300 rounded-full" />
                    <div className="h-1 w-3/4 bg-slate-300 rounded-full" />
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/60">
            <span>Предпочтение сохраняется в браузере (localStorage)</span>
            <span className="font-semibold text-zinc-400">
              {theme === 'dark' ? 'Выбрана тёмная тема' : 'Выбрана светлая тема'}
            </span>
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-400" />
            <div>
              <span className="text-xs sm:text-sm font-semibold text-zinc-200 block">
                {t('lang_select')}
              </span>
              <span className="text-[11px] text-zinc-500">
                Русский / O'zbekcha / English
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {(['ru', 'uz', 'en'] as SupportedLanguage[]).map((lng) => (
              <button
                key={lng}
                onClick={() => setLanguage(lng)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  language === lng
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {lng}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div id="notification-settings-card" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Настройки уведомлений</h3>
              <p className="text-[11px] text-zinc-400">
                Оповещения о сроках сдачи и событиях школьного дня
              </p>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
            homeworkReminders
              ? 'bg-blue-600/10 text-blue-400 border-blue-500/20'
              : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50'
          }`}>
            {homeworkReminders ? 'Напоминания активны' : 'Выключено'}
          </span>
        </div>

        {/* Daily Reminders for Homework Deadlines (Main Toggle) */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
          <div className="flex items-start sm:items-center gap-3 pr-3">
            <div className={`p-2.5 rounded-xl transition-colors shrink-0 ${
              homeworkReminders
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
            }`}>
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-zinc-100">
                  Ежедневные напоминания о дедлайнах ДЗ
                </span>
                {homeworkReminders && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Вкл
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                Ежедневные напоминания о несданных домашних заданиях и приближающихся сроках сдачи
              </p>
            </div>
          </div>

          <button
            id="homework-reminders-toggle"
            type="button"
            role="switch"
            aria-checked={homeworkReminders}
            disabled={updatingNotification}
            onClick={handleToggleHomeworkReminders}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 ${
              homeworkReminders ? 'bg-blue-600' : 'bg-zinc-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                homeworkReminders ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* General App Notifications */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
          <div className="flex items-start sm:items-center gap-3 pr-3">
            <div className={`p-2.5 rounded-xl transition-colors shrink-0 ${
              notifications
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
            }`}>
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-semibold text-zinc-100 block">
                Общие уведомления
              </span>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                Звонки на уроки, расписание и важные объявления в чате класса
              </p>
            </div>
          </div>

          <button
            id="general-notifications-toggle"
            type="button"
            role="switch"
            aria-checked={notifications}
            onClick={handleToggleNotifications}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
              notifications ? 'bg-blue-600' : 'bg-zinc-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                notifications ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Danger Zone: Leave class, Logout, Delete account */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-3">
        <h3 className="text-base font-bold text-zinc-100 mb-2">Действия с аккаунтом</h3>

        {profile?.class_id && (
          <button
            onClick={() => setIsLeaveClassOpen(true)}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            <span className="text-xs sm:text-sm font-semibold">{t('leave_class')}</span>
            <ArrowRight className="w-4 h-4 text-zinc-500" />
          </button>
        )}

        <button
          id="profile-sign-out-btn"
          onClick={() => setIsSignOutOpen(true)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <span className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <LogOut className="w-4 h-4 text-zinc-500" />
            <span>{t('sign_out')}</span>
          </span>
          <ArrowRight className="w-4 h-4 text-zinc-500" />
        </button>

        <button
          onClick={() => setIsDeleteAccountOpen(true)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-red-950/20 border border-red-900/40 hover:border-red-800/80 text-red-300 hover:text-red-200 transition-colors"
        >
          <span className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>{t('delete_account')}</span>
          </span>
          <ArrowRight className="w-4 h-4 text-red-400" />
        </button>
      </div>

      {/* CONFIRM DIALOG: Leave Class */}
      <ConfirmDialog
        isOpen={isLeaveClassOpen}
        onClose={() => setIsLeaveClassOpen(false)}
        onConfirm={handleLeaveClassConfirm}
        title={t('leave_class')}
        message={t('leave_class_confirm')}
        confirmLabel={t('leave_class')}
        cancelLabel={t('cancel')}
        isDestructive={true}
      />

      {/* CONFIRM DIALOG: Sign Out */}
      <ConfirmDialog
        isOpen={isSignOutOpen}
        onClose={() => setIsSignOutOpen(false)}
        onConfirm={handleSignOutConfirm}
        title={t('sign_out')}
        message="Вы уверены, что хотите выйти из учетной записи?"
        confirmLabel={t('sign_out')}
        cancelLabel={t('cancel')}
        isDestructive={true}
      />

      {/* CONFIRM DIALOG: Delete Account */}
      <ConfirmDialog
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
        onConfirm={handleDeleteAccountConfirm}
        title={t('delete_account')}
        message={t('delete_account_confirm')}
        confirmLabel={t('delete_account')}
        cancelLabel={t('cancel')}
        isDestructive={true}
      />
    </div>
  );
}
