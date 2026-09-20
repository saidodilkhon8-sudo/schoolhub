import { supabase } from '../lib/supabase';
import { Exam } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import { getMockExams, createMockExam, deleteMockExam } from '../lib/mockStore';

export async function getExams(classId: string): Promise<Exam[]> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*, subject:subjects(*)')
      .eq('class_id', classId)
      .order('exam_date', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockExams(classId);
      }
      throw error;
    }
    return (data || []) as unknown as Exam[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockExams(classId);
    }
    throw err;
  }
}

export async function createExam(exam: {
  user_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description?: string;
  exam_date: string;
}): Promise<Exam> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .insert({
        user_id: exam.user_id,
        class_id: exam.class_id,
        subject_id: exam.subject_id,
        title: exam.title.trim(),
        description: exam.description?.trim() || null,
        exam_date: exam.exam_date,
      })
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return createMockExam(exam);
      }
      throw error;
    }
    return data as unknown as Exam;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return createMockExam(exam);
    }
    throw err;
  }
}

export async function deleteExam(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        deleteMockExam(id);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      deleteMockExam(id);
      return;
    }
    throw err;
  }
}
