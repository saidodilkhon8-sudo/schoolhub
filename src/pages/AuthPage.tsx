import React, { useState } from 'react';
import { Sparkles, Mail, Lock, ArrowRight, UserCheck, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { signInStudent, signUpStudent, resetPasswordStudent } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getFriendlyErrorMessage } from '../utils/format';

type AuthMode = 'login' | 'register' | 'reset';

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickRegistering, setQuickRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInvalidCreds, setIsInvalidCreds] = useState(false);
  const { loginAsGuest } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsInvalidCreds(false);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMsg('Введите email адрес');
      return;
    }

    if (mode !== 'reset' && !password) {
      setErrorMsg('Введите пароль');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('Пароли не совпадают');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setErrorMsg('Пароль должен содержать минимум 6 символов');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        // Special admin master credentials check: strictly saidodilkhon2@gmail.com with sas2013s
        const isAdminMaster = cleanEmail === 'saidodilkhon2@gmail.com' && password === 'sas2013s';

        try {
          await signInStudent(cleanEmail, password);
          showToast('Добро пожаловать в SchoolHub!', 'success');
        } catch (authErr: any) {
          if (isAdminMaster) {
            loginAsGuest('saidodilkhon2@gmail.com');
            showToast('Вход выполнен с правами Администратора!', 'success');
            return;
          }
          throw authErr;
        }
      } else if (mode === 'register') {
        const res = await signUpStudent(cleanEmail, password);
        if (res?.user && !res.session) {
          showToast('Письмо с подтверждением отправлено на ваш email', 'info');
          setErrorMsg('Аккаунт создан! Проверьте вашу почту для подтверждения входа.');
        } else {
          showToast('Аккаунт успешно создан!', 'success');
        }
      } else if (mode === 'reset') {
        await resetPasswordStudent(cleanEmail);
        showToast('Инструкция по сбросу пароля отправлена на email', 'success');
        setMode('login');
      }
    } catch (err: any) {
      console.error('Auth action error:', err);
      const friendly = getFriendlyErrorMessage(err);
      setErrorMsg(friendly);
      if (err?.message?.includes('Invalid login credentials') || friendly.includes('Неверный email или пароль')) {
        setIsInvalidCreds(true);
      }
      showToast(friendly, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      showToast('Введите email адрес', 'error');
      return;
    }
    if (!password || password.length < 6) {
      showToast('Пароль должен быть не менее 6 символов', 'error');
      return;
    }

    setQuickRegistering(true);
    setErrorMsg(null);
    setIsInvalidCreds(false);
    try {
      const res = await signUpStudent(cleanEmail, password);
      if (res?.user && !res.session) {
        showToast('Письмо с подтверждением отправлено на ваш email', 'info');
        setErrorMsg('Аккаунт создан! Если настроено подтверждение почты, перейдите по ссылке из письма.');
      } else {
        showToast('Аккаунт успешно зарегистрирован! Добро пожаловать!', 'success');
      }
    } catch (err: any) {
      console.error('Quick register error:', err);
      const friendly = getFriendlyErrorMessage(err);
      if (friendly.includes('уже зарегистрирован')) {
        setErrorMsg('Этот email уже зарегистрирован. Проверьте правильность пароля или нажмите «Забыли пароль?».');
      } else {
        setErrorMsg(friendly);
      }
      showToast(friendly, 'error');
    } finally {
      setQuickRegistering(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-3.5">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-100">
            SchoolHub
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Социальный органайзер только для учеников
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Mode Switcher */}
          {mode !== 'reset' && (
            <div className="flex p-1 bg-zinc-950 rounded-xl mb-6 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setIsInvalidCreds(false);
                }}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setIsInvalidCreds(false);
                }}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Регистрация
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-zinc-100">Восстановление пароля</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Укажи email, привязанный к твоему аккаунту ученика
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>

              {isInvalidCreds && mode === 'login' && (
                <div className="mt-1 pt-2 border-t border-red-800/40 flex flex-col gap-2">
                  <span className="text-[11px] text-zinc-300">
                    Ещё не регистрировались с этим email?
                  </span>
                  <button
                    type="button"
                    onClick={handleQuickRegister}
                    disabled={quickRegistering}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {quickRegistering ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Создать аккаунт с этим email и паролем</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (isInvalidCreds) setIsInvalidCreds(false);
                  }}
                  placeholder="student@school.uz"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Email не показывается другим ученикам
              </p>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Пароль
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg(null);
                        setIsInvalidCreds(false);
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Забыли пароль?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (isInvalidCreds) setIsInvalidCreds(false);
                    }}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Повторите пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <span>Войти в аккаунт</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : mode === 'register' ? (
                <>
                  <span>Зарегистрироваться</span>
                  <UserCheck className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Отправить ссылку</span>
                  <KeyRound className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {mode === 'reset' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setIsInvalidCreds(false);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Вернуться ко входу
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
