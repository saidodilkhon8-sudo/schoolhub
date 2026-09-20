import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCheck,
  Trash2,
  X,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';
import { NavTab } from './Navigation';

function formatTimeAgo(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 30) return 'только что';
    if (diff < 60) return `${diff} сек назад`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins} мин назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'вчера';
    return `${days} дн назад`;
  } catch {
    return 'недавно';
  }
}

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    isCenterOpen,
    setIsCenterOpen,
    realtimeStatus,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    triggerTestNotification,
    navigateTab,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<'all' | 'homework' | 'schedule'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isCenterOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCenterOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsCenterOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCenterOpen, setIsCenterOpen]);

  if (!isCenterOpen) return null;

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    return n.type === activeFilter;
  });

  const handleOpenItem = (item: typeof notifications[0]) => {
    markAsRead(item.id);
    setIsCenterOpen(false);

    const targetTab: NavTab =
      item.link_tab ||
      (item.type === 'homework' ? 'homework' : item.type === 'schedule' ? 'schedule' : 'dashboard');
    navigateTab(targetTab);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        ref={panelRef}
        className="w-full max-w-md h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-100 text-base">Уведомления</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    realtimeStatus === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : realtimeStatus === 'connecting'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-zinc-500'
                  }`}
                />
                <span className="text-[11px] text-zinc-400">
                  {realtimeStatus === 'connected'
                    ? 'Supabase Realtime подключен'
                    : realtimeStatus === 'connecting'
                    ? 'Подключение к Realtime...'
                    : 'Офлайн режим'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                title="Отметить все как прочитанные"
                className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                title="Очистить все уведомления"
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsCenterOpen(false)}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-time Test Sandbox Strip */}
        <div className="px-4 py-2.5 bg-zinc-950/60 border-b border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Тест подписки:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => triggerTestNotification('homework')}
              className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 font-medium transition-colors text-[11px]"
            >
              + Д/З
            </button>
            <button
              onClick={() => triggerTestNotification('schedule')}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-medium transition-colors text-[11px]"
            >
              + Расписание
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-zinc-800/60">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Все ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('homework')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'homework'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Домашка</span>
          </button>
          <button
            onClick={() => setActiveFilter('schedule')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'schedule'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Расписание</span>
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-zinc-800">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-3 text-zinc-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="font-semibold text-zinc-300 text-sm">Нет новых уведомлений</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                При появлении нового домашнего задания или изменении урока вы получите мгновенное оповещение
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isHw = item.type === 'homework';
              const isSch = item.type === 'schedule';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all relative ${
                    item.is_read
                      ? 'bg-zinc-900/60 border-zinc-800/70 text-zinc-300'
                      : 'bg-zinc-850 border-blue-500/30 shadow-xs text-zinc-100'
                  }`}
                >
                  {/* Unread indicator dot */}
                  {!item.is_read && (
                    <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-blue-500" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isHw
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : isSch
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {isHw ? (
                        <BookOpen className="w-4 h-4" />
                      ) : isSch ? (
                        <Calendar className="w-4 h-4" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            isHw
                              ? 'bg-blue-500/20 text-blue-400'
                              : isSch
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          {isHw ? 'Д/З' : isSch ? 'Расписание' : 'Инфо'}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {formatTimeAgo(item.created_at)}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-zinc-100 mt-1 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-zinc-800/60">
                        <button
                          onClick={() => handleOpenItem(item)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <span>{isHw ? 'К домашке' : isSch ? 'К расписанию' : 'Открыть'}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-2">
                          {!item.is_read && (
                            <button
                              onClick={() => markAsRead(item.id)}
                              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              Прочитано
                            </button>
                          )}
                          <button
                            onClick={() => removeNotification(item.id)}
                            className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
