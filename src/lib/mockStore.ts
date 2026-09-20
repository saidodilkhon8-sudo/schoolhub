import {
  School,
  ClassGroup,
  ClassMember,
  Profile,
  Subject,
  ScheduleLesson,
  Assignment,
  Exam,
  Message,
  Material,
  Grade,
  NotificationItem,
} from '../types';
import { generateInviteCode } from '../utils/format';

const DEFAULT_SCHOOLS: School[] = [
  { id: 'sch-1', name: 'Школа №1 им. Алишера Навои', city: 'Ташкент' },
  { id: 'sch-2', name: 'Школа №17 с углубленным изучением языков', city: 'Ташкент' },
  { id: 'sch-3', name: 'Школа №110 Мирабадского района', city: 'Ташкент' },
  { id: 'sch-4', name: 'Президентская школа', city: 'Ташкент' },
  { id: 'sch-5', name: 'Академический лицей при ТГТУ', city: 'Ташкент' },
  { id: 'sch-6', name: 'Школа №42', city: 'Самарканд' },
  { id: 'sch-7', name: 'Школа №8', city: 'Бухара' },
];

const DEFAULT_SUBJECTS_LIST = [
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

function loadItem<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(`schoolhub_${key}`);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function saveItem<T>(key: string, val: T): void {
  try {
    localStorage.setItem(`schoolhub_${key}`, JSON.stringify(val));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

// 1. SCHOOLS
export function getMockSchools(): School[] {
  return loadItem<School[]>('schools', DEFAULT_SCHOOLS);
}

export function searchMockSchools(query: string): School[] {
  const all = getMockSchools();
  const clean = query.trim().toLowerCase();
  if (!clean) return all.slice(0, 10);
  return all.filter((s) => s.name.toLowerCase().includes(clean) || s.city.toLowerCase().includes(clean));
}

export function getMockSchoolById(id: string): School | null {
  const all = getMockSchools();
  return all.find((s) => s.id === id) || null;
}

export function findOrCreateMockSchool(name: string, city: string): School {
  const cleanName = name.trim();
  const cleanCity = city.trim();
  const all = getMockSchools();
  
  const existing = all.find(
    (s) => s.name.toLowerCase() === cleanName.toLowerCase() && s.city.toLowerCase() === cleanCity.toLowerCase()
  );
  if (existing) return existing;

  const newSchool: School = {
    id: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    city: cleanCity,
    created_at: new Date().toISOString(),
  };

  all.push(newSchool);
  saveItem('schools', all);
  return newSchool;
}

// 2. CLASSES
export function getMockClasses(): ClassGroup[] {
  return loadItem<ClassGroup[]>('classes', []);
}

export function findMockClassBySchoolAndGradeLetter(
  schoolId: string,
  grade: number,
  letter: string
): ClassGroup | null {
  const cleanLetter = letter.trim().toUpperCase();
  const classes = getMockClasses();
  const found = classes.find(
    (c) => c.school_id === schoolId && c.grade === grade && c.letter.toUpperCase() === cleanLetter
  );
  if (!found) return null;
  const school = getMockSchoolById(found.school_id);
  return { ...found, school: school || undefined };
}

export function findMockClassByInviteCode(code: string): ClassGroup | null {
  const clean = code.trim().toUpperCase();
  const classes = getMockClasses();
  const found = classes.find((c) => c.invite_code.toUpperCase() === clean);
  if (!found) return null;
  const school = getMockSchoolById(found.school_id);
  return { ...found, school: school || undefined };
}

export function getMockClassById(classId: string): ClassGroup | null {
  const classes = getMockClasses();
  const found = classes.find((c) => c.id === classId);
  if (!found) return null;
  const school = getMockSchoolById(found.school_id);
  return { ...found, school: school || undefined };
}

export function createMockClassGroup(params: {
  schoolId: string;
  grade: number;
  letter: string;
  userId: string;
}): ClassGroup {
  const cleanLetter = params.letter.trim().toUpperCase();
  const name = `${params.grade}-${cleanLetter}`;
  const inviteCode = generateInviteCode(params.grade, cleanLetter);
  const classes = getMockClasses();

  const newClass: ClassGroup = {
    id: `cls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    school_id: params.schoolId,
    name,
    grade: params.grade,
    letter: cleanLetter,
    invite_code: inviteCode,
    created_by: params.userId,
    created_at: new Date().toISOString(),
  };

  classes.push(newClass);
  saveItem('classes', classes);

  // Auto add user to members
  joinMockClass(newClass.id, params.userId);
  // Auto init subjects
  initMockSubjects(newClass.id);

  const school = getMockSchoolById(params.schoolId);
  return { ...newClass, school: school || undefined };
}

// 3. CLASS MEMBERS
export function getMockClassMembers(classId: string): ClassMember[] {
  const members = loadItem<ClassMember[]>('members', []);
  const classMembers = members.filter((m) => m.class_id === classId);
  const profiles = loadItem<Profile[]>('profiles', []);

  return classMembers.map((m) => {
    const p = profiles.find((prof) => prof.id === m.user_id);
    return {
      ...m,
      profile: p || undefined,
    };
  });
}

export function joinMockClass(classId: string, userId: string): void {
  const members = loadItem<ClassMember[]>('members', []);
  if (!members.some((m) => m.class_id === classId && m.user_id === userId)) {
    members.push({
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      class_id: classId,
      user_id: userId,
      joined_at: new Date().toISOString(),
    });
    saveItem('members', members);
  }
}

export function leaveMockClass(classId: string, userId: string): void {
  const members = loadItem<ClassMember[]>('members', []);
  saveItem('members', members.filter((m) => !(m.class_id === classId && m.user_id === userId)));

  // Also remove class_id, grade, and letter from the mock profile if found
  const profiles = loadItem<Profile[]>('profiles', DEFAULT_PROFILES_SEEDED);
  const idx = profiles.findIndex((p) => p.id === userId);
  if (idx >= 0 && profiles[idx].class_id === classId) {
    profiles[idx] = {
      ...profiles[idx],
      class_id: null,
      grade: null,
      letter: null,
      updated_at: new Date().toISOString(),
    };
    saveItem('profiles', profiles);
  }

  // Also sync demo user session in localStorage if active
  try {
    const savedDemo = localStorage.getItem('schoolhub_demo_user');
    if (savedDemo) {
      const parsed = JSON.parse(savedDemo);
      if (parsed?.profile && (parsed.profile.id === userId || parsed.user?.id === userId)) {
        parsed.profile = {
          ...parsed.profile,
          class_id: null,
          grade: null,
          letter: null,
        };
        localStorage.setItem('schoolhub_demo_user', JSON.stringify(parsed));
      }
    }
  } catch {}
}

// 4. PROFILES
export const DEFAULT_PROFILES_SEEDED: Profile[] = [
  {
    id: 'admin-super-user-id',
    first_name: 'Саидодилхон',
    last_name: '',
    email: 'saidodilkhon2@gmail.com',
    role: 'admin',
    is_admin: true,
    school_id: 'sch-1',
    class_id: 'mock-class-1',
    grade: 8,
    letter: 'А',
    theme: 'dark',
    language: 'ru',
    notifications_enabled: true,
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-student-user-id',
    first_name: 'Саидодилхон',
    last_name: '',
    email: 'saidodilkhon8@gmail.com',
    role: 'admin',
    is_admin: true,
    school_id: 'sch-1',
    class_id: 'mock-class-1',
    grade: 8,
    letter: 'А',
    theme: 'dark',
    language: 'ru',
    notifications_enabled: true,
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-2',
    first_name: 'Алексей',
    last_name: 'Смирнов',
    email: 'alex.smirnov@school.uz',
    role: 'student',
    is_admin: false,
    school_id: 'sch-1',
    class_id: 'mock-class-1',
    grade: 8,
    letter: 'А',
    theme: 'dark',
    language: 'ru',
    notifications_enabled: true,
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 'student-3',
    first_name: 'Мария',
    last_name: 'Иванова',
    email: 'masha.ivanova@school.uz',
    role: 'student',
    is_admin: false,
    school_id: 'sch-1',
    class_id: 'mock-class-1',
    grade: 8,
    letter: 'А',
    theme: 'dark',
    language: 'ru',
    notifications_enabled: true,
    created_at: new Date(Date.now() - 86400000 * 18).toISOString(),
  },
  {
    id: 'student-4',
    first_name: 'Даниил',
    last_name: 'Попов',
    email: 'daniil.popov@school.uz',
    role: 'student',
    is_admin: false,
    school_id: 'sch-1',
    class_id: 'mock-class-1',
    grade: 8,
    letter: 'А',
    theme: 'dark',
    language: 'ru',
    notifications_enabled: true,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'student-5',
    first_name: 'София',
    last_name: 'Ким',
    email: 'sofia.kim@school.uz',
    role: 'student',
    is_admin: false,
    school_id: 'sch-1',
    class_id: 'mock-class-1',
    grade: 8,
    letter: 'А',
    theme: 'dark',
    language: 'ru',
    notifications_enabled: true,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'teacher-1',
    first_name: 'Елена',
    last_name: 'Викторовна',
    email: 'elena.victorovna@school.uz',
    role: 'teacher',
    is_admin: false,
    school_id: 'sch-1',
    class_id: 'mock-class-1',
    grade: 8,
    letter: 'А',
    theme: 'light',
    language: 'ru',
    notifications_enabled: true,
    created_at: new Date(Date.now() - 86400000 * 40).toISOString(),
  },
];

export function getMockProfile(userId: string): Profile | null {
  const profiles = loadItem<Profile[]>('profiles', DEFAULT_PROFILES_SEEDED);
  const prof = profiles.find((p) => p.id === userId);
  if (!prof) return null;
  if (prof.school_id) {
    prof.school = getMockSchoolById(prof.school_id);
  }
  return prof;
}

export function updateMockProfile(userId: string, updates: Partial<Profile>): Profile {
  const profiles = loadItem<Profile[]>('profiles', DEFAULT_PROFILES_SEEDED);
  let existingIndex = profiles.findIndex((p) => p.id === userId);

  let updated: Profile;
  if (existingIndex >= 0) {
    updated = {
      ...profiles[existingIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    profiles[existingIndex] = updated;
  } else {
    updated = {
      id: userId,
      first_name: updates.first_name || '',
      last_name: updates.last_name || '',
      theme: 'dark',
      language: 'ru',
      notifications_enabled: true,
      ...updates,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    profiles.push(updated);
  }

  if (updated.school_id) {
    updated.school = getMockSchoolById(updated.school_id);
  }

  saveItem('profiles', profiles);

  // Sync to demo session in localStorage if active
  try {
    const savedDemo = localStorage.getItem('schoolhub_demo_user');
    if (savedDemo) {
      const parsed = JSON.parse(savedDemo);
      if (parsed?.user?.id === userId || parsed?.profile?.id === userId) {
        parsed.profile = { ...parsed.profile, ...updated };
        localStorage.setItem('schoolhub_demo_user', JSON.stringify(parsed));
      }
    }
  } catch {}

  return updated;
}

// 5. SUBJECTS
export function initMockSubjects(classId: string): Subject[] {
  const subjects = loadItem<Subject[]>('subjects', []);
  const classSubjects = subjects.filter((s) => s.class_id === classId);
  if (classSubjects.length > 0) return classSubjects;

  const newSubjects: Subject[] = DEFAULT_SUBJECTS_LIST.map((s, idx) => ({
    id: `sub-${classId}-${idx + 1}`,
    class_id: classId,
    name: s.name,
    color: s.color,
    created_at: new Date().toISOString(),
  }));

  subjects.push(...newSubjects);
  saveItem('subjects', subjects);
  return newSubjects;
}

export function getMockSubjects(classId: string): Subject[] {
  return initMockSubjects(classId);
}

export function createMockSubject(classId: string, name: string, color: string = '#3b82f6'): Subject {
  const subjects = loadItem<Subject[]>('subjects', []);
  const newSub: Subject = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    class_id: classId,
    name: name.trim(),
    color,
    created_at: new Date().toISOString(),
  };
  subjects.push(newSub);
  saveItem('subjects', subjects);
  return newSub;
}

// 6. SCHEDULE
export function getMockSchedule(classId: string): ScheduleLesson[] {
  const lessons = loadItem<ScheduleLesson[]>('schedule', []);
  const classLessons = lessons.filter((l) => l.class_id === classId);
  const subjects = getMockSubjects(classId);

  return classLessons
    .map((l) => ({
      ...l,
      subject: subjects.find((s) => s.id === l.subject_id),
    }))
    .sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      return a.lesson_number - b.lesson_number;
    });
}

export function addMockLesson(lesson: {
  class_id: string;
  user_id: string;
  subject_id: string;
  day_of_week: number;
  lesson_number: number;
  start_time: string;
  end_time: string;
  room?: string;
  teacher?: string;
}): ScheduleLesson {
  const lessons = loadItem<ScheduleLesson[]>('schedule', []);
  const subjects = getMockSubjects(lesson.class_id);

  const newLesson: ScheduleLesson = {
    id: `les-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    class_id: lesson.class_id,
    user_id: lesson.user_id,
    subject_id: lesson.subject_id,
    day_of_week: lesson.day_of_week,
    lesson_number: lesson.lesson_number,
    start_time: lesson.start_time,
    end_time: lesson.end_time,
    room: lesson.room || null,
    teacher: lesson.teacher || null,
    created_at: new Date().toISOString(),
    subject: subjects.find((s) => s.id === lesson.subject_id),
  };

  lessons.push(newLesson);
  saveItem('schedule', lessons);
  return newLesson;
}

export function updateMockLesson(
  id: string,
  updates: Partial<Omit<ScheduleLesson, 'id' | 'subject'>>
): ScheduleLesson {
  const lessons = loadItem<ScheduleLesson[]>('schedule', []);
  const idx = lessons.findIndex((l) => l.id === id);
  if (idx < 0) throw new Error('Lesson not found');

  const updated = { ...lessons[idx], ...updates };
  lessons[idx] = updated;
  saveItem('schedule', lessons);

  const subjects = getMockSubjects(updated.class_id);
  return { ...updated, subject: subjects.find((s) => s.id === updated.subject_id) };
}

export function deleteMockLesson(id: string): void {
  const lessons = loadItem<ScheduleLesson[]>('schedule', []);
  saveItem('schedule', lessons.filter((l) => l.id !== id));
}

export function reorderMockLessons(classId: string, dayOfWeek: number, orderedIds: string[]): void {
  const lessons = loadItem<ScheduleLesson[]>('schedule', []);
  orderedIds.forEach((id, index) => {
    const item = lessons.find((l) => l.id === id && l.class_id === classId && l.day_of_week === dayOfWeek);
    if (item) {
      item.lesson_number = index + 1;
    }
  });
  saveItem('schedule', lessons);
}

// 7. ASSIGNMENTS (HOMEWORK)
export function getMockAssignments(userId: string): Assignment[] {
  const list = loadItem<Assignment[]>('assignments', []);
  const userList = list.filter((a) => a.user_id === userId);
  const subjects = loadItem<Subject[]>('subjects', []);

  return userList
    .map((a) => ({
      ...a,
      subject: subjects.find((s) => s.id === a.subject_id),
    }))
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

export function createMockAssignment(assignment: {
  user_id: string;
  class_id?: string | null;
  subject_id: string;
  title: string;
  description?: string;
  due_date: string;
}): Assignment {
  const list = loadItem<Assignment[]>('assignments', []);
  const subjects = loadItem<Subject[]>('subjects', []);

  const newAssignment: Assignment = {
    id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: assignment.user_id,
    class_id: assignment.class_id || null,
    subject_id: assignment.subject_id,
    title: assignment.title.trim(),
    description: assignment.description?.trim() || null,
    due_date: assignment.due_date,
    completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subject: subjects.find((s) => s.id === assignment.subject_id),
  };

  list.push(newAssignment);
  saveItem('assignments', list);
  return newAssignment;
}

export function toggleMockAssignment(id: string, completed: boolean): void {
  const list = loadItem<Assignment[]>('assignments', []);
  const item = list.find((a) => a.id === id);
  if (item) {
    item.completed = completed;
    item.updated_at = new Date().toISOString();
    saveItem('assignments', list);
  }
}

export function deleteMockAssignment(id: string): void {
  const list = loadItem<Assignment[]>('assignments', []);
  saveItem('assignments', list.filter((a) => a.id !== id));
}

export function updateMockAssignment(
  id: string,
  updates: Partial<Omit<Assignment, 'id' | 'subject'>>
): Assignment {
  const list = loadItem<Assignment[]>('assignments', []);
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('Assignment not found');

  const updated = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
  list[idx] = updated;
  saveItem('assignments', list);

  const subjects = loadItem<Subject[]>('subjects', []);
  return { ...updated, subject: subjects.find((s) => s.id === updated.subject_id) };
}

// 8. EXAMS
export function getMockExams(classId: string): Exam[] {
  const list = loadItem<Exam[]>('exams', []);
  const classList = list.filter((e) => e.class_id === classId);
  const subjects = getMockSubjects(classId);

  return classList
    .map((e) => ({
      ...e,
      subject: subjects.find((s) => s.id === e.subject_id),
    }))
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
}

export function createMockExam(exam: {
  class_id: string;
  user_id: string;
  subject_id: string;
  title: string;
  description?: string;
  exam_date: string;
}): Exam {
  const list = loadItem<Exam[]>('exams', []);
  const subjects = getMockSubjects(exam.class_id);

  const newExam: Exam = {
    id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    class_id: exam.class_id,
    user_id: exam.user_id,
    subject_id: exam.subject_id,
    title: exam.title.trim(),
    description: exam.description?.trim() || null,
    exam_date: exam.exam_date,
    created_at: new Date().toISOString(),
    subject: subjects.find((s) => s.id === exam.subject_id),
  };

  list.push(newExam);
  saveItem('exams', list);
  return newExam;
}

export function deleteMockExam(id: string): void {
  const list = loadItem<Exam[]>('exams', []);
  saveItem('exams', list.filter((e) => e.id !== id));
}

// 9. MESSAGES
export function getMockMessages(classId: string): Message[] {
  const list = loadItem<Message[]>('messages', []);
  const classMessages = list.filter((m) => m.class_id === classId);
  const profiles = loadItem<Profile[]>('profiles', []);

  return classMessages
    .map((m) => ({
      ...m,
      profile: profiles.find((p) => p.id === m.user_id),
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function sendMockMessage(classId: string, userId: string, content: string): Message {
  const list = loadItem<Message[]>('messages', []);
  const profiles = loadItem<Profile[]>('profiles', []);

  const newMsg: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    class_id: classId,
    user_id: userId,
    content: content.trim(),
    created_at: new Date().toISOString(),
    profile: profiles.find((p) => p.id === userId),
  };

  list.push(newMsg);
  saveItem('messages', list);

  // Dispatch custom event for realtime subscribers
  window.dispatchEvent(new CustomEvent('schoolhub_new_message', { detail: newMsg }));
  return newMsg;
}

export function deleteMockMessage(id: string): void {
  const list = loadItem<Message[]>('messages', []);
  saveItem('messages', list.filter((m) => m.id !== id));
  window.dispatchEvent(new CustomEvent('schoolhub_delete_message', { detail: { id } }));
}

// 10. MATERIALS
export function getMockMaterials(classId: string): Material[] {
  const list = loadItem<Material[]>('materials', []);
  const classList = list.filter((m) => m.class_id === classId);
  const subjects = getMockSubjects(classId);
  const profiles = loadItem<Profile[]>('profiles', []);

  return classList.map((m) => ({
    ...m,
    subject: subjects.find((s) => s.id === m.subject_id),
    profile: profiles.find((p) => p.id === m.user_id),
  }));
}

export function createMockMaterial(material: {
  class_id: string;
  user_id: string;
  subject_id?: string | null;
  title: string;
  description?: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
}): Material {
  const list = loadItem<Material[]>('materials', []);
  const subjects = getMockSubjects(material.class_id);
  const profiles = loadItem<Profile[]>('profiles', []);

  const newMat: Material = {
    id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    class_id: material.class_id,
    user_id: material.user_id,
    subject_id: material.subject_id || null,
    title: material.title.trim(),
    description: material.description?.trim() || null,
    file_path: material.file_path,
    file_size: material.file_size || null,
    file_type: material.file_type || null,
    created_at: new Date().toISOString(),
    subject: subjects.find((s) => s.id === material.subject_id),
    profile: profiles.find((p) => p.id === material.user_id),
  };

  list.push(newMat);
  saveItem('materials', list);
  return newMat;
}

export function deleteMockMaterial(id: string): void {
  const list = loadItem<Material[]>('materials', []);
  saveItem('materials', list.filter((m) => m.id !== id));
}

// 11. BLOCKS & REPORTS
export function blockMockUser(blockerId: string, blockedUserId: string): void {
  const blocks = loadItem<Array<{ blocker_id: string; blocked_user_id: string }>>('blocks', []);
  if (!blocks.some((b) => b.blocker_id === blockerId && b.blocked_user_id === blockedUserId)) {
    blocks.push({ blocker_id: blockerId, blocked_user_id: blockedUserId });
    saveItem('blocks', blocks);
  }
}

export function getBlockedMockUserIds(blockerId: string): string[] {
  const blocks = loadItem<Array<{ blocker_id: string; blocked_user_id: string }>>('blocks', []);
  return blocks.filter((b) => b.blocker_id === blockerId).map((b) => b.blocked_user_id);
}

export function reportMockMessage(reporterId: string, messageId: string, reason: string): void {
  const reports = loadItem<Array<{ reporter_id: string; message_id: string; reason: string; created_at: string }>>(
    'reports',
    []
  );
  reports.push({ reporter_id: reporterId, message_id: messageId, reason, created_at: new Date().toISOString() });
  saveItem('reports', reports);
}

// 12. GRADES (ОЦЕНКИ)
export function getMockGrades(userId: string): Grade[] {
  let list = loadItem<Grade[]>('grades', []);
  const userGrades = list.filter((g) => g.user_id === userId);

  // If user has no grades yet, seed realistic starter grades for their subjects
  if (userGrades.length === 0) {
    const profiles = loadItem<Profile[]>('profiles', []);
    const userProfile = profiles.find((p) => p.id === userId);
    const classId = userProfile?.class_id || 'cls-sample';
    const subjects = getMockSubjects(classId);

    const sampleGradesData: Array<{
      subIdx: number;
      val: number;
      type: Grade['type'];
      weight: number;
      topic: string;
      daysAgo: number;
    }> = [
      { subIdx: 0, val: 5, type: 'classwork', weight: 1, topic: 'Квадратные уравнения', daysAgo: 1 },
      { subIdx: 0, val: 5, type: 'homework', weight: 1, topic: 'Упражнение 341-345', daysAgo: 3 },
      { subIdx: 0, val: 4, type: 'test', weight: 1.5, topic: 'Самостоятельная работа №4', daysAgo: 7 },
      { subIdx: 0, val: 5, type: 'oral', weight: 1, topic: 'Ответ у доски', daysAgo: 10 },
      { subIdx: 1, val: 5, type: 'test', weight: 1.5, topic: 'Законы Ньютона', daysAgo: 2 },
      { subIdx: 1, val: 4, type: 'homework', weight: 1, topic: 'Задачи 12.1 - 12.8', daysAgo: 5 },
      { subIdx: 1, val: 5, type: 'classwork', weight: 1, topic: 'Лабораторная работа №2', daysAgo: 9 },
      { subIdx: 2, val: 5, type: 'test', weight: 1.5, topic: 'Алгоритмы и структуры', daysAgo: 2 },
      { subIdx: 2, val: 5, type: 'classwork', weight: 1, topic: 'Практикум в Python', daysAgo: 6 },
      { subIdx: 3, val: 5, type: 'oral', weight: 1, topic: 'История Темуридов', daysAgo: 4 },
      { subIdx: 3, val: 4, type: 'homework', weight: 1, topic: 'Конспект параграфа 18', daysAgo: 8 },
      { subIdx: 4, val: 4, type: 'test', weight: 1.5, topic: 'Контрольный диктант', daysAgo: 3 },
      { subIdx: 4, val: 5, type: 'classwork', weight: 1, topic: 'Синтаксический разбор', daysAgo: 6 },
      { subIdx: 5, val: 5, type: 'oral', weight: 1, topic: 'Анализ стихотворения', daysAgo: 5 },
      { subIdx: 5, val: 5, type: 'homework', weight: 1, topic: 'Сочинение-рассуждение', daysAgo: 11 },
      { subIdx: 6, val: 5, type: 'test', weight: 1.5, topic: 'Vocabulary & Grammar Unit 4', daysAgo: 2 },
      { subIdx: 6, val: 4, type: 'oral', weight: 1, topic: 'Speaking presentation', daysAgo: 7 },
      { subIdx: 7, val: 5, type: 'homework', weight: 1, topic: 'Строение клетки', daysAgo: 6 },
    ];

    const seededGrades: Grade[] = [];
    sampleGradesData.forEach((item, index) => {
      const subject = subjects[item.subIdx] || subjects[0];
      if (!subject) return;

      const d = new Date();
      d.setDate(d.getDate() - item.daysAgo);
      const dateStr = d.toISOString().split('T')[0];

      seededGrades.push({
        id: `grd-seed-${index + 1}`,
        user_id: userId,
        class_id: classId,
        subject_id: subject.id,
        value: item.val,
        weight: item.weight,
        type: item.type,
        topic: item.topic,
        date: dateStr,
        created_at: d.toISOString(),
        subject,
      });
    });

    list = [...list, ...seededGrades];
    saveItem('grades', list);
    return seededGrades;
  }

  // Populate subject references
  const allSubjects = loadItem<Subject[]>('subjects', []);
  return userGrades.map((g) => ({
    ...g,
    subject: allSubjects.find((s) => s.id === g.subject_id),
  }));
}

export function createMockGrade(grade: {
  user_id: string;
  class_id?: string | null;
  subject_id: string;
  value: number;
  weight?: number;
  type?: Grade['type'];
  topic?: string | null;
  date: string;
}): Grade {
  const list = loadItem<Grade[]>('grades', []);
  const allSubjects = loadItem<Subject[]>('subjects', []);
  const targetSub = allSubjects.find((s) => s.id === grade.subject_id);

  const newGrade: Grade = {
    id: `grd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: grade.user_id,
    class_id: grade.class_id || null,
    subject_id: grade.subject_id,
    value: Number(grade.value),
    weight: grade.weight ?? 1,
    type: grade.type || 'classwork',
    topic: grade.topic?.trim() || null,
    date: grade.date,
    created_at: new Date().toISOString(),
    subject: targetSub,
  };

  list.push(newGrade);
  saveItem('grades', list);
  return newGrade;
}

export function updateMockGrade(id: string, updates: Partial<Grade>): Grade | null {
  const list = loadItem<Grade[]>('grades', []);
  const idx = list.findIndex((g) => g.id === id);
  if (idx < 0) return null;

  const allSubjects = loadItem<Subject[]>('subjects', []);
  const updated: Grade = {
    ...list[idx],
    ...updates,
    value: updates.value !== undefined ? Number(updates.value) : list[idx].value,
    weight: updates.weight !== undefined ? Number(updates.weight) : list[idx].weight,
  };

  if (updated.subject_id) {
    updated.subject = allSubjects.find((s) => s.id === updated.subject_id) || updated.subject;
  }

  list[idx] = updated;
  saveItem('grades', list);
  return updated;
}

export function deleteMockGrade(id: string): void {
  const list = loadItem<Grade[]>('grades', []);
  saveItem(
    'grades',
    list.filter((g) => g.id !== id)
  );
}

// 12. NOTIFICATIONS
const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-welcome-1',
    user_id: 'default-student',
    title: 'Добро пожаловать в SchoolHub!',
    message: 'Включены уведомления в реальном времени для расписания и домашних заданий.',
    type: 'class',
    is_read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    link_tab: 'dashboard',
  },
];

export function getMockNotifications(userId: string): NotificationItem[] {
  const list = loadItem<NotificationItem[]>('notifications', DEFAULT_NOTIFICATIONS);
  return list
    .filter((n) => n.user_id === userId || n.user_id === 'default-student')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createMockNotification(item: Omit<NotificationItem, 'id' | 'created_at'>): NotificationItem {
  const list = loadItem<NotificationItem[]>('notifications', DEFAULT_NOTIFICATIONS);
  const newNotif: NotificationItem = {
    ...item,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  list.unshift(newNotif);
  saveItem('notifications', list);
  return newNotif;
}

export function markMockNotificationRead(id: string): void {
  const list = loadItem<NotificationItem[]>('notifications', DEFAULT_NOTIFICATIONS);
  const updated = list.map((n) => (n.id === id ? { ...n, is_read: true } : n));
  saveItem('notifications', updated);
}

export function markAllMockNotificationsRead(userId: string): void {
  const list = loadItem<NotificationItem[]>('notifications', DEFAULT_NOTIFICATIONS);
  const updated = list.map((n) =>
    n.user_id === userId || n.user_id === 'default-student' ? { ...n, is_read: true } : n
  );
  saveItem('notifications', updated);
}

export function deleteMockNotification(id: string): void {
  const list = loadItem<NotificationItem[]>('notifications', DEFAULT_NOTIFICATIONS);
  saveItem(
    'notifications',
    list.filter((n) => n.id !== id)
  );
}

export function clearAllMockNotifications(userId: string): void {
  const list = loadItem<NotificationItem[]>('notifications', DEFAULT_NOTIFICATIONS);
  saveItem(
    'notifications',
    list.filter((n) => n.user_id !== userId && n.user_id !== 'default-student')
  );
}

// 12. ADMIN HELPERS
export function getMockAllProfiles(): Profile[] {
  const profiles = loadItem<Profile[]>('profiles', DEFAULT_PROFILES_SEEDED);
  const schools = getMockSchools();
  return profiles.map((p) => ({
    ...p,
    school: p.school_id ? schools.find((s) => s.id === p.school_id) || null : null,
  }));
}

export function updateMockUserRole(
  userId: string,
  role: 'admin' | 'student' | 'teacher',
  isAdmin: boolean
): Profile | null {
  const profiles = loadItem<Profile[]>('profiles', DEFAULT_PROFILES_SEEDED);
  const idx = profiles.findIndex((p) => p.id === userId);
  if (idx < 0) return null;

  profiles[idx] = {
    ...profiles[idx],
    role,
    is_admin: isAdmin,
    updated_at: new Date().toISOString(),
  };
  saveItem('profiles', profiles);
  return profiles[idx];
}

export function deleteMockProfile(userId: string): void {
  const profiles = loadItem<Profile[]>('profiles', DEFAULT_PROFILES_SEEDED);
  saveItem(
    'profiles',
    profiles.filter((p) => p.id !== userId)
  );
}

export function getMockAllAssignments(): Assignment[] {
  return loadItem<Assignment[]>('assignments', []);
}

export interface AdminReportItem {
  id: string;
  reporter_id: string;
  message_id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

const DEFAULT_REPORTS: AdminReportItem[] = [
  {
    id: 'rep-1',
    reporter_id: 'student-2',
    message_id: 'msg-seed-1',
    reason: 'Спам в чате класса',
    status: 'pending',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'rep-2',
    reporter_id: 'student-4',
    message_id: 'msg-seed-2',
    reason: 'Некорректная ссылка на материал',
    status: 'pending',
    created_at: new Date(Date.now() - 18000000).toISOString(),
  },
];

export function getMockAdminReports(): AdminReportItem[] {
  return loadItem<AdminReportItem[]>('reports', DEFAULT_REPORTS);
}

export function resolveMockAdminReport(reportId: string, status: 'resolved' | 'dismissed'): void {
  const reports = loadItem<AdminReportItem[]>('reports', DEFAULT_REPORTS);
  const updated = reports.map((r) => (r.id === reportId ? { ...r, status } : r));
  saveItem('reports', updated);
}


