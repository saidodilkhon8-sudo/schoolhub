import { supabase } from '../lib/supabase';
import { ClassGroup, ClassMember, School } from '../types';
import { generateInviteCode } from '../utils/format';
import { isTableMissingError, isInvalidUuidError, isValidUuid, setSchemaMissing } from '../lib/dbStatus';
import {
  findMockClassBySchoolAndGradeLetter,
  findMockClassByInviteCode,
  getMockClassById,
  createMockClassGroup,
  joinMockClass,
  leaveMockClass,
  getMockClassMembers,
} from '../lib/mockStore';

export async function findClassBySchoolAndGradeLetter(
  schoolId: string,
  grade: number,
  letter: string
): Promise<ClassGroup | null> {
  if (!isValidUuid(schoolId)) {
    return findMockClassBySchoolAndGradeLetter(schoolId, grade, letter);
  }

  const cleanLetter = letter.trim().toUpperCase();
  const className = `${grade}-${cleanLetter}`;

  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*, school:schools(*)')
      .eq('school_id', schoolId)
      .or(`name.eq.${className},and(grade.eq.${grade},letter.eq.${cleanLetter})`)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return findMockClassBySchoolAndGradeLetter(schoolId, grade, letter);
      }
      if (isInvalidUuidError(error)) {
        return findMockClassBySchoolAndGradeLetter(schoolId, grade, letter);
      }
      throw error;
    }
    return data as ClassGroup | null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return findMockClassBySchoolAndGradeLetter(schoolId, grade, letter);
    }
    if (isInvalidUuidError(err)) {
      return findMockClassBySchoolAndGradeLetter(schoolId, grade, letter);
    }
    throw err;
  }
}

export async function findClassByInviteCode(inviteCode: string): Promise<ClassGroup | null> {
  const cleanCode = inviteCode.trim().toUpperCase();
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*, school:schools(*)')
      .eq('invite_code', cleanCode)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return findMockClassByInviteCode(inviteCode);
      }
      throw error;
    }
    return data as ClassGroup | null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return findMockClassByInviteCode(inviteCode);
    }
    throw err;
  }
}

export async function getClassById(classId: string): Promise<ClassGroup | null> {
  if (!isValidUuid(classId)) {
    return getMockClassById(classId);
  }

  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*, school:schools(*)')
      .eq('id', classId)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockClassById(classId);
      }
      if (isInvalidUuidError(error)) {
        return getMockClassById(classId);
      }
      throw error;
    }
    return data as ClassGroup | null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockClassById(classId);
    }
    if (isInvalidUuidError(err)) {
      return getMockClassById(classId);
    }
    throw err;
  }
}

export async function createClassGroup(params: {
  schoolId: string;
  grade: number;
  letter: string;
  userId: string;
}): Promise<ClassGroup> {
  if (!isValidUuid(params.schoolId) || !isValidUuid(params.userId)) {
    return createMockClassGroup(params);
  }

  const cleanLetter = params.letter.trim().toUpperCase();
  const name = `${params.grade}-${cleanLetter}`;
  const inviteCode = generateInviteCode(params.grade, cleanLetter);

  try {
    const { data: newClass, error } = await supabase
      .from('classes')
      .insert({
        school_id: params.schoolId,
        name,
        grade: params.grade,
        letter: cleanLetter,
        invite_code: inviteCode,
        created_by: params.userId,
      })
      .select('*, school:schools(*)')
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return createMockClassGroup(params);
      }
      if (isInvalidUuidError(error)) {
        return createMockClassGroup(params);
      }
      throw error;
    }

    // Update or ensure creator profile has class and school set first (satisfies class_members FK)
    await supabase.from('profiles').upsert({
      id: params.userId,
      class_id: newClass.id,
      school_id: params.schoolId,
      grade: params.grade,
      letter: cleanLetter,
      updated_at: new Date().toISOString(),
    });

    // Automatically add creator as member of this class
    await supabase.from('class_members').upsert({
      class_id: newClass.id,
      user_id: params.userId,
    }, { onConflict: 'class_id,user_id' });

    return newClass as ClassGroup;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return createMockClassGroup(params);
    }
    if (isInvalidUuidError(err)) {
      return createMockClassGroup(params);
    }
    throw err;
  }
}

export async function joinClass(classId: string, userId: string): Promise<void> {
  if (!isValidUuid(classId) || !isValidUuid(userId)) {
    joinMockClass(classId, userId);
    return;
  }

  try {
    // Get class details to sync profile grade, letter, and school_id first
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('school_id, grade, letter')
      .eq('id', classId)
      .maybeSingle();

    if (classError && (isTableMissingError(classError) || isInvalidUuidError(classError))) {
      if (isTableMissingError(classError)) setSchemaMissing(true);
      joinMockClass(classId, userId);
      return;
    }

    if (classData) {
      await supabase.from('profiles').upsert({
        id: userId,
        class_id: classId,
        school_id: classData.school_id,
        grade: classData.grade,
        letter: classData.letter,
        updated_at: new Date().toISOString(),
      });
    }

    // Add to class_members (prevent error if already joined)
    const { error: memberError } = await supabase
      .from('class_members')
      .upsert({
        class_id: classId,
        user_id: userId,
      }, { onConflict: 'class_id,user_id' });

    if (memberError) {
      if (isTableMissingError(memberError) || isInvalidUuidError(memberError)) {
        if (isTableMissingError(memberError)) setSchemaMissing(true);
        joinMockClass(classId, userId);
        return;
      }
      throw memberError;
    }
    joinMockClass(classId, userId);
  } catch (err: any) {
    if (isTableMissingError(err) || isInvalidUuidError(err)) {
      if (isTableMissingError(err)) setSchemaMissing(true);
      joinMockClass(classId, userId);
      return;
    }
    throw err;
  }
}

export async function leaveClass(classId: string, userId: string): Promise<void> {
  // Always ensure mock store is updated
  leaveMockClass(classId, userId);

  // If either ID is not a valid UUID (e.g. mock-class-1 or demo-student-user-id), do not query PostgreSQL to prevent 22P02 error
  if (!isValidUuid(classId) || !isValidUuid(userId)) {
    return;
  }

  try {
    const { error } = await supabase
      .from('class_members')
      .delete()
      .eq('class_id', classId)
      .eq('user_id', userId);

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return;
      }
      if (isInvalidUuidError(error)) {
        return;
      }
      throw error;
    }

    await supabase.from('profiles').update({
      class_id: null,
      grade: null,
      letter: null,
    }).eq('id', userId);
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return;
    }
    if (isInvalidUuidError(err)) {
      return;
    }
    throw err;
  }
}

export async function getClassMembers(classId: string): Promise<ClassMember[]> {
  if (!isValidUuid(classId)) {
    return getMockClassMembers(classId);
  }

  try {
    // Only query safe fields: first_name, last_name, avatar_url
    const { data, error } = await supabase
      .from('class_members')
      .select(`
        id,
        class_id,
        user_id,
        joined_at,
        profile:profiles(id, first_name, last_name, avatar_url)
      `)
      .eq('class_id', classId)
      .order('joined_at', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockClassMembers(classId);
      }
      if (isInvalidUuidError(error)) {
        return getMockClassMembers(classId);
      }
      throw error;
    }
    return (data || []) as unknown as ClassMember[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockClassMembers(classId);
    }
    if (isInvalidUuidError(err)) {
      return getMockClassMembers(classId);
    }
    throw err;
  }
}
