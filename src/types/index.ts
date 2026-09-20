export type SupportedLanguage = 'ru' | 'uz' | 'en';
export type ThemeMode = 'dark' | 'light';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  school_id?: string | null;
  class_id?: string | null;
  grade?: number | null;
  letter?: string | null;
  theme: ThemeMode;
  language: SupportedLanguage;
  notifications_enabled: boolean;
  homework_reminders_enabled?: boolean;
  reminder_time?: string;
  role?: 'admin' | 'student' | 'teacher';
  is_admin?: boolean;
  email?: string;
  school?: School | null;
  created_at?: string;
  updated_at?: string;
}

export interface School {
  id: string;
  name: string;
  city: string;
  created_at?: string;
}

export interface ClassGroup {
  id: string;
  school_id: string;
  name: string; // e.g. "8-А"
  grade: number;
  letter: string;
  invite_code: string;
  created_by: string;
  created_at?: string;
  school?: School;
  members_count?: number;
}

export interface ClassMember {
  id: string;
  class_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface Subject {
  id: string;
  class_id: string;
  name: string;
  color: string;
  created_at?: string;
}

export interface ScheduleLesson {
  id: string;
  class_id: string;
  user_id: string;
  subject_id: string;
  day_of_week: number; // 1 = Пн ... 6 = Сб
  lesson_number: number;
  start_time: string; // "08:00"
  end_time: string;   // "08:45"
  room?: string | null;
  teacher?: string | null;
  created_at?: string;
  subject?: Subject;
}

export interface Assignment {
  id: string;
  user_id: string;
  class_id?: string | null;
  subject_id: string;
  title: string;
  description?: string | null;
  due_date: string; // "YYYY-MM-DD"
  completed: boolean;
  created_at?: string;
  updated_at?: string;
  subject?: Subject;
}

export interface Exam {
  id: string;
  user_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description?: string | null;
  exam_date: string; // "YYYY-MM-DD"
  created_at?: string;
  subject?: Subject;
}

export interface Material {
  id: string;
  class_id: string;
  user_id: string;
  subject_id?: string | null;
  title: string;
  description?: string | null;
  file_path: string;
  file_size?: number | null;
  file_type?: string | null;
  created_at?: string;
  subject?: Subject;
  profile?: Profile;
}

export interface Message {
  id: string;
  class_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  profile?: Profile;
}

export interface Report {
  id: string;
  reporter_id: string;
  message_id: string;
  reason: 'Спам' | 'Оскорбление' | 'Неподходящий контент' | 'Другое';
  created_at?: string;
}

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_user_id: string;
  created_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'homework' | 'schedule' | 'exam' | 'chat' | 'class';
  is_read: boolean;
  created_at: string;
  link_tab?: 'homework' | 'schedule' | 'class' | 'grades' | 'dashboard';
  metadata?: {
    subject_name?: string;
    due_date?: string;
    lesson_number?: number;
    day_of_week?: number;
    room?: string;
    teacher?: string;
    action?: 'created' | 'updated' | 'deleted';
    [key: string]: any;
  };
}

export type GradeType = 'homework' | 'classwork' | 'quiz' | 'test' | 'exam' | 'oral' | 'quarter';

export interface Grade {
  id: string;
  user_id: string;
  class_id?: string | null;
  subject_id: string;
  value: number; // 2, 3, 4, 5
  weight?: number; // 1, 1.5, 2
  type?: GradeType;
  topic?: string | null;
  date: string; // YYYY-MM-DD
  created_at?: string;
  subject?: Subject;
}
