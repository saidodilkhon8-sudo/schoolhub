import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { BookOpen, Calendar, X, ArrowRight, BellRing } from 'lucide-react';
import { NavTab } from './Navigation';

export function RealtimeAlertBanner() {
  const { activeAlert, dismissActiveAlert, markAsRead, navigateTab } = useNotifications();

  if (!activeAlert) return null;

  const isHomework = activeAlert.type === 'homework';
  const isSchedule = activeAlert.type === 'schedule';

  const handleAction = () => {
    markAsRead(activeAlert.id);
    dismissActiveAlert();

    const targetTab: NavTab = activeAlert.link_tab || (isHomework ? 'homework' : isSchedule ? 'schedule' : 'dashboard');
    navigateTab(targetTab);
  };

  return (
    <div className="fixed top-5 right-4 sm:right-6 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-auto animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl p-4 shadow-2xl shadow-black/60 flex items-start gap-3.5 relative overflow-hidden">
        {/* Left accent bar */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 ${
            isHomework ? 'bg-blue-500' : isSchedule ? 'bg-emerald-500' : 'bg-purple-500'
          }`}
        />

        {/* Type Icon */}
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            isHomework
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : isSchedule
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
          }`}
        >
          {isHomework ? (
            <BookOpen className="w-5 h-5" />
          ) : isSchedule ? (
            <Calendar className="w-5 h-5" />
          ) : (
            <BellRing className="w-5 h-5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                isHomework
                  ? 'bg-blue-500/20 text-blue-300'
                  : isSchedule
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-purple-500/20 text-purple-300'
              }`}
            >
              {isHomework ? 'Домашка' : isSchedule ? 'Расписание' : 'Уведомление'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] text-zinc-400">Realtime</span>
          </div>

          <h4 className="text-sm font-bold text-zinc-100 leading-snug line-clamp-1">
            {activeAlert.title}
          </h4>
          <p className="text-xs text-zinc-300 mt-1 leading-relaxed line-clamp-2">
            {activeAlert.message}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleAction}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all active:scale-[0.98] shadow-sm ${
                isHomework
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
              }`}
            >
              <span>Посмотреть</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={dismissActiveAlert}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={dismissActiveAlert}
          className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Закрыть уведомление"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
