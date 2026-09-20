import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export async function signUpStudent(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signInStudent(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOutStudent() {
  try {
    localStorage.removeItem('schoolhub_demo_user');
  } catch {}
  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('Supabase sign out error:', error);
  } catch (err) {
    console.warn('Supabase sign out error:', err);
  }
}

export async function resetPasswordStudent(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return data;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}
