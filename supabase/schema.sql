-- ==========================================================
-- SchoolHub: PostgreSQL Database Schema & RLS Policies
-- Execute in Supabase SQL Editor
-- ==========================================================

-- Enable UUID extension
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
    name TEXT NOT NULL, -- e.g. "8-А"
    grade INTEGER NOT NULL, -- 8
    letter TEXT NOT NULL, -- "А"
    invite_code TEXT UNIQUE NOT NULL, -- e.g. "8A-K7P4X2"
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
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Пн, 6=Сб
    lesson_number INTEGER NOT NULL CHECK (lesson_number BETWEEN 1 AND 12),
    start_time TEXT NOT NULL, -- e.g. "08:00"
    end_time TEXT NOT NULL,   -- e.g. "08:45"
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

-- 8. EXAMS (КОНТРОЛЬНЫЕ)
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
    type TEXT NOT NULL, -- 'homework', 'exam', 'chat', 'class'
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

-- Enable RLS on all tables
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

-- Helper function: check if user is a member or creator of a class
CREATE OR REPLACE FUNCTION public.is_member_of_class(target_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.class_members
        WHERE class_id = target_class_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND class_id = target_class_id
    ) OR EXISTS (
        SELECT 1 FROM public.classes
        WHERE id = target_class_id AND created_by = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Schools: Any authenticated user can read schools or insert a new school
CREATE POLICY "Schools readable by authenticated users"
    ON public.schools FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Schools insertable by authenticated users"
    ON public.schools FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 2. Classes: Read only if member OR during invite search; insert if authenticated
CREATE POLICY "Classes viewable by authenticated users"
    ON public.classes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Classes insertable by authenticated users"
    ON public.classes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- 3. Profiles:
-- Public can read classmate profiles (first_name, last_name, avatar_url, school_id, class_id)
-- ONLY current user can update or delete their profile
CREATE POLICY "Profiles readable by classmates or self"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR (class_id IS NOT NULL AND class_id IN (
            SELECT cm.class_id FROM public.class_members cm WHERE cm.user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- 4. Class Members:
-- Members of the same class can see each other
CREATE POLICY "Class members readable by class members"
    ON public.class_members FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_member_of_class(class_id)
    );

CREATE POLICY "Users can join class"
    ON public.class_members FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave class"
    ON public.class_members FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Subjects:
-- Readable and insertable by class members
CREATE POLICY "Subjects readable by class members"
    ON public.subjects FOR SELECT
    TO authenticated
    USING (public.is_member_of_class(class_id));

CREATE POLICY "Subjects insertable by class members"
    ON public.subjects FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_class(class_id));

CREATE POLICY "Subjects updatable by class members"
    ON public.subjects FOR UPDATE
    TO authenticated
    USING (public.is_member_of_class(class_id));

-- 6. Schedule:
-- Personal schedule or class schedule readable/editable by user
CREATE POLICY "Schedule viewable by class members"
    ON public.schedule FOR SELECT
    TO authenticated
    USING (public.is_member_of_class(class_id) OR user_id = auth.uid());

CREATE POLICY "Schedule insertable by owner"
    ON public.schedule FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Schedule updatable by owner"
    ON public.schedule FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Schedule deletable by owner"
    ON public.schedule FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 7. Assignments:
-- Personal homework readable and manageable only by owner
CREATE POLICY "Assignments viewable by owner"
    ON public.assignments FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Assignments insertable by owner"
    ON public.assignments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Assignments updatable by owner"
    ON public.assignments FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Assignments deletable by owner"
    ON public.assignments FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 8. Exams:
-- Exams viewable by class members
CREATE POLICY "Exams viewable by class members"
    ON public.exams FOR SELECT
    TO authenticated
    USING (public.is_member_of_class(class_id));

CREATE POLICY "Exams insertable by class members"
    ON public.exams FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_class(class_id) AND auth.uid() = user_id);

CREATE POLICY "Exams updatable by author"
    ON public.exams FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Exams deletable by author"
    ON public.exams FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 9. Materials:
-- Class materials viewable by class members
CREATE POLICY "Materials viewable by class members"
    ON public.materials FOR SELECT
    TO authenticated
    USING (public.is_member_of_class(class_id));

CREATE POLICY "Materials insertable by class members"
    ON public.materials FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_class(class_id) AND auth.uid() = user_id);

CREATE POLICY "Materials deletable by author"
    ON public.materials FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 10. Messages:
-- Messages viewable only by class members
CREATE POLICY "Messages viewable by class members"
    ON public.messages FOR SELECT
    TO authenticated
    USING (public.is_member_of_class(class_id));

CREATE POLICY "Messages insertable by class members"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_class(class_id) AND auth.uid() = user_id);

CREATE POLICY "Messages deletable only by author"
    ON public.messages FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 11. Reports:
-- Users can file a report on a message
CREATE POLICY "Reports insertable by reporter"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = reporter_id);

-- 12. Blocked Users:
-- Users can block and view their own blocked list
CREATE POLICY "Blocked users viewable by blocker"
    ON public.blocked_users FOR SELECT
    TO authenticated
    USING (auth.uid() = blocker_id);

CREATE POLICY "Blocked users insertable by blocker"
    ON public.blocked_users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Blocked users removable by blocker"
    ON public.blocked_users FOR DELETE
    TO authenticated
    USING (auth.uid() = blocker_id);

-- 13. Notifications:
-- Users can view and update their own notifications
CREATE POLICY "Notifications viewable by recipient"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Notifications updatable by recipient"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- ==========================================================
-- REALTIME ENABLEMENT
-- ==========================================================
-- Add tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ==========================================================
-- STORAGE BUCKETS SETUP (Storage policies in Supabase)
-- ==========================================================
-- Run this in Storage -> Configuration or SQL:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('class-materials', 'class-materials', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies:
CREATE POLICY "Authenticated users can upload materials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'class-materials');

CREATE POLICY "Authenticated users can read materials"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'class-materials');

CREATE POLICY "Users can upload avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Avatars are publicly readable"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');
