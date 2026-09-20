import React, { useMemo, useState } from 'react';
import { ScheduleLesson, Assignment, Exam } from '../types';
import { NavTab } from '../components/Navigation';
import { formatDateCustom, getDaysUntil } from '../utils/format';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  GraduationCap,
  ChevronRight,
  Sparkles,
  Plus,
  MapPin,
  Check,
  CalendarCheck2,
} from 'lucide-react';

interface DailyOverviewCardProps {
  lessonsToday: ScheduleLesson[];
  pendingHomework: Assignment[];
  allHomework?: Assignment[];
  exams: Exam[];
  loading?: boolean;
  onNavigate: (tab: NavTab) => void;
  onToggleHomework?: (id: string, completed: boolean) => Promise<void>;
  language?: 'ru' | 'uz' | 'en';
}

interface UnifiedDeadline {
  id: string;
  type: 'homework' | 'exam';
  title: string;
  subjectName: string;
  dueDate: string;
  daysInfo: { days: number; isToday: boolean; isPast: boolean; label: string };
  completed?: boolean;
  description?: string | null;
}

export function DailyOverviewCard({
  lessonsToday,
  pendingHomework,
  allHomework = [],
  exams,
  loading = false,
  onNavigate,
  onToggleHomework,
  language = 'ru',
}: DailyOverviewCardProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Parse "HH:MM" string to minutes from midnight
  const parseTimeToMinutes = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  // Determine current lesson status based on time
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const lessonsWithStatus = useMemo(() => {
    let foundNext = false;
    return lessonsToday.map((lesson) => {
      const startMin = parseTimeToMinutes(lesson.start_time);
      const endMin = parseTimeToMinutes(lesson.end_time);

      let status: 'current' | 'next' | 'past' | 'upcoming' = 'upcoming';

      if (startMin !== null && endMin !== null) {
        if (currentMinutes >= startMin && currentMinutes <= endMin) {
          status = 'current';
        } else if (currentMinutes > endMin) {
          status = 'past';
        } else if (currentMinutes < startMin && !foundNext) {
          status = 'next';
          foundNext = true;
        }
      }

      return {
        ...lesson,
        status,
      };
    });
  }, [lessonsToday, currentMinutes]);

  // Combine homework and upcoming exams into unified deadlines queue
  const upcomingDeadlines = useMemo<UnifiedDeadline[]>(() => {
    const list: UnifiedDeadline[] = [];

    // Pending homework
    pendingHomework.forEach((hw) => {
      const daysInfo = getDaysUntil(hw.due_date);
      list.push({
        id: hw.id,
        type: 'homework',
        title: hw.title,
        subjectName: hw.subject?.name || 'Предмет',
        dueDate: hw.due_date,
        daysInfo,
        completed: hw.completed,
      });
    });

    // Upcoming exams
    exams.forEach((ex) => {
      const daysInfo = getDaysUntil(ex.exam_date);
      if (!daysInfo.isPast || daysInfo.isToday) {
        list.push({
          id: ex.id,
          type: 'exam',
          title: ex.title,
          subjectName: ex.subject?.name || 'Предмет',
          dueDate: ex.exam_date,
          daysInfo,
          completed: false,
          description: ex.description,
        });
      }
    });

    // Sort by due date ascending
    list.sort((a, b) => {
      const timeA = new Date(a.dueDate).getTime();
      const timeB = new Date(b.dueDate).getTime();
      return timeA - timeB;
    });

    return list.slice(0, 5);
  }, [pendingHomework, exams]);

  const handleToggle = async (hwId: string, currentCompleted: boolean) => {
    if (!onToggleHomework || togglingId) return;
    setTogglingId(hwId);
    try {
      await onToggleHomework(hwId, !currentCompleted);
    } finally {
      setTogglingId(null);
    }
  };

  const todayFormatted = formatDateCustom(now, language);
  const urgentCount = upcomingDeadlines.filter((d) => d.daysInfo.isToday || d.daysInfo.isPast).length;
  const completedCount = allHomework.filter((h) => h.completed).length;
  const totalHomeworkCount = allHomework.length;

  return (
    <div
      id="daily-overview-card"
      className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-5 sm:p-6 shadow-md transition-all"
    >
      {/* Header with Title and Quick Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                Обзор дня
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-medium">
                {todayFormatted}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Расписание и ключевые дедлайны в одном месте
            </p>
          </div>
        </div>

        {/* Status Counter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            id="overview-lessons-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-300 font-medium"
          >
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {lessonsToday.length > 0
                ? `${lessonsToday.length} уроков сегодня`
                : 'Нет уроков сегодня'}
            </span>
          </span>

          <span
            id="overview-deadlines-badge"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
              urgentCount > 0
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {urgentCount > 0 ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>{urgentCount} срочных</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Все в порядке</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Split Grid: Today's Schedule & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5">
        {/* Section 1: Today's Schedule */}
        <div id="overview-schedule-column" className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                  Расписание на сегодня
                </h3>
              </div>
              <button
                id="overview-nav-schedule-btn"
                onClick={() => onNavigate('schedule')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>Полное</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-2.5">
                <div className="h-14 bg-zinc-800/40 rounded-xl animate-pulse" />
                <div className="h-14 bg-zinc-800/30 rounded-xl animate-pulse" />
                <div className="h-14 bg-zinc-800/20 rounded-xl animate-pulse" />
              </div>
            ) : lessonsWithStatus.length === 0 ? (
              <div className="p-5 rounded-xl bg-zinc-950/50 border border-zinc-800/70 text-center flex flex-col items-center justify-center min-h-[160px]">
                <BookOpen className="w-7 h-7 text-zinc-600 mb-2" />
                <p className="text-xs font-semibold text-zinc-300">
                  {new Date().getDay() === 0
                    ? 'Воскресенье — день отдыха'
                    : 'На сегодня уроков не запланировано'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                  Можно отдохнуть или посмотреть расписание на остальные дни недели
                </p>
                <button
                  onClick={() => onNavigate('schedule')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
                >
                  Открыть расписание
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {lessonsWithStatus.map((lesson) => {
                  const isCurrent = lesson.status === 'current';
                  const isNext = lesson.status === 'next';
                  const isPast = lesson.status === 'past';

                  return (
                    <div
                      key={lesson.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-blue-600/10 border-blue-500/50 shadow-sm'
                          : isNext
                          ? 'bg-zinc-800/70 border-zinc-700'
                          : isPast
                          ? 'bg-zinc-950/40 border-zinc-800/50 opacity-60'
                          : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg text-xs font-bold font-mono flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-blue-600 text-white'
                              : isNext
                              ? 'bg-zinc-700 text-zinc-100'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {lesson.lesson_number}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`text-sm font-bold truncate ${
                                isCurrent
                                  ? 'text-blue-300'
                                  : isPast
                                  ? 'text-zinc-400 line-through'
                                  : 'text-zinc-200'
                              }`}
                            >
                              {lesson.subject?.name || 'Предмет'}
                            </h4>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider">
                                Сейчас
                              </span>
                            )}
                            {isNext && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-200 text-[10px] font-semibold">
                                Следующий
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 text-xs text-zinc-400 mt-0.5">
                            <span className="font-mono text-[11px] text-zinc-300">
                              {lesson.start_time} - {lesson.end_time}
                            </span>
                            {lesson.room && (
                              <span className="flex items-center gap-0.5 text-zinc-400 text-[11px]">
                                <MapPin className="w-3 h-3 text-zinc-500" />
                                Каб. {lesson.room}
                              </span>
                            )}
                            {lesson.teacher && (
                              <span className="hidden sm:inline text-zinc-500 text-[11px] truncate">
                                • {lesson.teacher}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <span className="font-mono text-xs text-zinc-400 font-medium">
                          {lesson.start_time}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Upcoming Deadlines */}
        <div id="overview-deadlines-column" className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                  Ближайшие дедлайны
                </h3>
              </div>
              <button
                id="overview-nav-hw-btn"
                onClick={() => onNavigate('homework')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>Все задания</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-2.5">
                <div className="h-14 bg-zinc-800/40 rounded-xl animate-pulse" />
                <div className="h-14 bg-zinc-800/30 rounded-xl animate-pulse" />
                <div className="h-14 bg-zinc-800/20 rounded-xl animate-pulse" />
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <div className="p-5 rounded-xl bg-zinc-950/50 border border-zinc-800/70 text-center flex flex-col items-center justify-center min-h-[160px]">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mb-2" />
                <p className="text-xs font-semibold text-zinc-200">
                  Все дедлайны закрыты!
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                  Нет несданных домашних заданий или срочных контрольных
                </p>
                <button
                  onClick={() => onNavigate('homework')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Записать домашку</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((item) => {
                  const isHw = item.type === 'homework';
                  const isUrgent = item.daysInfo.isToday || item.daysInfo.isPast;
                  const isTomorrow = item.daysInfo.days === 1;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isUrgent
                          ? 'bg-amber-950/20 border-amber-800/40'
                          : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isHw ? (
                          <button
                            type="button"
                            title="Отметить как выполненное"
                            disabled={togglingId === item.id}
                            onClick={() => handleToggle(item.id, !!item.completed)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              item.completed
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'border-zinc-600 hover:border-blue-400 bg-zinc-900 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        ) : (
                          <div className="w-5 h-5 rounded-md bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-blue-400 truncate">
                              {item.subjectName}
                            </span>
                            {!isHw && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-semibold">
                                Контрольная
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-xs font-semibold truncate ${
                              item.completed ? 'text-zinc-500 line-through' : 'text-zinc-200'
                            }`}
                          >
                            {item.title}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md inline-block whitespace-nowrap ${
                            item.daysInfo.isPast
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : item.daysInfo.isToday
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : isTomorrow
                              ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/20'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {item.daysInfo.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Glance Footer: Quick Stats & Progress */}
      <div className="mt-5 pt-3.5 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span>
            Выполнено ДЗ: <strong className="text-zinc-200">{completedCount}</strong> из{' '}
            <strong className="text-zinc-200">{totalHomeworkCount}</strong>
          </span>
          {totalHomeworkCount > 0 && (
            <div className="w-20 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((completedCount / totalHomeworkCount) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('homework')}
            className="text-xs text-zinc-300 hover:text-white font-medium px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 transition-colors"
          >
            + Добавить ДЗ
          </button>
          <button
            onClick={() => onNavigate('schedule')}
            className="text-xs text-zinc-300 hover:text-white font-medium px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 transition-colors"
          >
            + Расписание
          </button>
        </div>
      </div>
    </div>
  );
}
