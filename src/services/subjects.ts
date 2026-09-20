import { supabase } from '../lib/supabase';
import { Subject } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import { getMockSubjects, createMockSubject } from '../lib/mockStore';

export const DEFAULT_SUBJECTS = [
  { name: 'Математика', color: '#3b82f6' },
  { name: 'Физика', color: '#8b5cf6' },
  { name: 'Информатика', color: '#06b6d4' },
  { name: 'История', color: '#f59e0b' },
  { name: 'Русский язык', color: '#ef4444' },
  { name: 'Литература', color: '#ec4899' },
  { name: 'Английский язык', color: '#10b981' },
  { name: 'Биология', color: '#84cc16' },
  { name: 'География', color: '#14b8a6' },
  { name: 'Химия', color: '#a855f7' },
];

export async function getSubjects(classId: string): Promise<Subject[]> {
  try {
    // Ensure the current authenticated user is registered as class member
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      await supabase
        .from('class_members')
        .upsert({ class_id: classId, user_id: authData.user.id }, { onConflict: 'class_id,user_id' });
    }

    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('class_id', classId)
      .order('name');

    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        return getMockSubjects(classId);
      }
      throw error;
    }

    // If no subjects found for this class yet, initialize default subjects
    if (!data || data.length === 0) {
      const toInsert = DEFAULT_SUBJECTS.map((s) => ({
        class_id: classId,
        name: s.name,
        color: s.color,
      }));
      const { data: inserted, error: insertError } = await supabase
        .from('subjects')
        .insert(toInsert)
        .select();

      if (!insertError && inserted && inserted.length > 0) {
        return inserted as Subject[];
      }
      return getMockSubjects(classId);
    }

    return (data || []) as Subject[];
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42501') {
      if (isTableMissingError(err)) setSchemaMissing(true);
      return getMockSubjects(classId);
    }
    throw err;
  }
}

export async function createSubject(classId: string, name: string, color: string = '#3b82f6'): Promise<Subject> {
  const cleanName = name.trim();
  try {
    // Ensure membership before inserting subject
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      await supabase
        .from('class_members')
        .upsert({ class_id: classId, user_id: authData.user.id }, { onConflict: 'class_id,user_id' });
    }

    const { data, error } = await supabase
      .from('subjects')
      .insert({
        class_id: classId,
        name: cleanName,
        color,
      })
      .select()
      .single();

    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        return createMockSubject(classId, cleanName, color);
      }
      throw error;
    }
    return data as Subject;
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42501') {
      if (isTableMissingError(err)) setSchemaMissing(true);
      return createMockSubject(classId, cleanName, color);
    }
    throw err;
  }
}
