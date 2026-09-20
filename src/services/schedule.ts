import { supabase } from '../lib/supabase';
import { ScheduleLesson } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import {
  getMockSchedule,
  addMockLesson,
  updateMockLesson,
  deleteMockLesson,
} from '../lib/mockStore';
import { broadcastScheduleEvent } from './notifications';

export async function getScheduleForClass(classId: string, userId?: string): Promise<ScheduleLesson[]> {
  try {
    let query = supabase
      .from('schedule')
      .select('*, subject:subjects(*)')
      .eq('class_id', classId)
      .order('day_of_week', { ascending: true })
      .order('lesson_number', { ascending: true });

    const { data, error } = await query;
    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockSchedule(classId);
      }
      throw error;
    }
    return (data || []) as unknown as ScheduleLesson[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockSchedule(classId);
    }
    throw err;
  }
}

export async function addLesson(lesson: {
  class_id: string;
  user_id: string;
  subject_id: string;
  day_of_week: number;
  lesson_number: number;
  start_time: string;
  end_time: string;
  room?: string;
  teacher?: string;
}): Promise<ScheduleLesson> {
  try {
    // Ensure membership
    await supabase
      .from('class_members')
      .upsert({ class_id: lesson.class_id, user_id: lesson.user_id }, { onConflict: 'class_id,user_id' });

    const { data, error } = await supabase
      .from('schedule')
      .insert({
        class_id: lesson.class_id,
        user_id: lesson.user_id,
        subject_id: lesson.subject_id,
        day_of_week: lesson.day_of_week,
        lesson_number: lesson.lesson_number,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        room: lesson.room?.trim() || null,
        teacher: lesson.teacher?.trim() || null,
      })
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        const mock = addMockLesson(lesson);
        broadcastScheduleEvent({ action: 'created', lesson: mock, authorId: lesson.user_id });
        return mock;
      }
      throw error;
    }
    const result = data as unknown as ScheduleLesson;
    broadcastScheduleEvent({ action: 'created', lesson: result, authorId: lesson.user_id });
    return result;
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42501') {
      if (isTableMissingError(err)) setSchemaMissing(true);
      const mock = addMockLesson(lesson);
      broadcastScheduleEvent({ action: 'created', lesson: mock, authorId: lesson.user_id });
      return mock;
    }
    throw err;
  }
}

export async function updateLesson(
  id: string,
  updates: Partial<Omit<ScheduleLesson, 'id' | 'subject'>>
): Promise<ScheduleLesson> {
  try {
    const { data, error } = await supabase
      .from('schedule')
      .update(updates)
      .eq('id', id)
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        const mock = updateMockLesson(id, updates);
        if (mock) broadcastScheduleEvent({ action: 'updated', lesson: mock });
        return mock!;
      }
      throw error;
    }
    const result = data as unknown as ScheduleLesson;
    broadcastScheduleEvent({ action: 'updated', lesson: result });
    return result;
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42501') {
      if (isTableMissingError(err)) setSchemaMissing(true);
      const mock = updateMockLesson(id, updates);
      if (mock) broadcastScheduleEvent({ action: 'updated', lesson: mock });
      return mock!;
    }
    throw err;
  }
}

export async function deleteLesson(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        deleteMockLesson(id);
        broadcastScheduleEvent({ action: 'deleted', lesson: { id } });
        return;
      }
      throw error;
    }
    broadcastScheduleEvent({ action: 'deleted', lesson: { id } });
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42501') {
      if (isTableMissingError(err)) setSchemaMissing(true);
      deleteMockLesson(id);
      broadcastScheduleEvent({ action: 'deleted', lesson: { id } });
      return;
    }
    throw err;
  }
}

export async function reorderLessonNumber(id: string, newLessonNumber: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('schedule')
      .update({ lesson_number: newLessonNumber })
      .eq('id', id);

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        updateMockLesson(id, { lesson_number: newLessonNumber });
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      updateMockLesson(id, { lesson_number: newLessonNumber });
      return;
    }
    throw err;
  }
}
