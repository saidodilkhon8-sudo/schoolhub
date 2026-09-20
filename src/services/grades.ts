import { supabase } from '../lib/supabase';
import { Grade } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import {
  getMockGrades,
  createMockGrade,
  updateMockGrade,
  deleteMockGrade,
} from '../lib/mockStore';

export async function getGrades(userId: string): Promise<Grade[]> {
  try {
    const { data, error } = await supabase
      .from('grades')
      .select('*, subject:subjects(*)')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      if (isTableMissingError(error) || error.code === '42P01' || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        return getMockGrades(userId);
      }
      throw error;
    }
    return (data || []) as unknown as Grade[];
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42P01') {
      setSchemaMissing(true);
      return getMockGrades(userId);
    }
    return getMockGrades(userId);
  }
}

export async function createGrade(grade: {
  user_id: string;
  class_id?: string | null;
  subject_id: string;
  value: number;
  weight?: number;
  type?: Grade['type'];
  topic?: string | null;
  date: string;
}): Promise<Grade> {
  try {
    const { data, error } = await supabase
      .from('grades')
      .insert({
        user_id: grade.user_id,
        class_id: grade.class_id,
        subject_id: grade.subject_id,
        value: Number(grade.value),
        weight: grade.weight ?? 1,
        type: grade.type || 'classwork',
        topic: grade.topic?.trim() || null,
        date: grade.date,
      })
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      if (isTableMissingError(error) || error.code === '42P01' || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        return createMockGrade(grade);
      }
      throw error;
    }
    return data as unknown as Grade;
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42P01') {
      setSchemaMissing(true);
      return createMockGrade(grade);
    }
    return createMockGrade(grade);
  }
}

export async function updateGrade(id: string, updates: Partial<Grade>): Promise<Grade | null> {
  try {
    const { data, error } = await supabase
      .from('grades')
      .update({
        ...updates,
      })
      .eq('id', id)
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      if (isTableMissingError(error) || error.code === '42P01' || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        return updateMockGrade(id, updates);
      }
      throw error;
    }
    return data as unknown as Grade;
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42P01') {
      setSchemaMissing(true);
      return updateMockGrade(id, updates);
    }
    return updateMockGrade(id, updates);
  }
}

export async function deleteGrade(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('grades').delete().eq('id', id);
    if (error) {
      if (isTableMissingError(error) || error.code === '42P01' || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        deleteMockGrade(id);
        return;
      }
      throw error;
    }
    deleteMockGrade(id);
  } catch (err: any) {
    deleteMockGrade(id);
  }
}

// -----------------------------------------------------------
// GPA & Academic Analytics Calculation Utilities
// -----------------------------------------------------------

export interface SubjectAnalytics {
  average: number;
  weightedAverage: number;
  count: number;
  grades: Grade[];
  latestDate?: string;
  trend: 'up' | 'down' | 'neutral';
  status: 'excellent' | 'good' | 'satisfactory' | 'warning';
}

