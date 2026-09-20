import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  getAssignments,
  createAssignment,
  toggleAssignmentCompleted,
  deleteAssignment,
} from '../services/assignments';
import { getSubjects, createSubject } from '../services/subjects';
import { Assignment, Subject } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { formatDateCustom, getDaysUntil } from '../utils/format';
import {
  CheckSquare,
  Plus,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Filter,
  Check,
} from 'lucide-react';

type HomeworkFilter = 'all' | 'today' | 'overdue' | 'completed';

export function HomeworkPage() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeFilter, setActiveFilter] = useState<HomeworkFilter>('all');
  const [loading, setLoading] = useState(true);

  // Add Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    // Tomorrow by default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const hwList = await getAssignments(user.id);
      setAssignments(hwList);

      if (profile?.class_id) {
        const subs = await getSubjects(profile.class_id);
        setSubjects(subs);
        if (subs.length > 0 && !subjectId) {
          setSubjectId(subs[0].id);
        }
      }
    } catch (err: any) {
      console.error('Homework load error:', err);
      showToast('Ошибка при загрузке домашнего задания', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleHwEvent = () => {
      loadData();
    };
    window.addEventListener('schoolhub_homework_event', handleHwEvent);
    return () => {
      window.removeEventListener('schoolhub_homework_event', handleHwEvent);
    };
  }, [user, profile?.class_id]);

  const handleToggle = async (assignment: Assignment) => {
    const nextStatus = !assignment.completed;
    try {
      await toggleAssignmentCompleted(assignment.id, nextStatus);
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignment.id ? { ...a, completed: nextStatus } : a))
      );
      showToast(nextStatus ? 'Задание отмечено выполненным!' : 'Отметка снята', 'info');
    } catch (err: any) {
      console.error('Toggle error:', err);
      showToast('Не удалось обновить статус задания', 'error');
    }
  };

  const handleSaveHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      let finalSubjectId = subjectId;

      if (isCreatingNewSubject && profile?.class_id) {
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

      const created = await createAssignment({
        user_id: user.id,
        class_id: profile?.class_id || null,
        subject_id: finalSubjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate,
      });

      setAssignments((prev) => [created, ...prev]);
      showToast('Домашнее задание добавлено', 'success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      console.error('Save assignment error:', err);
      showToast('Ошибка при сохранении задания', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteAssignment(deleteTargetId);
      setAssignments((prev) => prev.filter((a) => a.id !== deleteTargetId));
      showToast('Задание удалено', 'success');
    } catch (err: any) {
      console.error('Delete assignment error:', err);
      showToast('Не удалось удалить задание', 'error');
    } finally {
      setDeleteTargetId(null);
    }
  };

  // Filter calculations
  const filteredAssignments = assignments.filter((a) => {
    const days = getDaysUntil(a.due_date);
    if (activeFilter === 'completed') return a.completed;
    if (activeFilter === 'today') return !a.completed && days.isToday;
    if (activeFilter === 'overdue') return !a.completed && days.isPast;
    return true; // 'all'
  });

  const countToday = assignments.filter((a) => !a.completed && getDaysUntil(a.due_date).isToday).length;
  const countOverdue = assignments.filter((a) => !a.completed && getDaysUntil(a.due_date).isPast).length;
  const countCompleted = assignments.filter((a) => a.completed).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-5 h-5 text-blue-400" />
            <span>{t('homework_title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Личный дневник заданий, номеров параграфов и упражнений
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            if (subjects.length > 0 && !subjectId) setSubjectId(subjects[0].id);
          }}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{t('add_homework')}</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeFilter === 'all'
              ? 'bg-zinc-100 text-zinc-900 shadow-sm'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          {t('filter_all')} ({assignments.length})
        </button>
        <button
          onClick={() => setActiveFilter('today')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeFilter === 'today'
              ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <span>{t('filter_today')}</span>
          {countToday > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-950/40 text-amber-200 rounded-full text-[10px]">
              {countToday}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('overdue')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeFilter === 'overdue'
              ? 'bg-red-600 text-white font-bold shadow-sm'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <span>{t('filter_overdue')}</span>
          {countOverdue > 0 && (
            <span className="px-1.5 py-0.2 bg-red-950/80 text-red-200 rounded-full text-[10px]">
              {countOverdue}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('completed')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeFilter === 'completed'
              ? 'bg-emerald-600 text-white font-bold shadow-sm'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <span>{t('filter_completed')}</span>
          {countCompleted > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-950/80 text-emerald-200 rounded-full text-[10px]">
              {countCompleted}
            </span>
          )}
        </button>
      </div>

      {/* Assignment List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : filteredAssignments.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={
            activeFilter === 'completed'
              ? t('empty_homework')
              : activeFilter === 'all' && assignments.length > 0
              ? t('empty_homework_all_done')
              : t('empty_homework')
          }
          description={t('empty_homework_sub')}
          actionLabel={t('add_homework')}
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((hw) => {
            const daysInfo = getDaysUntil(hw.due_date);
            return (
              <div
                key={hw.id}
                className={`p-4 sm:p-5 rounded-2xl bg-zinc-900 border transition-all flex items-start justify-between gap-3.5 group shadow-sm ${
                  hw.completed
                    ? 'border-zinc-800/50 opacity-60'
                    : daysInfo.isPast
                    ? 'border-red-500/30'
                    : daysInfo.isToday
                    ? 'border-amber-500/30'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(hw)}
                  className="mt-0.5 p-1 rounded-lg text-zinc-400 hover:text-blue-400 transition-colors shrink-0"
                  aria-label="Переключить статус"
                >
                  {hw.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-zinc-500 hover:text-zinc-300" />
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-blue-400">
                      {hw.subject?.name || 'Предмет'}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        hw.completed
                          ? 'bg-emerald-950/60 text-emerald-300'
                          : daysInfo.isToday
                          ? 'bg-amber-950/60 text-amber-300'
                          : daysInfo.isPast
                          ? 'bg-red-950/60 text-red-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {hw.completed ? t('status_done') : daysInfo.label}
                    </span>
                  </div>

                  <h3
                    className={`text-base font-bold text-zinc-100 mt-1 leading-snug ${
                      hw.completed ? 'line-through text-zinc-500' : ''
                    }`}
                  >
                    {hw.title}
                  </h3>

                  {hw.description && (
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {hw.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-2 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span>
                      {t('due_date')}: {formatDateCustom(hw.due_date, language)}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => setDeleteTargetId(hw.id)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 transition-colors shrink-0"
                  title={t('delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Homework Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('add_homework')}
      >
        <form onSubmit={handleSaveHomework} className="space-y-4">
          {/* Subject */}
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
                placeholder="Название предмета"
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

          {/* Title / Assignment info */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Что задано (например: §12 №4–8, выучить правило)
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="§12 №4–8"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Подробности (необязательно)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Записать в тетрадь, принести циркуль..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Due date */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {t('due_date')}
              </label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDueDate(today);
                  }}
                  className="text-blue-400 hover:underline"
                >
                  Сегодня
                </button>
                <span className="text-zinc-600">•</span>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setDueDate(d.toISOString().split('T')[0]);
                  }}
                  className="text-blue-400 hover:underline"
                >
                  Завтра
                </button>
              </div>
            </div>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            />
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
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title="Удаление задания"
        message="Вы уверены, что хотите удалить это домашнее задание?"
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        isDestructive={true}
      />
    </div>
  );
}
