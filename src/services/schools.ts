import { supabase } from '../lib/supabase';
import { School } from '../types';
import { isTableMissingError, isInvalidUuidError, isValidUuid, setSchemaMissing } from '../lib/dbStatus';
import {
  searchMockSchools,
  getMockSchoolById,
  findOrCreateMockSchool,
} from '../lib/mockStore';

export async function searchSchools(query: string): Promise<School[]> {
  try {
    const clean = query.trim();
    let req = supabase.from('schools').select('*').order('name');
    if (clean) {
      req = req.ilike('name', `%${clean}%`);
    }
    const { data, error } = await req.limit(10);
    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return searchMockSchools(query);
      }
      throw error;
    }
    return (data || []) as School[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return searchMockSchools(query);
    }
    throw err;
  }
}

export async function getSchoolById(schoolId: string): Promise<School | null> {
  if (!isValidUuid(schoolId)) {
    return getMockSchoolById(schoolId);
  }

  try {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockSchoolById(schoolId);
      }
      if (isInvalidUuidError(error)) {
        return getMockSchoolById(schoolId);
      }
      throw error;
    }
    return data as School | null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockSchoolById(schoolId);
    }
    if (isInvalidUuidError(err)) {
      return getMockSchoolById(schoolId);
    }
    throw err;
  }
}

export async function findOrCreateSchool(name: string, city: string): Promise<School> {
  const cleanName = name.trim();
  const cleanCity = city.trim();

  try {
    // Check if school with identical name and city already exists to prevent unnecessary duplicates
    const { data: existing, error: findError } = await supabase
      .from('schools')
      .select('*')
      .ilike('name', cleanName)
      .ilike('city', cleanCity)
      .maybeSingle();

    if (findError) {
      if (isTableMissingError(findError)) {
        setSchemaMissing(true);
        return findOrCreateMockSchool(cleanName, cleanCity);
      }
      throw findError;
    }

    if (existing) {
      return existing as School;
    }

    const { data, error } = await supabase
      .from('schools')
      .insert({
        name: cleanName,
        city: cleanCity,
      })
      .select()
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return findOrCreateMockSchool(cleanName, cleanCity);
      }
      throw error;
    }
    return data as School;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return findOrCreateMockSchool(cleanName, cleanCity);
    }
    throw err;
  }
}
