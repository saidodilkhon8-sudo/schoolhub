import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  getScheduleForClass,
  addLesson,
  updateLesson,
  deleteLesson,
  reorderLessonNumber,
} from '../services/schedule';
import { getSubjects, createSubject } from '../services/subjects';
import { ScheduleLesson, Subject } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  MapPin,
  User,
  BookOpen,
} from 'lucide-react';

const STANDARD_TIMES = [
  { num: 1, start: '08:00', end: '08:45' },
  { num: 2, start: '08:50', end: '09:35' },
  { num: 3, start: '09:45', end: '10:30' },
  { num: 4, start: '10:40', end: '11:25' },
  { num: 5, start: '11:35', end: '12:20' },
  { num: 6, start: '12:30', end: '13:15' },
  { num: 7, start: '13:25', end: '14:10' },
];

export function SchedulePage() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDay();
    return today >= 1 && today <= 6 ? today : 1; // 1=Пн
  });

  const [allLessons, setAllLessons] = useState<ScheduleLesson[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<ScheduleLesson | null>(null);

  // Form Fields
  const [subjectId, setSubjectId] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);
  const [lessonNumber, setLessonNumber] = useState<number>(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:45');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Dialog state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadData = async () => {
    if (!profile?.class_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [lessons, subs] = await Promise.all([
        getScheduleForClass(profile.class_id),
        getSubjects(profile.class_id),
      ]);
      setAllLessons(lessons);
      setSubjects(subs);
    } catch (err: any) {
      console.error('Error loading schedule:', err);
      showToast('Ошибка при загрузке расписания', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleSchEvent = () => {
      loadData();
    };
    window.addEventListener('schoolhub_schedule_event', handleSchEvent);
    return () => {
      window.removeEventListener('schoolhub_schedule_event', handleSchEvent);
    };
  }, [profile?.class_id]);

  const currentDayLessons = allLessons
    .filter((l) => l.day_of_week === selectedDay)
    .sort((a, b) => a.lesson_number - b.lesson_number);

  const openAddModal = () => {
    setEditingLesson(null);
    const nextNum = currentDayLessons.length > 0
      ? Math.max(...currentDayLessons.map((l) => l.lesson_number)) + 1
      : 1;
    const stdTime = STANDARD_TIMES.find((t) => t.num === nextNum) || { start: '08:00', end: '08:45' };

    setLessonNumber(nextNum);
    setStartTime(stdTime.start);
    setEndTime(stdTime.end);
    setSubjectId(subjects[0]?.id || '');
    setNewSubjectName('');
    setIsCreatingNewSubject(false);
    setRoom('');
    setTeacher('');
    setIsModalOpen(true);
  };

  const openEditModal = (lesson: ScheduleLesson) => {
    setEditingLesson(lesson);
    setLessonNumber(lesson.lesson_number);
    setStartTime(lesson.start_time);
    setEndTime(lesson.end_time);
    setSubjectId(lesson.subject_id);
    setIsCreatingNewSubject(false);
    setRoom(lesson.room || '');
    setTeacher(lesson.teacher || '');
    setIsModalOpen(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.class_id || !user) return;

    setSubmitting(true);
    try {
      let finalSubjectId = subjectId;

      if (isCreatingNewSubject) {
        if (!newSubjectName.trim()) {
          showToast('Укажите название предмета', 'error');
          setSubmitting(false);
          return;
        }
        const createdSub = await createSubject(profile.class_id, newSubjectName.trim());
        setSubjects((prev) => [...prev, createdSub]);
        finalSubjectId = createdSub.id;
      }

      if (!finalSubjectId) {
        showToast('Выберите предмет', 'error');
        setSubmitting(false);
        return;
      }

      if (editingLesson) {
        // Update
        const updated = await updateLesson(editingLesson.id, {
          subject_id: finalSubjectId,
          lesson_number: lessonNumber,
          start_time: startTime,
          end_time: endTime,
          room: room.trim() || null,
          teacher: teacher.trim() || null,
        });
        setAllLessons((prev) =>
          prev.map((l) => (l.id === updated.id ? updated : l))
        );
        showToast('Урок обновлен', 'success');
      } else {
        // Add
        const added = await addLesson({
          class_id: profile.class_id,
          user_id: user.id,
          subject_id: finalSubjectId,
          day_of_week: selectedDay,
          lesson_number: lessonNumber,
          start_time: startTime,
          end_time: endTime,
          room,
          teacher,
        });
        setAllLessons((prev) => [...prev, added]);
        showToast('Урок добавлен в расписание', 'success');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save lesson error:', err);
      showToast('Ошибка при сохранении урока', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteLesson(deleteTargetId);
      setAllLessons((prev) => prev.filter((l) => l.id !== deleteTargetId));
      showToast('Урок удален', 'success');
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast('Не удалось удалить урок', 'error');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleMoveLesson = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentDayLessons.length) return;

    const current = currentDayLessons[index];
    const sibling = currentDayLessons[targetIndex];

    const currentNum = current.lesson_number;
    const siblingNum = sibling.lesson_number;

    try {
      // Swap lesson numbers in database
      await Promise.all([
        reorderLessonNumber(current.id, siblingNum),
        reorderLessonNumber(sibling.id, currentNum),
      ]);

      setAllLessons((prev) =>
        prev.map((l) => {
          if (l.id === current.id) return { ...l, lesson_number: siblingNum };
          if (l.id === sibling.id) return { ...l, lesson_number: currentNum };
          return l;
        })
      );
      showToast('Порядок изменен', 'info');
    } catch (err: any) {
      console.error('Reorder error:', err);
      showToast('Не удалось изменить порядок', 'error');
    }
  };

  const days: { id: number; label: string; short: string }[] = [
    { id: 1, label: t('day_1'), short: 'Пн' },
    { id: 2, label: t('day_2'), short: 'Вт' },
    { id: 3, label: t('day_3'), short: 'Ср' },
    { id: 4, label: t('day_4'), short: 'Чт' },
    { id: 5, label: t('day_5'), short: 'Пт' },
    { id: 6, label: t('day_6'), short: 'Сб' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span>{t('schedule_title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Управляй звонками, номерами кабинетов и расписанием предметов
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{t('add_lesson')}</span>
        </button>
      </div>

      {/* Days Tabs (Monday to Saturday) */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto no-scrollbar">
        {days.map((d) => {
          const isActive = selectedDay === d.id;
          const count = allLessons.filter((l) => l.day_of_week === d.id).length;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDay(d.id)}
              className={`flex-1 min-w-[50px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex flex-col items-center gap-0.5 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <span className="hidden sm:inline">{d.label}</span>
              <span className="sm:hidden">{d.short}</span>
              <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-zinc-500'}`}>
                {count > 0 ? `${count} ур.` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lessons List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : currentDayLessons.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={t('empty_schedule')}
          description={t('empty_schedule_sub')}
          actionLabel={t('add_lesson')}
          onAction={openAddModal}
        />
      ) : (
        <div className="space-y-3">
          {currentDayLessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group shadow-sm"
            >
              {/* Left Info */}
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center font-mono font-bold text-sm text-blue-400 shrink-0">
                  {lesson.lesson_number}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-100 truncate">
                      {lesson.subject?.name || 'Предмет'}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                    <span className="flex items-center gap-1 font-mono text-zinc-300">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      {lesson.start_time} — {lesson.end_time}
                    </span>
                    {lesson.room && (
                      <span className="flex items-center gap-1 text-zinc-300">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        {t('room_short')} {lesson.room}
                      </span>
                    )}
                    {lesson.teacher && (
                      <span className="flex items-center gap-1 text-zinc-400">
                        <User className="w-3.5 h-3.5 text-zinc-500" />
                        {lesson.teacher}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions: Reorder, Edit, Delete */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800/60 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleMoveLesson(idx, 'up')}
                  disabled={idx === 0}
                  className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-zinc-800/80 transition-colors"
                  title="Переместить выше"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleMoveLesson(idx, 'down')}
                  disabled={idx === currentDayLessons.length - 1}
                  className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-zinc-800/80 transition-colors"
                  title="Переместить ниже"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEditModal(lesson)}
                  className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-blue-400 transition-colors ml-1"
                  title={t('edit_lesson')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteTargetId(lesson.id)}
                  className="p-2 rounded-lg bg-zinc-800/80 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors"
                  title={t('delete_lesson')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Lesson Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLesson ? t('edit_lesson') : t('add_lesson')}
      >
        <form onSubmit={handleSaveLesson} className="space-y-4">
          {/* Subject Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {t('select_subject')}
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewSubject(!isCreatingNewSubject)}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                {isCreatingNewSubject ? '← Выбрать из списка' : t('or_create_subject')}
              </button>
            </div>

            {isCreatingNewSubject ? (
              <input
                type="text"
                required
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Например: Астрономия, Право, Робототехника"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            ) : (
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Lesson Number & Timing */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {t('lesson_number')}
              </label>
              <input
                type="number"
                min={1}
                max={12}
                required
                value={lessonNumber}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLessonNumber(val);
                  const std = STANDARD_TIMES.find((s) => s.num === val);
                  if (std && !editingLesson) {
                    setStartTime(std.start);
                    setEndTime(std.end);
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Начало
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Конец
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Room & Teacher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {t('room_short')} (кабинет)
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Например: 12, Спортзал"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {t('teacher_short')} (необязательно)
              </label>
              <input
                type="text"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="Имя учителя"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {submitting ? t('loading') : t('save_lesson')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title="Удаление урока"
        message="Вы уверены, что хотите удалить этот урок из расписания?"
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        isDestructive={true}
      />
    </div>
  );
}
