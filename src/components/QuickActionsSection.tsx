import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { createAssignment } from '../services/assignments';
import { addLesson } from '../services/schedule';
import { createExam } from '../services/exams';
import { getSubjects, createSubject } from '../services/subjects';
import { createGrade } from '../services/grades';
import { Subject, GradeType } from '../types';
import { Modal } from './Modal';
import {
  Zap,
  BookOpen,
  CalendarPlus,
  GraduationCap,
  Plus,
  Clock,
  Calendar,
  CheckCircle2,
  MapPin,
  User as UserIcon,
  Award,
  Star,
} from 'lucide-react';

interface QuickActionsSectionProps {
  onHomeworkAdded?: () => void;
  onScheduleAdded?: () => void;
  onExamAdded?: () => void;
  onGradeAdded?: () => void;
}

const STANDARD_TIMES = [
  { num: 1, start: '08:00', end: '08:45' },
  { num: 2, start: '08:50', end: '09:35' },
  { num: 3, start: '09:45', end: '10:30' },
  { num: 4, start: '10:40', end: '11:25' },
  { num: 5, start: '11:35', end: '12:20' },
  { num: 6, start: '12:30', end: '13:15' },
  { num: 7, start: '13:25', end: '14:10' },
];

const DAYS_OF_WEEK = [
  { id: 1, label: 'Пн', full: 'Понедельник' },
  { id: 2, label: 'Вт', full: 'Вторник' },
  { id: 3, label: 'Ср', full: 'Среда' },
  { id: 4, label: 'Чт', full: 'Четверг' },
  { id: 5, label: 'Пт', full: 'Пятница' },
  { id: 6, label: 'Сб', full: 'Суббота' },
];

