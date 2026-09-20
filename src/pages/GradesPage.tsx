import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Subject, Grade, GradeType } from '../types';
import { getSubjects } from '../services/subjects';
import {
  getGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  calculateSubjectAnalytics,
  calculateOverallGPA,
  calculateGradesNeeded,
  GPAScale,
  SubjectAnalytics,
} from '../services/grades';
import { formatDateCustom } from '../utils/format';
import {
  GraduationCap,
  Plus,
  Calculator,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  BookOpen,
  Filter,
  CheckCircle2,
  Calendar,
  Sparkles,
  Info,
  X,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowUpDown,
  Search,
} from 'lucide-react';

interface GradesPageProps {
  onNavigate?: (tab: any) => void;
}

const GRADE_TYPES: { id: GradeType; label: string; defaultWeight: number }[] = [
  { id: 'classwork', label: 'Ответ на уроке', defaultWeight: 1 },
  { id: 'homework', label: 'Домашняя работа', defaultWeight: 1 },
  { id: 'oral', label: 'Ответ у доски', defaultWeight: 1 },
  { id: 'quiz', label: 'Самостоятельная', defaultWeight: 1.5 },
  { id: 'test', label: 'Контрольная работа', defaultWeight: 1.5 },
  { id: 'exam', label: 'Экзамен / Срез', defaultWeight: 2 },
  { id: 'quarter', label: 'Четвертная', defaultWeight: 2 },
];