export function calculateSubjectAnalytics(grades: Grade[]): SubjectAnalytics {
  if (!grades || grades.length === 0) {
    return {
      average: 0,
      weightedAverage: 0,
      count: 0,
      grades: [],
      trend: 'neutral',
      status: 'satisfactory',
    };
  }

  // Sort chronological for trend
  const sorted = [...grades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const sum = sorted.reduce((acc, g) => acc + Number(g.value), 0);
  const avg = sum / sorted.length;

  let weightedSum = 0;
  let totalWeight = 0;
  sorted.forEach((g) => {
    const w = g.weight && g.weight > 0 ? g.weight : 1;
    weightedSum += Number(g.value) * w;
    totalWeight += w;
  });
  const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : avg;

  // Trend detection: compare average of first half vs second half
  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (sorted.length >= 3) {
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);
    const firstAvg = firstHalf.reduce((a, b) => a + Number(b.value), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + Number(b.value), 0) / secondHalf.length;
    if (secondAvg > firstAvg + 0.15) trend = 'up';
    else if (secondAvg < firstAvg - 0.15) trend = 'down';
  }

  let status: 'excellent' | 'good' | 'satisfactory' | 'warning' = 'satisfactory';
  if (weightedAvg >= 4.6) status = 'excellent';
  else if (weightedAvg >= 3.7) status = 'good';
  else if (weightedAvg >= 2.8) status = 'satisfactory';
  else status = 'warning';

  return {
    average: Number(avg.toFixed(2)),
    weightedAverage: Number(weightedAvg.toFixed(2)),
    count: sorted.length,
    grades: [...grades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    latestDate: sorted[sorted.length - 1]?.date,
    trend,
    status,
  };
}

export type GPAScale = '5-point' | '4.0-gpa' | 'percentage';

export interface OverallGPAAnalytics {
  gpa5: number;
  gpa4: number;
  percentage: number;
  totalGrades: number;
  subjectsCount: number;
  academicTitle: string;
  distribution: {
    fives: number;
    fours: number;
    threes: number;
    twos: number;
  };
}

export function calculateOverallGPA(grades: Grade[]): OverallGPAAnalytics {
  if (!grades || grades.length === 0) {
    return {
      gpa5: 0,
      gpa4: 0,
      percentage: 0,
      totalGrades: 0,
      subjectsCount: 0,
      academicTitle: 'Нет оценок',
      distribution: { fives: 0, fours: 0, threes: 0, twos: 0 },
    };
  }

  const distribution = { fives: 0, fours: 0, threes: 0, twos: 0 };
  let totalSum = 0;
  let totalWeightedSum = 0;
  let totalWeight = 0;
  const subjectsSet = new Set<string>();

  grades.forEach((g) => {
    const val = Number(g.value);
    const weight = g.weight && g.weight > 0 ? g.weight : 1;
    totalSum += val;
    totalWeightedSum += val * weight;
    totalWeight += weight;

    if (g.subject_id) subjectsSet.add(g.subject_id);

    if (val >= 5) distribution.fives += 1;
    else if (val >= 4) distribution.fours += 1;
    else if (val >= 3) distribution.threes += 1;
    else distribution.twos += 1;
  });

  const avg5 = totalWeight > 0 ? totalWeightedSum / totalWeight : totalSum / grades.length;
  // Convert 5-point scale (2..5) to 4.0 GPA scale (0..4.0):
  // 5.0 -> 4.0, 4.0 -> 3.0, 3.0 -> 2.0, 2.0 -> 1.0 (or max(0, avg5 - 1))
  const gpa4 = Math.max(0, Math.min(4.0, (avg5 - 1)));
  const percentage = Math.min(100, Math.round((avg5 / 5) * 100));

  let academicTitle = 'Хорошая успеваемость';
  if (avg5 >= 4.75) academicTitle = 'Отличник';
  else if (avg5 >= 4.0) academicTitle = 'Ударник';
  else if (avg5 >= 3.0) academicTitle = 'Удовлетворительно';
  else academicTitle = 'Требует внимания';

  return {
    gpa5: Number(avg5.toFixed(2)),
    gpa4: Number(gpa4.toFixed(2)),
    percentage,
    totalGrades: grades.length,
    subjectsCount: subjectsSet.size,
    academicTitle,
    distribution,
  };
}

/**
 * Calculates how many additional grades of a specific value (e.g. 5) are needed
 * to achieve or surpass the desired target average.
 */
export function calculateGradesNeeded(
  currentAverage: number,
  currentCount: number,
  targetAverage: number,
  targetGradeValue: number = 5
): { needed: number; possible: boolean; message: string } {
  if (currentAverage >= targetAverage) {
    return {
      needed: 0,
      possible: true,
      message: 'Цель уже достигнута! Отличный результат.',
    };
  }

  if (targetGradeValue <= targetAverage) {
    return {
      needed: 0,
      possible: false,
      message: `Невозможно достичь цели ${targetAverage.toFixed(2)} с оценками ${targetGradeValue}.`,
    };
  }

  // Formula:
  // (currentAverage * currentCount + targetGradeValue * n) / (currentCount + n) >= targetAverage
  // currentAverage * currentCount + targetGradeValue * n >= targetAverage * currentCount + targetAverage * n
  // n * (targetGradeValue - targetAverage) >= currentCount * (targetAverage - currentAverage)
  // n >= currentCount * (targetAverage - currentAverage) / (targetGradeValue - targetAverage)
  const numerator = currentCount * (targetAverage - currentAverage);
  const denominator = targetGradeValue - targetAverage;
  const n = Math.ceil(numerator / denominator);

  if (n <= 0) {
    return { needed: 0, possible: true, message: 'Цель уже достигнута!' };
  }

  return {
    needed: n,
    possible: true,
    message: `Нужно получить ещё ${n} ${n === 1 ? 'оценку' : n >= 2 && n <= 4 ? 'оценки' : 'оценок'} «${targetGradeValue}», чтобы средний балл стал ≥ ${targetAverage.toFixed(2)}.`,
  };
}
