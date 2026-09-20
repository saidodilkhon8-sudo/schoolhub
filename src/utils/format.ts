import { SupportedLanguage } from '../types';

export function formatDateCustom(dateInput: string | Date, lang: SupportedLanguage = 'ru'): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const months: Record<SupportedLanguage, string[]> = {
    ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  };

  const day = d.getDate();
  const month = months[lang][d.getMonth()];
  return `${day} ${month}`;
}

export function getDaysUntil(dateStr: string): { days: number; isToday: boolean; isPast: boolean; label: string } {
  if (!dateStr) return { days: 0, isToday: false, isPast: false, label: '' };
  const target = new Date(dateStr);
  const now = new Date();
  
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { days: 0, isToday: true, isPast: false, label: 'Сегодня' };
  } else if (diffDays === 1) {
    return { days: 1, isToday: false, isPast: false, label: 'Завтра' };
  } else if (diffDays < 0) {
    return { days: diffDays, isToday: false, isPast: true, label: 'Прошло' };
  } else {
    return { days: diffDays, isToday: false, isPast: false, label: `Через ${diffDays} дн.` };
  }
}

export function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) return 'только что';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  }
  return formatDateCustom(date, 'ru');
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function generateInviteCode(grade: number, letter: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const cleanLetter = letter.trim().toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
  return `${grade}${cleanLetter}-${randomPart}`;
}

export function getFriendlyErrorMessage(err: any): string {
  if (!err) return 'Неизвестная ошибка';
  const message = typeof err === 'string' ? err : err.message || '';
  
  if (message.includes('Invalid login credentials')) {
    return 'Неверный email или пароль';
  }
  if (message.includes('Email not confirmed')) {
    return 'Пожалуйста, подтвердите email по ссылке из письма';
  }
  if (message.includes('User already registered')) {
    return 'Пользователь с таким email уже зарегистрирован';
  }
  if (message.includes('Password should be at least')) {
    return 'Пароль должен содержать не менее 6 символов';
  }
  if (message.includes('FetchError') || message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Проблема с подключением к сети. Проверьте интернет или конфигурацию Supabase.';
  }
  if (message.includes('permission denied') || message.includes('new row violates row-level security')) {
    return 'Доступ ограничен правилами безопасности (RLS). Убедитесь, что вы состоите в этом классе.';
  }
  return message || 'Произошла ошибка при выполнении операции';
}
