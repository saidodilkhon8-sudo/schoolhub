import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { searchSchools, findOrCreateSchool } from '../services/schools';
import {
  findClassBySchoolAndGradeLetter,
  findClassByInviteCode,
  createClassGroup,
  joinClass,
} from '../services/classes';
import { updateProfile } from '../services/profiles';
import { School, ClassGroup } from '../types';
import { School as SchoolIcon, Users, CheckCircle, Search, Key, Sparkles, AlertCircle } from 'lucide-react';

export function OnboardingPage() {
  const { user, refreshProfile, setProfileState } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  // Step 1: Name
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Step 2: School
  const [schoolName, setSchoolName] = useState('');
  const [schoolCity, setSchoolCity] = useState('');
  const [matchingSchools, setMatchingSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  // Step 3: Grade & Letter
  const [grade, setGrade] = useState<number>(8);
  const [letter, setLetter] = useState('А');

  // Matching & Invite Code
  const [foundClass, setFoundClass] = useState<ClassGroup | null>(null);
  const [checkingClass, setCheckingClass] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // On search school input change
  useEffect(() => {
    let active = true;
    if (schoolName.trim().length >= 2) {
      searchSchools(schoolName).then((list) => {
        if (active) setMatchingSchools(list);
      }).catch(console.warn);
    } else {
      setMatchingSchools([]);
    }
    return () => {
      active = false;
    };
  }, [schoolName]);

  // Check matching class when school, grade, and letter are provided
  const handleCheckMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showToast('Укажите имя и фамилию', 'error');
      return;
    }
    if (!schoolName.trim()) {
      showToast('Укажите номер или название школы', 'error');
      return;
    }
    if (!letter.trim()) {
      showToast('Укажите букву класса', 'error');
      return;
    }
    if (!user) {
      showToast('Сессия не найдена. Пожалуйста, перезагрузите страницу', 'error');
      return;
    }

    setCheckingClass(true);
    try {
      // 1. Find or create school
      const currentSchool = selectedSchool || (await findOrCreateSchool(schoolName, schoolCity || 'Ташкент'));
      setSelectedSchool(currentSchool);

      // 2. Search if class exists in this school
      const cleanLetter = letter.trim().toUpperCase();
      const existingClass = await findClassBySchoolAndGradeLetter(currentSchool.id, grade, cleanLetter);

      if (existingClass) {
        // Class already exists -> show confirmation dialog to let student join classmates
        setFoundClass(existingClass);
        showToast(`Найден класс ${existingClass.name}! Вы можете присоединиться`, 'info');
      } else {
        // No class exists yet -> automatically create it and complete onboarding!
        const createdClass = await createClassGroup({
          schoolId: currentSchool.id,
          grade,
          letter: cleanLetter,
          userId: user.id,
        });

        const updated = await updateProfile(user.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          school_id: currentSchool.id,
          class_id: createdClass.id,
          grade,
          letter: cleanLetter,
          theme: 'dark',
          language: 'ru',
          notifications_enabled: true,
        });

        setProfileState(updated);
        showToast(`Класс ${createdClass.name} успешно создан! Добро пожаловать!`, 'success');
        await refreshProfile();
      }
    } catch (err: any) {
      console.error('Check match error:', err);
      showToast(err?.message || 'Ошибка при сохранении данных', 'error');
    } finally {
      setCheckingClass(false);
    }
  };

  const handleJoinFoundClass = async () => {
    if (!user || !foundClass) return;
    setSubmitting(true);
    try {
      const cleanLetter = letter.trim().toUpperCase();
      const updated = await updateProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        school_id: foundClass.school_id,
        class_id: foundClass.id,
        grade,
        letter: cleanLetter,
        theme: 'dark',
        language: 'ru',
        notifications_enabled: true,
      });

      await joinClass(foundClass.id, user.id);
      setProfileState(updated);
      showToast(`Вы присоединились к классу ${foundClass.name}!`, 'success');
      await refreshProfile();
    } catch (err: any) {
      console.error('Join error:', err);
      showToast(err?.message || 'Не удалось присоединиться к классу', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewClass = async () => {
    if (!user || !selectedSchool) return;
    setSubmitting(true);
    try {
      const cleanLetter = letter.trim().toUpperCase();
      const created = await createClassGroup({
        schoolId: selectedSchool.id,
        grade,
        letter: cleanLetter,
        userId: user.id,
      });

      const updated = await updateProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        school_id: selectedSchool.id,
        class_id: created.id,
        grade,
        letter: cleanLetter,
        theme: 'dark',
        language: 'ru',
        notifications_enabled: true,
      });

      setProfileState(updated);
      showToast(`Класс ${created.name} успешно создан!`, 'success');
      await refreshProfile();
    } catch (err: any) {
      console.error('Create class error:', err);
      showToast(err?.message || 'Не удалось создать класс', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinByInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim() || !user) return;
    if (!firstName.trim() || !lastName.trim()) {
      showToast('Сначала введите ваше имя и фамилию', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const classByCode = await findClassByInviteCode(inviteCodeInput);
      if (!classByCode) {
        showToast('Класс с таким кодом приглашения не найден', 'error');
        return;
      }

      const updated = await updateProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        school_id: classByCode.school_id,
        class_id: classByCode.id,
        grade: classByCode.grade,
        letter: classByCode.letter,
        theme: 'dark',
        language: 'ru',
        notifications_enabled: true,
      });

      await joinClass(classByCode.id, user.id);
      setProfileState(updated);
      showToast(`Успешно! Вы вступили в ${classByCode.name}`, 'success');
      await refreshProfile();
    } catch (err: any) {
      console.error('Join by code error:', err);
      showToast(err?.message || 'Не удалось присоединиться по коду', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Школьный профиль ученика</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">
            Добро пожаловать в SchoolHub
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Заполни свои данные, чтобы подключиться к расписанию и чату твоего класса
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Option tabs: By Class info or By Invite Code */}
          <div className="flex p-1 bg-zinc-950 rounded-xl mb-6 border border-zinc-800">
            <button
              type="button"
              onClick={() => setIsJoiningByCode(false)}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                !isJoiningByCode
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Указать школу и класс
            </button>
            <button
              type="button"
              onClick={() => setIsJoiningByCode(true)}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                isJoiningByCode
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              У меня есть код приглашения
            </button>
          </div>

          {/* Student Names (required for both) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Имя (например, Said)
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Имя"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Фамилия
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Фамилия"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Form Mode 1: School & Class Selection */}
          {!isJoiningByCode && !foundClass && (
            <form onSubmit={handleCheckMatch} className="space-y-4">
              {/* School Name with auto-complete */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Школа (номер или название)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => {
                      setSchoolName(e.target.value);
                      setSelectedSchool(null);
                    }}
                    placeholder="Например: №123 или Лицей при Вестминстере"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {matchingSchools.length > 0 && !selectedSchool && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                      <div className="p-2 text-[11px] font-semibold text-zinc-400 border-b border-zinc-800">
                        Существующие школы в базе:
                      </div>
                      {matchingSchools.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSchool(s);
                            setSchoolName(s.name);
                            setSchoolCity(s.city);
                            setMatchingSchools([]);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-zinc-800 text-xs text-zinc-200 flex items-center justify-between border-b border-zinc-800/50 last:border-0"
                        >
                          <span className="font-semibold">{s.name}</span>
                          <span className="text-zinc-500 text-[11px]">{s.city}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* City (if new school) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Город
                </label>
                <input
                  type="text"
                  value={schoolCity}
                  onChange={(e) => setSchoolCity(e.target.value)}
                  placeholder="Ташкент, Самарканд, Москва..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Grade & Letter */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Класс (цифра)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((g) => (
                      <option key={g} value={g}>
                        {g} класс
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Буква (например: А, Б, В)
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    required
                    value={letter}
                    onChange={(e) => setLetter(e.target.value.toUpperCase())}
                    placeholder="А"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 uppercase focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={checkingClass}
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {checkingClass ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Проверить и продолжить</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Match Found Screen (Requirement 8) */}
          {foundClass && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-600/40 text-left">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Найден класс: {selectedSchool?.name || schoolName} · {foundClass.name}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Одноклассники уже создали этот класс в SchoolHub. Ты можешь присоединиться к ним прямо сейчас или создать отдельную ветку.
                </p>
                <div className="mt-2 text-[11px] text-zinc-400 font-mono">
                  Код класса: {foundClass.invite_code}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleJoinFoundClass}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Users className="w-4 h-4" />
                  <span>Присоединиться</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCreateNewClass}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.99] text-zinc-200 text-sm font-bold rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>Создать другой</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setFoundClass(null)}
                className="w-full text-center text-xs text-zinc-400 hover:text-zinc-200 mt-2 transition-colors"
              >
                ← Изменить данные школы или класса
              </button>
            </div>
          )}

          {/* Form Mode 2: By Invite Code */}
          {isJoiningByCode && (
            <form onSubmit={handleJoinByInviteCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Код приглашения от одноклассника
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                    placeholder="Например: 8A-K7P4X2"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono tracking-wider text-zinc-100 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Спроси код у одноклассника, который уже состоит в классе
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    <span>Присоединиться по коду</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
