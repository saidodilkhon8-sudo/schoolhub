import { supabase } from '../lib/supabase';
import { Assignment } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import {
  getMockAssignments,
  createMockAssignment,
  toggleMockAssignment,
  deleteMockAssignment,
  updateMockAssignment,
} from '../lib/mockStore';
import { broadcastHomeworkEvent } from './notifications';

export async function getAssignments(userId: string): Promise<Assignment[]> {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, subject:subjects(*)')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockAssignments(userId);
      }
      throw error;
    }
    return (data || []) as unknown as Assignment[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockAssignments(userId);
    }
    throw err;
  }
}

export async function createAssignment(assignment: {
  user_id: string;
  class_id?: string | null;
  subject_id: string;
  title: string;
  description?: string;
  due_date: string;
}): Promise<Assignment> {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        user_id: assignment.user_id,
        class_id: assignment.class_id,
        subject_id: assignment.subject_id,
        title: assignment.title.trim(),
        description: assignment.description?.trim() || null,
        due_date: assignment.due_date,
        completed: false,
      })
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        const mock = createMockAssignment(assignment);
        broadcastHomeworkEvent({ action: 'created', assignment: mock, authorId: assignment.user_id });
        return mock;
      }
      throw error;
    }
    const result = data as unknown as Assignment;
    broadcastHomeworkEvent({ action: 'created', assignment: result, authorId: assignment.user_id });
    return result;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      const mock = createMockAssignment(assignment);
      broadcastHomeworkEvent({ action: 'created', assignment: mock, authorId: assignment.user_id });
      return mock;
    }
    throw err;
  }
}

export async function toggleAssignmentCompleted(id: string, completed: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('assignments')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        toggleMockAssignment(id, completed);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      toggleMockAssignment(id, completed);
      return;
    }
    throw err;
  }
}

export async function deleteAssignment(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        deleteMockAssignment(id);
        broadcastHomeworkEvent({ action: 'deleted', assignment: { id } });
        return;
      }
      throw error;
    }
    broadcastHomeworkEvent({ action: 'deleted', assignment: { id } });
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      deleteMockAssignment(id);
      broadcastHomeworkEvent({ action: 'deleted', assignment: { id } });
      return;
    }
    throw err;
  }
}

export async function updateAssignment(
  id: string,
  updates: Partial<Omit<Assignment, 'id' | 'subject'>>
): Promise<Assignment> {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        const mock = updateMockAssignment(id, updates);
        if (mock) broadcastHomeworkEvent({ action: 'updated', assignment: mock, authorId: updates.user_id });
        return mock!;
      }
      throw error;
    }
    const res = data as unknown as Assignment;
    broadcastHomeworkEvent({ action: 'updated', assignment: res, authorId: updates.user_id });
    return res;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      const mock = updateMockAssignment(id, updates);
      if (mock) broadcastHomeworkEvent({ action: 'updated', assignment: mock, authorId: updates.user_id });
      return mock!;
    }
    throw err;
  }
}