export function QuickActionsSection({
  onHomeworkAdded,
  onScheduleAdded,
  onExamAdded,
  onGradeAdded,
}: QuickActionsSectionProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Modals state
  const [isHwModalOpen, setIsHwModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);

  // Homework Form State
  const [hwSubjectId, setHwSubjectId] = useState('');
  const [hwNewSubjectName, setHwNewSubjectName] = useState('');
  const [hwIsCreatingSubject, setHwIsCreatingSubject] = useState(false);
  const [hwTitle, setHwTitle] = useState('');
  const [hwDescription, setHwDescription] = useState('');
  const [hwDueDate, setHwDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [hwSubmitting, setHwSubmitting] = useState(false);

  // Schedule Event Form State
  const [schedDay, setSchedDay] = useState<number>(() => {
    const today = new Date().getDay();
    return today >= 1 && today <= 6 ? today : 1;
  });
  const [schedLessonNum, setSchedLessonNum] = useState<number>(1);
  const [schedStartTime, setSchedStartTime] = useState('08:00');
  const [schedEndTime, setSchedEndTime] = useState('08:45');
  const [schedSubjectId, setSchedSubjectId] = useState('');
  const [schedNewSubjectName, setSchedNewSubjectName] = useState('');
  const [schedIsCreatingSubject, setSchedIsCreatingSubject] = useState(false);
  const [schedRoom, setSchedRoom] = useState('');
  const [schedTeacher, setSchedTeacher] = useState('');
  const [schedSubmitting, setSchedSubmitting] = useState(false);

  // Exam Form State
  const [examSubjectId, setExamSubjectId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [examDescription, setExamDescription] = useState('');
  const [examSubmitting, setExamSubmitting] = useState(false);

  // Grade Form State
  const [gradeSubjectId, setGradeSubjectId] = useState('');
  const [gradeValue, setGradeValue] = useState<number>(5);
  const [gradeType, setGradeType] = useState<GradeType>('classwork');
  const [gradeTopic, setGradeTopic] = useState('');
  const [gradeDate, setGradeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [gradeSubmitting, setGradeSubmitting] = useState(false);

  // Load subjects
  useEffect(() => {
    async function loadSubs() {
      if (!profile?.class_id) return;
      try {
        const subs = await getSubjects(profile.class_id);
        setSubjects(subs);
        if (subs.length > 0) {
          setHwSubjectId((prev) => prev || subs[0].id);
          setSchedSubjectId((prev) => prev || subs[0].id);
          setExamSubjectId((prev) => prev || subs[0].id);
          setGradeSubjectId((prev) => prev || subs[0].id);
        }
      } catch (err) {
        console.warn('Error loading subjects for quick actions:', err);
      }
    }
    loadSubs();
  }, [profile?.class_id]);

  // Quick preset dates for Homework
  const setPresetDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setHwDueDate(d.toISOString().split('T')[0]);
  };

  // Change lesson number and auto-fill times
  const handleLessonNumChange = (num: number) => {
    setSchedLessonNum(num);
    const standard = STANDARD_TIMES.find((t) => t.num === num);
    if (standard) {
      setSchedStartTime(standard.start);
      setSchedEndTime(standard.end);
    }
  };

  // Save Homework
  const handleSaveHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Требуется авторизация', 'error');
      return;
    }

    setHwSubmitting(true);
    try {
      let finalSubjectId = hwSubjectId;

      if (hwIsCreatingSubject && profile?.class_id) {
        if (!hwNewSubjectName.trim()) {
          showToast('Укажите название предмета', 'error');
          setHwSubmitting(false);
          return;
        }
        const createdSub = await createSubject(profile.class_id, hwNewSubjectName.trim());
        setSubjects((prev) => [...prev, createdSub]);
        finalSubjectId = createdSub.id;
      }

      if (!finalSubjectId) {
        showToast('Выберите предмет', 'error');
        setHwSubmitting(false);
        return;
      }

      await createAssignment({
        user_id: user.id,
        class_id: profile?.class_id || null,
        subject_id: finalSubjectId,
        title: hwTitle.trim(),
        description: hwDescription.trim() || undefined,
        due_date: hwDueDate,
      });

      showToast('Домашнее задание успешно добавлено!', 'success');
      setIsHwModalOpen(false);
      setHwTitle('');
      setHwDescription('');
      setHwIsCreatingSubject(false);
      setHwNewSubjectName('');
      onHomeworkAdded?.();
    } catch (err: any) {
      console.error('Quick homework save error:', err);
      showToast('Ошибка при сохранении домашнего задания', 'error');
    } finally {
      setHwSubmitting(false);
    }
  };

  // Save Schedule Event
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.class_id) {
      showToast('Сначала присоединитесь к классу', 'error');
      return;
    }

    setSchedSubmitting(true);
    try {
      let finalSubjectId = schedSubjectId;

      if (schedIsCreatingSubject) {
        if (!schedNewSubjectName.trim()) {
          showToast('Укажите название предмета', 'error');
          setSchedSubmitting(false);
          return;
        }
        const createdSub = await createSubject(profile.class_id, schedNewSubjectName.trim());
        setSubjects((prev) => [...prev, createdSub]);
        finalSubjectId = createdSub.id;
      }

      if (!finalSubjectId) {
        showToast('Выберите предмет', 'error');
        setSchedSubmitting(false);
        return;
      }

      await addLesson({
        class_id: profile.class_id,
        user_id: user.id,
        subject_id: finalSubjectId,
        day_of_week: schedDay,
        lesson_number: schedLessonNum,
        start_time: schedStartTime,
        end_time: schedEndTime,
        room: schedRoom.trim() || undefined,
        teacher: schedTeacher.trim() || undefined,
      });

      showToast('Урок добавлен в расписание!', 'success');
      setIsScheduleModalOpen(false);
      setSchedRoom('');
      setSchedTeacher('');
      setSchedIsCreatingSubject(false);
      setSchedNewSubjectName('');
      onScheduleAdded?.();
    } catch (err: any) {
      console.error('Quick schedule save error:', err);
      showToast('Ошибка при добавлении в расписание', 'error');
    } finally {
      setSchedSubmitting(false);
    }
  };

  // Save Exam
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.class_id) {
      showToast('Сначала присоединитесь к классу', 'error');
      return;
    }

    if (!examSubjectId) {
      showToast('Выберите предмет', 'error');
      return;
    }

    setExamSubmitting(true);
    try {
      await createExam({
        user_id: user.id,
        class_id: profile.class_id,
        subject_id: examSubjectId,
        title: examTitle.trim(),
        exam_date: examDate,
        description: examDescription.trim() || undefined,
      });

      showToast('Контрольная работа запланирована!', 'success');
      setIsExamModalOpen(false);
      setExamTitle('');
      setExamDescription('');
      onExamAdded?.();
    } catch (err: any) {
      console.error('Quick exam save error:', err);
      showToast('Ошибка при добавлении контрольной', 'error');
    } finally {
      setExamSubmitting(false);
    }
  };

  // Save Grade
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!gradeSubjectId) {
      showToast('Выберите предмет для оценки', 'error');
      return;
    }

    setGradeSubmitting(true);
    try {
      await createGrade({
        user_id: profile.id,
        class_id: profile.class_id,
        subject_id: gradeSubjectId,
        value: gradeValue,
        weight: gradeType === 'exam' || gradeType === 'quarter' ? 2 : gradeType === 'test' ? 1.5 : 1,
        type: gradeType,
        topic: gradeTopic.trim() || undefined,
        date: gradeDate,
      });

      showToast(`Оценка «${gradeValue}» успешно записана!`, 'success');
      setIsGradeModalOpen(false);
      setGradeTopic('');
      onGradeAdded?.();
    } catch (err: any) {
      console.error('Error recording quick grade:', err);
      showToast('Ошибка при записи оценки', 'error');
    } finally {
      setGradeSubmitting(false);
    }
  };

  return (
    <div id="quick-actions-section" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
          <span>Быстрые действия</span>
        </h2>
        <span className="text-xs text-zinc-500 font-medium">В один клик</span>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Button 1: Quick Log Homework */}
        <button
          id="quick-action-homework-btn"
          type="button"
          onClick={() => setIsHwModalOpen(true)}
          className="group relative text-left p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900 transition-all shadow-sm active:scale-[0.99] flex flex-col justify-between overflow-hidden"
        >
          <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600/25 transition-all">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="p-1 rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-blue-400 group-hover:bg-blue-600/10 transition-colors">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>

          <div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-blue-300 transition-colors">
              Записать ДЗ
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 line-clamp-1">
              Упражнения, проект
            </p>
          </div>
        </button>

        {/* Button 2: Quick Add Schedule Event */}
        <button
          id="quick-action-schedule-btn"
          type="button"
          onClick={() => setIsScheduleModalOpen(true)}
          className="group relative text-left p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all shadow-sm active:scale-[0.99] flex flex-col justify-between overflow-hidden"
        >
          <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-emerald-600/25 transition-all">
              <CalendarPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="p-1 rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-emerald-400 group-hover:bg-emerald-600/10 transition-colors">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>

          <div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">
              В расписание
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 line-clamp-1">
              Урок, факультатив
            </p>
          </div>
        </button>

        {/* Button 3: Quick Plan Exam */}
        <button
          id="quick-action-exam-btn"
          type="button"
          onClick={() => setIsExamModalOpen(true)}
          className="group relative text-left p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-900 transition-all shadow-sm active:scale-[0.99] flex flex-col justify-between overflow-hidden"
        >
          <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-purple-600/25 transition-all">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="p-1 rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-purple-400 group-hover:bg-purple-600/10 transition-colors">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>

          <div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-purple-300 transition-colors">
              Контрольная
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 line-clamp-1">
              Срез, тест, зачёт
            </p>
          </div>
        </button>

        {/* Button 4: Quick Log Grade */}
        <button
          id="quick-action-grade-btn"
          type="button"
          onClick={() => setIsGradeModalOpen(true)}
          className="group relative text-left p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900 transition-all shadow-sm active:scale-[0.99] flex flex-col justify-between overflow-hidden"
        >
          <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-500/25 transition-all">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400/20" />
            </div>
            <span className="p-1 rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-colors">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>

          <div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
              Записать оценку
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 line-clamp-1">
              Урок, тест, 2-5 балл
            </p>
          </div>
        </button>
      </div>

      {/* 1. Modal: Quick Log Homework */}
      <Modal
        isOpen={isHwModalOpen}
        onClose={() => setIsHwModalOpen(false)}
        title="Быстро записать домашнее задание"
      >
        <form onSubmit={handleSaveHomework} className="space-y-4">
          {/* Subject Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">Предмет</label>
              <button
                type="button"
                onClick={() => setHwIsCreatingSubject(!hwIsCreatingSubject)}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                {hwIsCreatingSubject ? 'Выбрать из существующих' : '+ Новый предмет'}
              </button>
            </div>

            {hwIsCreatingSubject ? (
              <input
                type="text"
                required
                value={hwNewSubjectName}
                onChange={(e) => setHwNewSubjectName(e.target.value)}
                placeholder="Например: Робототехника или Обществознание"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
            ) : (
              <select
                required
                value={hwSubjectId}
                onChange={(e) => setHwSubjectId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
                {subjects.length === 0 && (
                  <option value="">Нет предметов (создайте выше)</option>
                )}
              </select>
            )}
          </div>

          {/* Title / Assignment Content */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Что задали? *
            </label>
            <input
              type="text"
              required
              value={hwTitle}
              onChange={(e) => setHwTitle(e.target.value)}
              placeholder="Например: § 14, вопросы 1–4, № 125"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Due Date with Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Срок сдачи (дедлайн)
            </label>
            <div className="flex items-center gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setPresetDate(0)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
              >
                Сегодня
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(1)}
                className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs font-medium border border-blue-500/30 transition-colors"
              >
                Завтра
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(2)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
              >
                Через 2 дня
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(7)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
              >
                Через неделю
              </button>
            </div>
            <input
              type="date"
              required
              value={hwDueDate}
              onChange={(e) => setHwDueDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Дополнительные заметки (необязательно)
            </label>
            <textarea
              rows={2}
              value={hwDescription}
              onChange={(e) => setHwDescription(e.target.value)}
              placeholder="Ссылка на тест, указания учителя, принести чертёж..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsHwModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={hwSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-md active:scale-98"
            >
              {hwSubmitting ? 'Сохранение...' : 'Записать ДЗ'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: Quick Add Schedule Event */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Добавить урок или событие в расписание"
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          {/* Day of Week Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              День недели
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {DAYS_OF_WEEK.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSchedDay(d.id)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    schedDay === d.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">Предмет</label>
              <button
                type="button"
                onClick={() => setSchedIsCreatingSubject(!schedIsCreatingSubject)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {schedIsCreatingSubject ? 'Выбрать из существующих' : '+ Новый предмет'}
              </button>
            </div>

            {schedIsCreatingSubject ? (
              <input
                type="text"
                required
                value={schedNewSubjectName}
                onChange={(e) => setSchedNewSubjectName(e.target.value)}
                placeholder="Название предмета / кружка"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            ) : (
              <select
                required
                value={schedSubjectId}
                onChange={(e) => setSchedSubjectId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
                {subjects.length === 0 && (
                  <option value="">Нет предметов (создайте выше)</option>
                )}
              </select>
            )}
          </div>

          {/* Lesson Number & Standard Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Номер урока
              </label>
              <select
                value={schedLessonNum}
                onChange={(e) => handleLessonNumChange(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}-й урок
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Кабинет
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={schedRoom}
                  onChange={(e) => setSchedRoom(e.target.value)}
                  placeholder="304"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Custom Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Начало
              </label>
              <input
                type="time"
                required
                value={schedStartTime}
                onChange={(e) => setSchedStartTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Окончание
              </label>
              <input
                type="time"
                required
                value={schedEndTime}
                onChange={(e) => setSchedEndTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Teacher (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Учитель (необязательно)
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={schedTeacher}
                onChange={(e) => setSchedTeacher(e.target.value)}
                placeholder="Иванова А. С."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={schedSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-md active:scale-98"
            >
              {schedSubmitting ? 'Добавление...' : 'Добавить урок'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Modal: Quick Plan Exam */}
      <Modal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        title="Запланировать контрольную / срез"
      >
        <form onSubmit={handleSaveExam} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Предмет
            </label>
            <select
              required
              value={examSubjectId}
              onChange={(e) => setExamSubjectId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Название или тема среза *
            </label>
            <input
              type="text"
              required
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="Например: Итоговый срез за I четверть или Диктант"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Дата проведения *
            </label>
            <input
              type="date"
              required
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Темы для повторения
            </label>
            <textarea
              rows={2}
              value={examDescription}
              onChange={(e) => setExamDescription(e.target.value)}
              placeholder="Квадратные уравнения, теорема Виета, формулы корней..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsExamModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={examSubmitting}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-md active:scale-98"
            >
              {examSubmitting ? 'Сохранение...' : 'Запланировать'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Modal: Quick Record Grade */}
      <Modal
        isOpen={isGradeModalOpen}
        onClose={() => setIsGradeModalOpen(false)}
        title="Быстро записать оценку"
      >
        <form onSubmit={handleSaveGrade} className="space-y-4">
          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Предмет <span className="text-amber-400">*</span>
            </label>
            {subjects.length === 0 ? (
              <p className="text-xs text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                Предметы не найдены. Сначала добавьте предмет в разделе «Оценки» или «Расписание».
              </p>
            ) : (
              <select
                value={gradeSubjectId}
                onChange={(e) => setGradeSubjectId(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id} className="bg-zinc-900 text-zinc-100">
                    {sub.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Grade Buttons */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Оценка <span className="text-amber-400">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 4, 3, 2].map((val) => {
                const isSelected = gradeValue === val;
                const colors: Record<number, string> = {
                  5: isSelected ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30' : 'bg-zinc-950 text-emerald-400 border-zinc-800 hover:border-emerald-500/50',
                  4: isSelected ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30' : 'bg-zinc-950 text-blue-400 border-zinc-800 hover:border-blue-500/50',
                  3: isSelected ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-600/30' : 'bg-zinc-950 text-amber-400 border-zinc-800 hover:border-amber-500/50',
                  2: isSelected ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30' : 'bg-zinc-950 text-red-400 border-zinc-800 hover:border-red-500/50',
                };
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setGradeValue(val)}
                    className={`py-3 rounded-xl font-black text-lg border transition-all active:scale-95 ${colors[val]}`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Тип работы
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { id: 'classwork', label: 'Работа на уроке' },
                { id: 'homework', label: 'Домашняя работа' },
                { id: 'test', label: 'Самостоятельная' },
                { id: 'exam', label: 'Контрольная' },
                { id: 'oral', label: 'Ответ у доски' },
                { id: 'quiz', label: 'Тест' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGradeType(item.id as GradeType)}
                  className={`py-2 px-2.5 rounded-lg border text-center font-medium transition-all ${
                    gradeType === item.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic / Comment */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Тема или комментарий
            </label>
            <input
              type="text"
              value={gradeTopic}
              onChange={(e) => setGradeTopic(e.target.value)}
              placeholder="Например: Параграф 12, формула Бернулли"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Дата
            </label>
            <input
              type="date"
              value={gradeDate}
              onChange={(e) => setGradeDate(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsGradeModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={gradeSubmitting || subjects.length === 0}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-md active:scale-98"
            >
              {gradeSubmitting ? 'Сохранение...' : 'Записать оценку'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
