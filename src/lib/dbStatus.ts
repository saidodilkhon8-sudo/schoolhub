import { supabase, getSupabaseCredentials } from './supabase';

export function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  const details = String(err.details || '');
  
  return (
    code === 'PGRST205' || // PostgREST: table not in schema cache
    code === '42P01' ||    // PostgreSQL: undefined_table (relation does not exist)
    code === '42703' ||    // undefined_column
    msg.toLowerCase().includes('schema cache') ||
    msg.toLowerCase().includes('could not find the table') ||
    (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist')) ||
    details.toLowerCase().includes('relation')
  );
}

export function isInvalidUuidError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  const details = String(err.details || '');
  return (
    code === '22P02' ||
    msg.toLowerCase().includes('invalid input syntax for type uuid') ||
    details.toLowerCase().includes('invalid input syntax for type uuid')
  );
}

export function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

// Global state for schema missing
let schemaMissing = false;
const listeners = new Set<(missing: boolean) => void>();

export function getIsSchemaMissing(): boolean {
  return schemaMissing;
}

export function setSchemaMissing(missing: boolean): void {
  if (schemaMissing !== missing) {
    schemaMissing = missing;
    listeners.forEach((fn) => fn(schemaMissing));
  }
}

export function subscribeToSchemaStatus(fn: (missing: boolean) => void): () => void {
  listeners.add(fn);
  fn(schemaMissing);
  return () => {
    listeners.delete(fn);
  };
}

export async function checkSupabaseTablesExist(): Promise<boolean> {
  const { isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    setSchemaMissing(false);
    return false;
  }

  try {
    const { error } = await supabase.from('schools').select('id').limit(1);
    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return false;
      }
    }
    setSchemaMissing(false);
    return true;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return false;
    }
    return false;
  }
}

export function getSupabaseProjectId(): string | null {
  const { url } = getSupabaseCredentials();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname; // e.g. jfhiddfbegziydvgpjcb.supabase.co
    const parts = host.split('.');
    return parts[0] || null;
  } catch {
    return null;
  }
}

export function getSupabaseSqlEditorUrl(): string {
  const projectId = getSupabaseProjectId();
  if (projectId) {
    return `https://supabase.com/dashboard/project/${projectId}/sql/new`;
  }
  return 'https://supabase.com/dashboard';
}

export const SCHEMA_SQL = `-- ==========================================================
-- SchoolHub: PostgreSQL Database Schema & RLS Policies
-- Execute in Supabase SQL Editor
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SCHOOLS
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade INTEGER NOT NULL,
    letter TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    avatar_url TEXT,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    grade INTEGER,
    letter TEXT,
    theme TEXT DEFAULT 'dark' NOT NULL,
    language TEXT DEFAULT 'ru' NOT NULL,
    notifications_enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CLASS MEMBERS
CREATE TABLE IF NOT EXISTS public.class_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_class_member UNIQUE (class_id, user_id)
);

-- 5. SUBJECTS
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. SCHEDULE
CREATE TABLE IF NOT EXISTS public.schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
    lesson_number INTEGER NOT NULL CHECK (lesson_number BETWEEN 1 AND 12),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT,
    teacher TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. ASSIGNMENTS (HOMEWORK)
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    completed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. EXAMS
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    exam_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. MATERIALS
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. MESSAGES (CLASS CHAT)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('Спам', 'Оскорбление', 'Неподходящий контент', 'Другое')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. BLOCKED USERS
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_block UNIQUE (blocker_id, blocked_user_id)
);

-- 13. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member_of_class(target_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.class_members
        WHERE class_id = target_class_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schools policies
CREATE POLICY "Schools readable by authenticated users"
    ON public.schools FOR SELECT TO authenticated USING (true);

CREATE POLICY "Schools insertable by authenticated users"
    ON public.schools FOR INSERT TO authenticated WITH CHECK (true);

-- Classes policies
CREATE POLICY "Classes viewable by authenticated users"
    ON public.classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Classes insertable by authenticated users"
    ON public.classes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Profiles policies
CREATE POLICY "Profiles readable by classmates or self"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR (class_id IS NOT NULL AND class_id IN (
            SELECT cm.class_id FROM public.class_members cm WHERE cm.user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Class Members policies
CREATE POLICY "Class members readable by class members"
    ON public.class_members FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_member_of_class(class_id));

CREATE POLICY "Users can join class"
    ON public.class_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave class"
    ON public.class_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Subjects policies
CREATE POLICY "Subjects readable by class members"
    ON public.subjects FOR SELECT TO authenticated USING (public.is_member_of_class(class_id));

CREATE POLICY "Subjects insertable by class members"
    ON public.subjects FOR INSERT TO authenticated WITH CHECK (public.is_member_of_class(class_id));

CREATE POLICY "Subjects updatable by class members"
    ON public.subjects FOR UPDATE TO authenticated USING (public.is_member_of_class(class_id));

-- Schedule policies
CREATE POLICY "Schedule viewable by class members"
    ON public.schedule FOR SELECT TO authenticated
    USING (public.is_member_of_class(class_id) OR user_id = auth.uid());

CREATE POLICY "Schedule insertable by owner"
    ON public.schedule FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Schedule updatable by owner"
    ON public.schedule FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Schedule deletable by owner"
    ON public.schedule FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Assignments policies
CREATE POLICY "Assignments viewable by owner"
    ON public.assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Assignments insertable by owner"
    ON public.assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Assignments updatable by owner"
    ON public.assignments FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Assignments deletable by owner"
    ON public.assignments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Exams policies
CREATE POLICY "Exams viewable by class members"
    ON public.exams FOR SELECT TO authenticated USING (public.is_member_of_class(class_id));

CREATE POLICY "Exams insertable by class members"
    ON public.exams FOR INSERT TO authenticated
    WITH CHECK (public.is_member_of_class(class_id) AND auth.uid() = user_id);

CREATE POLICY "Exams updatable by author"
    ON public.exams FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Exams deletable by author"
    ON public.exams FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Materials policies
CREATE POLICY "Materials viewable by class members"
    ON public.materials FOR SELECT TO authenticated USING (public.is_member_of_class(class_id));

CREATE POLICY "Materials insertable by class members"
    ON public.materials FOR INSERT TO authenticated
    WITH CHECK (public.is_member_of_class(class_id) AND auth.uid() = user_id);

CREATE POLICY "Materials deletable by author"
    ON public.materials FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Messages viewable by class members"
    ON public.messages FOR SELECT TO authenticated USING (public.is_member_of_class(class_id));

CREATE POLICY "Messages insertable by class members"
    ON public.messages FOR INSERT TO authenticated
    WITH CHECK (public.is_member_of_class(class_id) AND auth.uid() = user_id);

CREATE POLICY "Messages deletable only by author"
    ON public.messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reports policies
CREATE POLICY "Reports insertable by reporter"
    ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Blocked users policies
CREATE POLICY "Blocked users viewable by blocker"
    ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);

CREATE POLICY "Blocked users insertable by blocker"
    ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Blocked users deletable by blocker"
    ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Notifications insertable by authenticated users"
    ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Realtime Publication for Live Alerts
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true) ON CONFLICT (id) DO NOTHING;
`;
