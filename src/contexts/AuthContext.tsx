import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, getSupabaseCredentials } from '../lib/supabase';
import { Profile } from '../types';
import { getProfile } from '../services/profiles';
import { isValidUuid } from '../lib/dbStatus';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  loading: boolean;
  isConfigured: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  setProfileState: (profile: Profile | null) => void;
  loginAsGuest: (email?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConfigured] = useState<boolean>(() => getSupabaseCredentials().isConfigured);

  const fetchProfile = async (userId: string) => {
    try {
      const p = await getProfile(userId);
      setProfile(p);

      // Self-heal class membership in case user created or joined class before class_members was populated
      if (p?.class_id && isValidUuid(p.class_id) && isValidUuid(userId)) {
        Promise.resolve(
          supabase
            .from('class_members')
            .upsert({ class_id: p.class_id, user_id: userId }, { onConflict: 'class_id,user_id' })
        ).catch(() => {});
      }
    } catch (err) {
      console.warn('Error fetching student profile:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchProfile(initialSession.user.id);
        } else {
          // Check for saved demo session
          const savedDemo = localStorage.getItem('schoolhub_demo_user');
          if (savedDemo) {
            try {
              const parsed = JSON.parse(savedDemo);
              if (parsed?.user) {
                setUser(parsed.user);
                setProfile(parsed.profile);
              }
            } catch {
              localStorage.removeItem('schoolhub_demo_user');
            }
          }
        }
      } catch (err) {
        console.warn('Supabase auth initialization:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        setUser(newSession.user);
        await fetchProfile(newSession.user.id);
      } else {
        if (event === 'SIGNED_OUT') {
          try {
            localStorage.removeItem('schoolhub_demo_user');
          } catch {}
          setUser(null);
          setProfile(null);
        } else if (!localStorage.getItem('schoolhub_demo_user')) {
          setUser(null);
          setProfile(null);
        }
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const loginAsGuest = (email: string = 'student@school.uz') => {
    const cleanEmail = email.trim().toLowerCase();
    const isMasterAdmin = cleanEmail === 'saidodilkhon2@gmail.com';
    const guestUser: User = {
      id: isMasterAdmin ? 'admin-super-user-id' : 'demo-student-user-id',
      email: cleanEmail,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };
    const guestProfile: Profile = {
      id: isMasterAdmin ? 'admin-super-user-id' : 'demo-student-user-id',
      first_name: isMasterAdmin ? 'Саидодилхон (Admin)' : 'Ученик',
      last_name: '',
      email: cleanEmail,
      role: isMasterAdmin ? 'admin' : 'student',
      is_admin: isMasterAdmin,
      school_id: 'sch-1',
      class_id: 'mock-class-1',
      grade: 8,
      letter: 'А',
      theme: 'dark',
      language: 'ru',
      notifications_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setUser(guestUser);
    setProfile(guestProfile);
    localStorage.setItem('schoolhub_demo_user', JSON.stringify({ user: guestUser, profile: guestProfile }));
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('schoolhub_demo_user');
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
    }
  };

  const ADMIN_EMAIL = 'saidodilkhon2@gmail.com';
  const isAdmin = Boolean(
    (user?.email && user.email.toLowerCase() === ADMIN_EMAIL) ||
    (profile?.email && profile.email.toLowerCase() === ADMIN_EMAIL)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        loading: isLoading,
        isConfigured,
        isAdmin,
        refreshProfile,
        signOut,
        setProfileState: setProfile,
        loginAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
