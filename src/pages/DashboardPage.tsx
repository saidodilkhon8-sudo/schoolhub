import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getScheduleForClass } from '../services/schedule';
import { getAssignments, toggleAssignmentCompleted } from '../services/assignments';
import { getExams } from '../services/exams';
import { getClassMessages } from '../services/messages';
import { getSchoolById } from '../services/schools';
import { getGrades, calculateOverallGPA, OverallGPAAnalytics } from '../services/grades';
import { ScheduleLesson, Assignment, Exam, Message, School, Grade } from '../types';
import { NavTab } from '../components/Navigation';
import { DailyOverviewCard } from '../components/DailyOverviewCard';
import { QuickActionsSection } from '../components/QuickActionsSection';
import { formatDateCustom, getDaysUntil, formatTimeAgo } from '../utils/format';
import {
  Clock,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  ArrowRight,
  Sparkles,
  MapPin,
  ChevronRight,
  Plus,
  GraduationCap,
  Award,
  TrendingUp,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { profile } = useAuth();
  const { language, t } = useLanguage();

  const [lessonsToday, setLessonsToday] = useState<ScheduleLesson[]>([]);
  const [pendingHomework, setPendingHomework] = useState<Assignment[]>([]);
  const [allHomework, setAllHomework] = useState<Assignment[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [nearestExam, setNearestExam] = useState<Exam | null>(null);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [gpaStats, setGpaStats] = useState<OverallGPAAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Time-of-day greeting (e.g., Добрый день, Said)
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t('greeting_morning');
    if (hour >= 12 && hour < 18) return t('greeting_afternoon');
    return t('greeting_evening');
  };

  const loadDashboardData = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // Today's day of week (1=Monday ... 6=Saturday, 0=Sunday)
      const currentDayIndex = new Date().getDay();
      const currentDayOfWeek = currentDayIndex === 0 ? 7 : currentDayIndex; // Sunday is 7, lessons 1..6

      const promises: Promise<any>[] = [];

      // 1. Schedule
      if (profile.class_id) {
        promises.push(getScheduleForClass(profile.class_id));
      } else {
        promises.push(Promise.resolve([]));
      }

      // 2. Homework
      promises.push(getAssignments(profile.id));

      // 3. Exams
      if (profile.class_id) {
        promises.push(getExams(profile.class_id));
      } else {
        promises.push(Promise.resolve([]));
      }

      // 4. Messages
      if (profile.class_id) {
        promises.push(getClassMessages(profile.class_id));
      } else {
        promises.push(Promise.resolve([]));
      }

      // 5. School
      if (profile.school_id) {
        promises.push(getSchoolById(profile.school_id));
      } else {
        promises.push(Promise.resolve(null));
      }

      // 6. Grades
      promises.push(getGrades(profile.id));

      const [scheduleRes, hwRes, examsRes, msgsRes, schoolRes, gradesRes] = await Promise.all(promises);

      // Filter lessons for today
      const todayLessons = (scheduleRes as ScheduleLesson[])
        .filter((l) => l.day_of_week === currentDayOfWeek)
        .sort((a, b) => a.lesson_number - b.lesson_number);
      setLessonsToday(todayLessons);

      // Store all homework & pending homework
      const fetchedHw = (hwRes as Assignment[]) || [];
      setAllHomework(fetchedHw);
      const pending = fetchedHw
        .filter((a) => !a.completed)
        .slice(0, 6);
      setPendingHomework(pending);

      // Exams
      const fetchedExams = (examsRes as Exam[]) || [];
      setAllExams(fetchedExams);
      const upcomingExams = fetchedExams.filter((e) => {
        const { isPast } = getDaysUntil(e.exam_date);
        return !isPast;
      });
      setNearestExam(upcomingExams[0] || null);

      // Recent messages (last 3)
      const last3Msgs = (msgsRes as Message[]).slice(-3).reverse();
      setRecentMessages(last3Msgs);

      if (schoolRes) {
        setSchool(schoolRes);
      }

      // Overall GPA & grades
      if (gradesRes) {
        const stats = calculateOverallGPA(gradesRes as Grade[]);
        setGpaStats(stats);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleToggleHomework = async (id: string, completed: boolean) => {
    setAllHomework((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed } : item))
    );
    setPendingHomework((prev) => {
      if (completed) {
        return prev.filter((item) => item.id !== id);
      }
      const restored = allHomework.find((a) => a.id === id);
      return restored ? [...prev, { ...restored, completed: false }] : prev;
    });

    try {
      await toggleAssignmentCompleted(id, completed);
    } catch (err) {
      console.warn('Error toggling homework completion:', err);
    }
  };

  const todayFormatted = formatDateCustom(new Date(), language);

  // Split lessons into: nearest and following
  const nearestLesson = lessonsToday[0];
  const nextLessons = lessonsToday.slice(1);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 md:pb-8">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight">
              {getGreeting()}, {profile?.first_name || 'Ученик'}
            </h1>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Онлайн" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-400 mt-1.5">
            <span>{t('today_is')}: <strong className="text-zinc-200 font-semibold">{todayFormatted}</strong></span>
            {school && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-300 font-medium">{school.name}</span>
              </>
            )}
            {profile?.grade && profile?.letter && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-bold text-xs border border-blue-500/20">
                  {profile.grade}-{profile.letter}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate('grades')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all active:scale-[0.98] shadow-xs"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Оценки</span>
          </button>
          <button
            onClick={() => onNavigate('homework')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700/80 transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Домашка</span>
          </button>
          <button
            onClick={() => onNavigate('schedule')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700/80 transition-all active:scale-[0.98]"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Расписание</span>
          </button>
        </div>
      </div>

      {/* Quick Actions Section */}
      <QuickActionsSection
        onHomeworkAdded={loadDashboardData}
        onScheduleAdded={loadDashboardData}
        onExamAdded={loadDashboardData}
        onGradeAdded={loadDashboardData}
      />

      {/* Daily Overview Card: At-a-glance Schedule & Upcoming Deadlines */}
      <DailyOverviewCard
        lessonsToday={lessonsToday}
        pendingHomework={pendingHomework}
        allHomework={allHomework}
        exams={allExams}
        loading={loading}
        onNavigate={onNavigate}
        onToggleHomework={handleToggleHomework}
        language={language}
      />

      {/* Main Grid: Lessons & Upcoming Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schedule today */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Уроки на сегодня</span>
            </h2>
            <button
              onClick={() => onNavigate('schedule')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
            >
              <span>Всё расписание</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-24 bg-zinc-900/60 rounded-2xl animate-pulse border border-zinc-800" />
              <div className="h-16 bg-zinc-900/40 rounded-2xl animate-pulse border border-zinc-800/60" />
            </div>
          ) : lessonsToday.length === 0 ? (
            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 text-center">
              <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-200">{t('no_lessons_today')}</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {new Date().getDay() === 0
                  ? 'Сегодня воскресенье — отличный день для отдыха!'
                  : 'Расписание на сегодня пустое. Ты можешь заполнить его в разделе «Расписание».'}
              </p>
              <button
                onClick={() => onNavigate('schedule')}
                className="mt-3.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700"
              >
                + Добавить уроки
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Nearest Lesson (Card 1) */}
              {nearestLesson && (
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-blue-500/40 shadow-lg shadow-blue-950/20 relative overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-blue-500" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-blue-400 font-bold">
                        {t('nearest_lesson')} • №{nearestLesson.lesson_number}
                      </span>
                      <h3 className="text-lg font-extrabold text-zinc-100 mt-0.5">
                        {nearestLesson.subject?.name || 'Предмет'}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-2">
                        <span className="flex items-center gap-1 font-mono font-medium text-zinc-300">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          {nearestLesson.start_time} — {nearestLesson.end_time}
                        </span>
                        {nearestLesson.room && (
                          <span className="flex items-center gap-1 text-zinc-300">
                            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                            {t('room_short')} {nearestLesson.room}
                          </span>
                        )}
                        {nearestLesson.teacher && (
                          <span className="hidden sm:inline text-zinc-400">
                            {nearestLesson.teacher}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-600/15 text-blue-400 font-mono font-bold text-xs">
                        {nearestLesson.start_time}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Next lessons list */}
              {nextLessons.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {t('next_lessons')}
                  </span>
                  {nextLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {lesson.lesson_number}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-200 leading-tight">
                            {lesson.subject?.name || 'Предмет'}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                            {lesson.room && <span>Каб. {lesson.room}</span>}
                            {lesson.teacher && (
                              <span className="hidden sm:inline">• {lesson.teacher}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-mono text-zinc-400 font-medium">
                        {lesson.start_time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent Homework Preview */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t('dashboard_hw_title')}</span>
              </h2>
              <button
                onClick={() => onNavigate('homework')}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                <span>{t('view_all')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="h-20 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800" />
            ) : pendingHomework.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center">
                <p className="text-xs text-zinc-400">
                  {t('empty_homework_all_done')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {pendingHomework.map((hw) => {
                  const daysInfo = getDaysUntil(hw.due_date);
                  return (
                    <div
                      key={hw.id}
                      onClick={() => onNavigate('homework')}
                      className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-blue-400 truncate">
                          {hw.subject?.name || 'Предмет'}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            daysInfo.isToday
                              ? 'bg-amber-500/20 text-amber-300'
                              : daysInfo.isPast
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {daysInfo.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-200 mt-1 line-clamp-1">
                        {hw.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Grades GPA, Nearest Exam & Chat preview */}
        <div className="space-y-6">
          {/* Academic Performance & GPA Progress Card */}
          <div id="dashboard-grades-card" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-400" />
                <span>Успеваемость и оценки</span>
              </h2>
              <button
                onClick={() => onNavigate('grades')}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                <span>Все оценки</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="h-24 bg-zinc-950/60 rounded-xl animate-pulse border border-zinc-800/80" />
            ) : gpaStats ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                      {gpaStats.gpa5 > 0 ? gpaStats.gpa5.toFixed(2) : '—'}
                    </span>
                    <span className="text-xs text-zinc-400 ml-1.5 font-medium">/ 5.00 средний балл</span>
                  </div>

                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {gpaStats.academicTitle}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="relative h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, gpaStats.percentage))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Пятёрок: {gpaStats.distribution.fives}</span>
                    <span>Четвёрок: {gpaStats.distribution.fours}</span>
                    <span className="text-zinc-300 font-bold">{gpaStats.percentage}% от максимума</span>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('grades')}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 border border-zinc-800 flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Открыть калькулятор цели и предметы</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-zinc-950/60 rounded-xl text-center text-xs text-zinc-400">
                Нет оценок. Нажмите «Все оценки», чтобы добавить.
              </div>
            )}
          </div>

          {/* Nearest Exam Card */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>{t('dashboard_exams_title')}</span>
              </h2>
            </div>

            {loading ? (
              <div className="h-28 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800" />
            ) : !nearestExam ? (
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center">
                <p className="text-xs text-zinc-400">
                  {t('empty_exams')}
                </p>
                <button
                  onClick={() => onNavigate('class')}
                  className="mt-2 text-xs text-blue-400 hover:underline font-semibold"
                >
                  + Запланировать срез/контрольную
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-purple-500/30 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                    Контрольная
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300">
                    {getDaysUntil(nearestExam.exam_date).label}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-zinc-100 mt-1.5">
                  {nearestExam.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {nearestExam.subject?.name || 'Предмет'} • {formatDateCustom(nearestExam.exam_date, language)}
                </p>
                {nearestExam.description && (
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2 italic">
                    «{nearestExam.description}»
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Recent Messages Card */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-400" />
                <span>{t('dashboard_chat_title')}</span>
              </h2>
              <button
                onClick={() => onNavigate('class')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                В чат →
              </button>
            </div>

            {loading ? (
              <div className="h-28 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800" />
            ) : recentMessages.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center">
                <p className="text-xs text-zinc-400">
                  {t('empty_chat')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => onNavigate('class')}
                    className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-zinc-200 truncate">
                        {msg.profile?.first_name} {msg.profile?.last_name}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatTimeAgo(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 line-clamp-2">
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
