import { supabase } from '../lib/supabase';
import { Material } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import {
  getMockMaterials,
  createMockMaterial,
  deleteMockMaterial,
} from '../lib/mockStore';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'docx'];

export async function getMaterials(classId: string): Promise<Material[]> {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select(`
        *,
        subject:subjects(*),
        profile:profiles(id, first_name, last_name, avatar_url)
      `)
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockMaterials(classId);
      }
      throw error;
    }
    return (data || []) as unknown as Material[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockMaterials(classId);
    }
    throw err;
  }
}

export async function uploadMaterial(params: {
  class_id: string;
  user_id: string;
  subject_id?: string | null;
  title: string;
  description?: string;
  file: File;
}): Promise<Material> {
  const { file, class_id, user_id, subject_id, title, description } = params;

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Размер файла превышает 25 МБ');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Недопустимый формат файла. Разрешены: PDF, PNG, JPG, DOCX');
  }

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${class_id}/${Date.now()}_${cleanFileName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('class-materials')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return createMockMaterial({
        class_id,
        user_id,
        subject_id,
        title,
        description,
        file_path: URL.createObjectURL(file),
        file_size: file.size,
        file_type: ext,
      });
    }

    const { data, error } = await supabase
      .from('materials')
      .insert({
        class_id,
        user_id,
        subject_id: subject_id || null,
        title: title.trim(),
        description: description?.trim() || null,
        file_path: storagePath,
        file_size: file.size,
        file_type: ext,
      })
      .select(`
        *,
        subject:subjects(*),
        profile:profiles(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return createMockMaterial({
          class_id,
          user_id,
          subject_id,
          title,
          description,
          file_path: URL.createObjectURL(file),
          file_size: file.size,
          file_type: ext,
        });
      }
      throw error;
    }
    return data as unknown as Material;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return createMockMaterial({
        class_id,
        user_id,
        subject_id,
        title,
        description,
        file_path: URL.createObjectURL(file),
        file_size: file.size,
        file_type: ext,
      });
    }
    throw err;
  }
}

export function getMaterialDownloadUrl(filePath: string): string {
  if (filePath.startsWith('blob:') || filePath.startsWith('http')) {
    return filePath;
  }
  const { data } = supabase.storage.from('class-materials').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deleteMaterial(materialId: string, filePath: string): Promise<void> {
  try {
    await supabase.storage.from('class-materials').remove([filePath]);
    const { error } = await supabase.from('materials').delete().eq('id', materialId);
    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        deleteMockMaterial(materialId);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      deleteMockMaterial(materialId);
      return;
    }
    throw err;
  }
}
