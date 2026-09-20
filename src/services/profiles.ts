import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { isTableMissingError, isInvalidUuidError, isValidUuid, setSchemaMissing } from '../lib/dbStatus';
import {
  getMockProfile,
  updateMockProfile,
  deleteMockProfile,
} from '../lib/mockStore';

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isValidUuid(userId)) {
    return getMockProfile(userId);
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockProfile(userId);
      }
      if (isInvalidUuidError(error)) {
        return getMockProfile(userId);
      }
      throw error;
    }

    if (data) {
      const profile = data as Profile;
      try {
        const storedHwReminders = localStorage.getItem(`schoolhub_hw_reminders_${userId}`);
        if (storedHwReminders !== null) {
          profile.homework_reminders_enabled = storedHwReminders === 'true';
        } else if (profile.homework_reminders_enabled === undefined) {
          profile.homework_reminders_enabled = true;
        }
      } catch {}
      return profile;
    }
    return null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockProfile(userId);
    }
    if (isInvalidUuidError(err)) {
      return getMockProfile(userId);
    }
    throw err;
  }
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
  // Sync to local storage for instant availability & offline support
  if (updates.homework_reminders_enabled !== undefined) {
    try {
      localStorage.setItem(
        `schoolhub_hw_reminders_${userId}`,
        String(updates.homework_reminders_enabled)
      );
    } catch {}
  }

  // If userId is not a valid UUID (e.g. demo-student-user-id), handle purely in mock store
  if (!isValidUuid(userId)) {
    return updateMockProfile(userId, updates);
  }

  // Prepare database updates; filter out non-UUID foreign keys that would cause 22P02
  const dbUpdates = { ...updates };
  if (dbUpdates.class_id !== undefined && dbUpdates.class_id !== null && !isValidUuid(dbUpdates.class_id)) {
    delete dbUpdates.class_id;
  }
  if (dbUpdates.school_id !== undefined && dbUpdates.school_id !== null && !isValidUuid(dbUpdates.school_id)) {
    delete dbUpdates.school_id;
  }

  try {
    // 1. Check if profile row already exists
    const { data: existing, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (checkError) {
      if (isTableMissingError(checkError)) {
        setSchemaMissing(true);
        return updateMockProfile(userId, updates);
      }
      if (isInvalidUuidError(checkError)) {
        return updateMockProfile(userId, updates);
      }
      return updateMockProfile(userId, updates);
    }

    if (existing) {
      // Profile exists: safely UPDATE only the changed fields (preserves NOT NULL columns)
      let { data, error } = await supabase
        .from('profiles')
        .update({
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      // If remote table doesn't have custom columns (e.g. 42703 column does not exist), retry without them
      if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
        const { homework_reminders_enabled, reminder_time, ...safeUpdates } = dbUpdates;
        const retryRes = await supabase
          .from('profiles')
          .update({
            ...safeUpdates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select()
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) {
        if (isTableMissingError(error)) {
          setSchemaMissing(true);
          return updateMockProfile(userId, updates);
        }
        if (isInvalidUuidError(error)) {
          return updateMockProfile(userId, updates);
        }
        return updateMockProfile(userId, updates);
      }

      const resProfile = data as Profile;
      if (updates.homework_reminders_enabled !== undefined) {
        resProfile.homework_reminders_enabled = updates.homework_reminders_enabled;
      }
      updateMockProfile(userId, updates);
      return resProfile;
    } else {
      // Profile does not exist yet: INSERT with safe defaults for required NOT NULL fields
      let { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          first_name: updates.first_name || 'Ученик',
          last_name: updates.last_name || '',
          theme: 'dark',
          language: 'ru',
          notifications_enabled: true,
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
        const { homework_reminders_enabled, reminder_time, ...safeUpdates } = dbUpdates;
        const retryInsert = await supabase
          .from('profiles')
          .insert({
            id: userId,
            first_name: safeUpdates.first_name || 'Ученик',
            last_name: safeUpdates.last_name || '',
            theme: 'dark',
            language: 'ru',
            notifications_enabled: true,
            ...safeUpdates,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        data = retryInsert.data;
        error = retryInsert.error;
      }

      if (error) {
        if (isTableMissingError(error)) {
          setSchemaMissing(true);
          return updateMockProfile(userId, updates);
        }
        if (isInvalidUuidError(error)) {
          return updateMockProfile(userId, updates);
        }
        return updateMockProfile(userId, updates);
      }

      const resProfile = data as Profile;
      if (updates.homework_reminders_enabled !== undefined) {
        resProfile.homework_reminders_enabled = updates.homework_reminders_enabled;
      }
      updateMockProfile(userId, updates);
      return resProfile;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return updateMockProfile(userId, updates);
    }
    if (isInvalidUuidError(err)) {
      return updateMockProfile(userId, updates);
    }
    return updateMockProfile(userId, updates);
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      // Fallback: convert to base64 data URL
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err: any) {
    // Fallback: convert to base64 data URL
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
}

export async function deleteAccount(userId: string): Promise<void> {
  deleteMockProfile(userId);
  if (!isValidUuid(userId)) {
    return;
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

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