export function GradesPage({ onNavigate }: GradesPageProps) {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScale, setSelectedScale] = useState<GPAScale>('5-point');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'avg-desc' | 'avg-asc' | 'name' | 'needs-attention'>('avg-desc');

  // Calculator Drawer state
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcSubjectId, setCalcSubjectId] = useState<string>('');
  const [calcTargetAvg, setCalcTargetAvg] = useState<number>(4.5);
  const [calcTargetGrade, setCalcTargetGrade] = useState<number>(5);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [modalSubjectId, setModalSubjectId] = useState('');
  const [modalValue, setModalValue] = useState<number>(5);
  const [modalWeight, setModalWeight] = useState<number>(1);
  const [modalType, setModalType] = useState<GradeType>('classwork');
  const [modalTopic, setModalTopic] = useState('');
  const [modalDate, setModalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Load subjects and grades
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const classId = profile?.class_id || 'cls-sample';
      const [fetchedSubjects, fetchedGrades] = await Promise.all([
        getSubjects(classId),
        getGrades(user.id),
      ]);
      setSubjects(fetchedSubjects);
      setGrades(fetchedGrades);
      if (fetchedSubjects.length > 0 && !calcSubjectId) {
        setCalcSubjectId(fetchedSubjects[0].id);
      }
    } catch (err) {
      console.error('Error loading grades data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profile, calcSubjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map analytics per subject
  const subjectAnalyticsMap = useMemo(() => {
    const map = new Map<string, SubjectAnalytics>();
    subjects.forEach((sub) => {
      const subGrades = grades.filter((g) => g.subject_id === sub.id);
      map.set(sub.id, calculateSubjectAnalytics(subGrades));
    });
    return map;
  }, [subjects, grades]);

  // Overall GPA Analytics
  const overallStats = useMemo(() => {
    return calculateOverallGPA(grades);
  }, [grades]);

  // Filtered & Sorted Subjects
  const displayedSubjects = useMemo(() => {
    let list = [...subjects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const statA = subjectAnalyticsMap.get(a.id)?.weightedAverage || 0;
      const statB = subjectAnalyticsMap.get(b.id)?.weightedAverage || 0;

      if (sortOption === 'avg-desc') return statB - statA;
      if (sortOption === 'avg-asc') return statA - statB;
      if (sortOption === 'needs-attention') {
        const countA = subjectAnalyticsMap.get(a.id)?.count || 0;
        const countB = subjectAnalyticsMap.get(b.id)?.count || 0;
        if (countA > 0 && countB === 0) return -1;
        if (countB > 0 && countA === 0) return 1;
        return statA - statB;
      }
      return a.name.localeCompare(b.name, 'ru');
    });

    return list;
  }, [subjects, searchQuery, sortOption, subjectAnalyticsMap]);

  // Target calculation for calculator
  const targetCalculation = useMemo(() => {
    if (!calcSubjectId) return null;
    const analytics = subjectAnalyticsMap.get(calcSubjectId);
    if (!analytics) return null;

    const currentAvg = analytics.weightedAverage || analytics.average || 0;
    const count = analytics.count;

    return {
      currentAvg,
      count,
      result: calculateGradesNeeded(currentAvg, count, calcTargetAvg, calcTargetGrade),
    };
  }, [calcSubjectId, calcTargetAvg, calcTargetGrade, subjectAnalyticsMap]);

  // Open Add Grade modal
  const handleOpenAddModal = (presetSubjectId?: string) => {
    setEditingGrade(null);
    setModalSubjectId(presetSubjectId || subjects[0]?.id || '');
    setModalValue(5);
    setModalWeight(1);
    setModalType('classwork');
    setModalTopic('');
    setModalDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  // Open Edit Grade modal
  const handleOpenEditModal = (grade: Grade) => {
    setEditingGrade(grade);
    setModalSubjectId(grade.subject_id);
    setModalValue(Number(grade.value));
    setModalWeight(grade.weight ?? 1);
    setModalType(grade.type || 'classwork');
    setModalTopic(grade.topic || '');
    setModalDate(grade.date || new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  // Save Grade (create or update)
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !modalSubjectId) return;

    setSubmitting(true);
    try {
      if (editingGrade) {
        const updated = await updateGrade(editingGrade.id, {
          subject_id: modalSubjectId,
          value: modalValue,
          weight: modalWeight,
          type: modalType,
          topic: modalTopic.trim() || null,
          date: modalDate,
        });
        if (updated) {
          setGrades((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        }
        showToast('Оценка успешно обновлена', 'success');
      } else {
        const created = await createGrade({
          user_id: user.id,
          class_id: profile?.class_id || null,
          subject_id: modalSubjectId,
          value: modalValue,
          weight: modalWeight,
          type: modalType,
          topic: modalTopic.trim() || null,
          date: modalDate,
        });
        setGrades((prev) => [created, ...prev]);
        showToast(`Оценка «${modalValue}» записана!`, 'success');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save grade error:', err);
      showToast('Не удалось сохранить оценку', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Grade
  const handleDeleteGrade = async (gradeId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту оценку?')) return;
    try {
      await deleteGrade(gradeId);
      setGrades((prev) => prev.filter((g) => g.id !== gradeId));
      if (editingGrade?.id === gradeId) {
        setIsModalOpen(false);
      }
      showToast('Оценка удалена', 'info');
    } catch (err) {
      console.error('Delete grade error:', err);
      showToast('Ошибка при удалении', 'error');
    }
  };

  // Helper for grade pill colors
  const getGradeBadgeClass = (val: number) => {
    if (val >= 5) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (val >= 4) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (val >= 3) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  };

  const getScoreColor = (avg: number) => {
    if (avg >= 4.5) return 'text-emerald-400';
    if (avg >= 3.8) return 'text-blue-400';
    if (avg >= 3.0) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getProgressColor = (avg: number) => {
    if (avg >= 4.5) return 'bg-emerald-500';
    if (avg >= 3.8) return 'bg-blue-500';
    if (avg >= 3.0) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight">
                Успеваемость и оценки
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Текущий средний балл, визуальный прогресс и калькулятор целей
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="toggle-gpa-calculator-btn"
            type="button"
            onClick={() => setShowCalculator((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
              showCalculator
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800'
            }`}
          >
            <Calculator className="w-4 h-4 text-blue-400" />
            <span>Калькулятор цели</span>
            {showCalculator ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>

          <button
            id="add-new-grade-main-btn"
            type="button"
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Записать оценку</span>
          </button>
        </div>
      </div>

      {/* GPA Overview & Visual Progress Dashboard Card */}
      <div id="gpa-overview-card" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main GPA Metric Box */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Общий академический результат
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Award className="w-3 h-3" />
                  {overallStats.academicTitle}
                </span>
              </div>

              <div className="flex items-baseline gap-3 mt-2">
                <span className={`text-4xl sm:text-5xl font-black tracking-tight ${getScoreColor(overallStats.gpa5)}`}>
                  {selectedScale === '5-point' && (overallStats.gpa5 > 0 ? overallStats.gpa5.toFixed(2) : '—')}
                  {selectedScale === '4.0-gpa' && (overallStats.gpa5 > 0 ? overallStats.gpa4.toFixed(2) : '—')}
                  {selectedScale === 'percentage' && `${overallStats.percentage}%`}
                </span>
                <span className="text-sm font-medium text-zinc-400">
                  {selectedScale === '5-point' && 'из 5.00'}
                  {selectedScale === '4.0-gpa' && 'GPA (шкала 4.0)'}
                  {selectedScale === 'percentage' && 'от максимума'}
                </span>
              </div>
            </div>

            {/* Scale switcher pill */}
            <div className="inline-flex items-center p-1 bg-zinc-950/80 border border-zinc-800 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setSelectedScale('5-point')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  selectedScale === '5-point'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                5-балльная
              </button>
              <button
                type="button"
                onClick={() => setSelectedScale('4.0-gpa')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  selectedScale === '4.0-gpa'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                4.0 GPA
              </button>
              <button
                type="button"
                onClick={() => setSelectedScale('percentage')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  selectedScale === 'percentage'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                100%
              </button>
            </div>
          </div>

          {/* Primary Visual Progress Bar */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
              <span>Прогресс до круглого отличника</span>
              <span className="text-zinc-200 font-bold">{overallStats.percentage}%</span>
            </div>

            <div className="relative h-3.5 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressColor(
                  overallStats.gpa5
                )} shadow-md`}
                style={{ width: `${Math.max(4, Math.min(100, overallStats.percentage))}%` }}
              />
            </div>

            {/* Benchmarks Scale Legend */}
            <div className="flex justify-between text-[11px] text-zinc-400 px-1 pt-0.5">
              <span>2.0 (База)</span>
              <span>3.0 (Удовл.)</span>
              <span>4.0 (Хорошо)</span>
              <span className="text-emerald-400 font-semibold">4.75+ (Отлично)</span>
              <span>5.0</span>
            </div>
          </div>

          {/* Quick Metrics row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3 border-t border-zinc-800/60">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-[11px] text-zinc-400 block mb-0.5">Всего оценок</span>
              <span className="text-lg font-bold text-zinc-100">{overallStats.totalGrades}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-[11px] text-zinc-400 block mb-0.5">Предметов</span>
              <span className="text-lg font-bold text-zinc-100">{overallStats.subjectsCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-[11px] text-zinc-400 block mb-0.5">Пятёрок</span>
              <span className="text-lg font-bold text-emerald-400">
                {overallStats.distribution.fives}
                <span className="text-xs text-zinc-400 font-normal ml-1">
                  ({overallStats.totalGrades > 0 ? Math.round((overallStats.distribution.fives / overallStats.totalGrades) * 100) : 0}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Grade Distribution Side Card */}
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-200">Распределение оценок</h3>
              <span className="text-[11px] text-zinc-400">Все четверти</span>
            </div>

            <div className="space-y-3">
              {/* 5s */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs">5</span>
                    Отлично
                  </span>
                  <span className="font-semibold text-zinc-300">{overallStats.distribution.fives} шт</span>
                </div>
                <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/60">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${overallStats.totalGrades > 0 ? (overallStats.distribution.fives / overallStats.totalGrades) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* 4s */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs">4</span>
                    Хорошо
                  </span>
                  <span className="font-semibold text-zinc-300">{overallStats.distribution.fours} шт</span>
                </div>
                <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/60">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${overallStats.totalGrades > 0 ? (overallStats.distribution.fours / overallStats.totalGrades) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* 3s */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs">3</span>
                    Удовл.
                  </span>
                  <span className="font-semibold text-zinc-300">{overallStats.distribution.threes} шт</span>
                </div>
                <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/60">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{
                      width: `${overallStats.totalGrades > 0 ? (overallStats.distribution.threes / overallStats.totalGrades) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* 2s */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-xs">2</span>
                    Неуд.
                  </span>
                  <span className="font-semibold text-zinc-300">{overallStats.distribution.twos} шт</span>
                </div>
                <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/60">
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{
                      width: `${overallStats.totalGrades > 0 ? (overallStats.distribution.twos / overallStats.totalGrades) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Качество знаний:</span>
            <span className="font-bold text-zinc-200">
              {overallStats.totalGrades > 0
                ? `${Math.round(((overallStats.distribution.fives + overallStats.distribution.fours) / overallStats.totalGrades) * 100)}%`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Target GPA Calculator Drawer */}
      {showCalculator && (
        <div id="target-gpa-calculator-panel" className="bg-zinc-900 border border-blue-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Калькулятор заветной оценки</h3>
                <p className="text-xs text-zinc-400">
                  Узнайте, сколько ещё хороших оценок нужно получить, чтобы поднять средний балл до цели
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCalculator(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Pick Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Выберите предмет</label>
              <select
                value={calcSubjectId}
                onChange={(e) => setCalcSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                {subjects.map((sub) => {
                  const stat = subjectAnalyticsMap.get(sub.id);
                  const avgText = stat && stat.count > 0 ? `(${stat.weightedAverage})` : '(нет оценок)';
                  return (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {avgText}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Target Average Grade */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Желаемый средний балл</label>
              <div className="flex items-center gap-2">
                {[4.0, 4.5, 4.75, 4.9].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCalcTargetAvg(val)}
                    className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border transition-colors ${
                      calcTargetAvg === val
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Grade value will earn */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Какую оценку будете получать?</label>
              <div className="flex items-center gap-2">
                {[5, 4].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCalcTargetGrade(v)}
                    className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border transition-colors ${
                      calcTargetGrade === v
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {v === 5 ? 'Пятёрки (5)' : 'Четвёрки (4)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calculator Output Banner */}
          {targetCalculation && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-blue-500/20 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <span>Текущий средний: {targetCalculation.currentAvg > 0 ? targetCalculation.currentAvg.toFixed(2) : '—'}</span>
                  <span className="text-zinc-500">➔</span>
                  <span className="text-blue-400">Цель: {calcTargetAvg.toFixed(2)}</span>
                </div>
                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
                  {targetCalculation.result.message}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subject Filter, Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Поиск по предметам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-zinc-400 shrink-0" />
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="avg-desc">По среднему баллу (сначала высокий)</option>
            <option value="avg-asc">По среднему баллу (сначала низкий)</option>
            <option value="needs-attention">Требующие внимания</option>
            <option value="name">По алфавиту</option>
          </select>
        </div>
      </div>

      {/* Subjects Grade Cards Grid */}
      <div className="space-y-3.5">
        {displayedSubjects.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800/80 rounded-2xl">
            <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
            <h4 className="text-sm font-bold text-zinc-300">Предметы не найдены</h4>
            <p className="text-xs text-zinc-500 mt-1">Попробуйте изменить поисковый запрос</p>
          </div>
        ) : (
          displayedSubjects.map((sub) => {
            const stats = subjectAnalyticsMap.get(sub.id) || {
              average: 0,
              weightedAverage: 0,
              count: 0,
              grades: [],
              trend: 'neutral',
              status: 'satisfactory',
            };

            const percentage = stats.weightedAverage > 0 ? Math.round((stats.weightedAverage / 5) * 100) : 0;

            return (
              <div
                key={sub.id}
                id={`subject-grade-card-${sub.id}`}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 transition-all rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md"
              >
                {/* Subject Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: sub.color || '#3b82f6' }}
                    />
                    <div>
                      <h4 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                        {sub.name}
                        {stats.trend === 'up' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
                            <TrendingUp className="w-3 h-3" /> Улучшается
                          </span>
                        )}
                        {stats.trend === 'down' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-medium">
                            <TrendingDown className="w-3 h-3" /> Падает
                          </span>
                        )}
                      </h4>
                      <span className="text-[11px] text-zinc-400">
                        {stats.count > 0
                          ? `${stats.count} ${stats.count === 1 ? 'оценка' : stats.count < 5 ? 'оценки' : 'оценок'}`
                          : 'Нет оценок'}
                      </span>
                    </div>
                  </div>

                  {/* Average & Add Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] text-zinc-400 font-medium">Средний:</span>
                      <span className={`text-xl sm:text-2xl font-black ${getScoreColor(stats.weightedAverage)}`}>
                        {stats.count > 0 ? stats.weightedAverage.toFixed(2) : '—'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(sub.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-400" />
                      <span>Оценка</span>
                    </button>
                  </div>
                </div>

                {/* Progress Bar for this Subject */}
                <div className="space-y-1 mb-3.5">
                  <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                        stats.weightedAverage
                      )}`}
                      style={{ width: `${Math.max(stats.count > 0 ? 5 : 0, Math.min(100, percentage))}%` }}
                    />
                  </div>

                  {/* Target benchmark hints */}
                  <div className="flex justify-between text-[10px] text-zinc-400 px-0.5">
                    <span>3.0 (3)</span>
                    <span>3.5 (4)</span>
                    <span className="text-emerald-400/90 font-medium">4.5 (5)</span>
                  </div>
                </div>

                {/* List of Grade Badges */}
                {stats.grades.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {stats.grades.map((grade) => (
                      <button
                        key={grade.id}
                        type="button"
                        onClick={() => handleOpenEditModal(grade)}
                        title={`${grade.topic || 'Оценка'} (${formatDateCustom(grade.date, language)}) • Нажмите для редактирования`}
                        className={`group relative inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border transition-all active:scale-95 ${getGradeBadgeClass(
                          grade.value
                        )}`}
                      >
                        <span>{grade.value}</span>
                        {grade.weight && grade.weight > 1 && (
                          <span className="text-[9px] font-normal opacity-70">
                            x{grade.weight}
                          </span>
                        )}
                        {grade.type === 'test' && <span className="text-[9px] opacity-70">К/Р</span>}
                        {grade.type === 'exam' && <span className="text-[9px] opacity-70">Экз</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">
                    Пока нет оценок по этому предмету. Нажмите «+ Оценка», чтобы добавить первую.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Grade Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-zinc-100">
                  {editingGrade ? 'Редактировать оценку' : 'Записать оценку'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="space-y-4">
              {/* Select Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Предмет *</label>
                <select
                  value={modalSubjectId}
                  onChange={(e) => setModalSubjectId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade Value Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Оценка *</label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 4, 3, 2].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setModalValue(v)}
                      className={`py-3 rounded-xl text-lg font-black border transition-all ${
                        modalValue === v
                          ? v === 5
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20 scale-105'
                            : v === 4
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20 scale-105'
                            : v === 3
                            ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-600/20 scale-105'
                            : 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/20 scale-105'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade Type & Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Тип работы</label>
                  <select
                    value={modalType}
                    onChange={(e) => {
                      const newType = e.target.value as GradeType;
                      setModalType(newType);
                      const defWeight = GRADE_TYPES.find((t) => t.id === newType)?.defaultWeight || 1;
                      setModalWeight(defWeight);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    {GRADE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Вес оценки</label>
                  <select
                    value={modalWeight}
                    onChange={(e) => setModalWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value={1}>1.0 (Обычная)</option>
                    <option value={1.5}>1.5 (Проверочная)</option>
                    <option value={2}>2.0 (Контрольная / Экз)</option>
                  </select>
                </div>
              </div>

              {/* Topic / Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Тема или комментарий</label>
                <input
                  type="text"
                  placeholder="Например: Квадратные уравнения, Диктант..."
                  value={modalTopic}
                  onChange={(e) => setModalTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Дата получения</label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                {editingGrade ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteGrade(editingGrade.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Удалить</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Сохранение...' : editingGrade ? 'Обновить' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
