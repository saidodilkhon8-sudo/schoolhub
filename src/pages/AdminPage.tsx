import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchAdminUsers,
  updateUserRoleAndAdmin,
  deleteUserAccount,
  fetchAdminStats,
  fetchAdminReports,
  resolveAdminReport,
  broadcastSystemNotification,
  AdminStats,
} from '../services/admin';
import { Profile, ClassGroup, School } from '../types';
import { getMockClasses, getMockSchools, AdminReportItem } from '../lib/mockStore';
import { formatDateCustom } from '../utils/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Shield,
  ShieldCheck,
  Users,
  School as SchoolIcon,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  Search,
  Trash2,
  RefreshCw,
  Bell,
  Database,
  Lock,
  Layers,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';

type AdminTab = 'users' | 'content' | 'reports' | 'broadcast' | 'system';

interface AdminPageProps {
  onNavigateHome: () => void;
}

export function AdminPage({ onNavigateHome }: AdminPageProps) {
  const { user, profile, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalClasses: 0,
    totalAssignments: 0,
    totalSchools: 0,
    pendingReports: 0,
  });

  // Users state
  const [usersList, setUsersList] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'student' | 'teacher'>('all');
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);

  // Content state (classes & schools)
  const [classesList, setClassesList] = useState<ClassGroup[]>([]);
  const [schoolsList, setSchoolsList] = useState<School[]>([]);

  // Reports state
  const [reportsList, setReportsList] = useState<AdminReportItem[]>([]);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [fetchedUsers, fetchedStats, fetchedReports] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminStats(),
        fetchAdminReports(),
      ]);
      setUsersList(fetchedUsers);
      setStats(fetchedStats);
      setReportsList(fetchedReports);
      setClassesList(getMockClasses());
      setSchoolsList(getMockSchools());
    } catch (err) {
      console.error('Error loading admin data:', err);
      showToast('Ошибка при загрузке административных данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAllAdminData();
    }
  }, [isAdmin]);

  // Security Guard: Non-admin protection
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Доступ ограничен</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">
          Панель управления доступна только авторизованным администраторам с подтвержденным статусом.
        </p>
        <button
          onClick={onNavigateHome}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all"
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) || email.includes(searchQuery.toLowerCase());

    if (roleFilter === 'all') return matchesSearch;
    if (roleFilter === 'admin') return matchesSearch && (u.is_admin || u.role === 'admin');
    return matchesSearch && u.role === roleFilter;
  });

  const handleToggleAdminRole = async (targetUser: Profile) => {
    const isCurrentlyAdmin = Boolean(targetUser.is_admin || targetUser.role === 'admin');
    const newAdminState = !isCurrentlyAdmin;
    const newRole = newAdminState ? 'admin' : 'student';

    try {
      await updateUserRoleAndAdmin(targetUser.id, newRole, newAdminState);
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, role: newRole, is_admin: newAdminState } : u
        )
      );
      showToast(
        newAdminState
          ? `Права администратора выданы пользователю ${targetUser.first_name}`
          : `Права администратора сняты с ${targetUser.first_name}`,
        'success'
      );
    } catch {
      showToast('Не удалось обновить права пользователя', 'error');
    }
  };

  const handleRoleChange = async (targetUser: Profile, role: 'student' | 'teacher' | 'admin') => {
    try {
      const isAdminRole = role === 'admin';
      await updateUserRoleAndAdmin(targetUser.id, role, isAdminRole);
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, role, is_admin: isAdminRole } : u
        )
      );
      showToast(`Роль изменена на "${role}"`, 'success');
    } catch {
      showToast('Ошибка при смене роли', 'error');
    }
  };

  const handleDeleteUserConfirmed = async () => {
    if (!userToDelete) return;
    try {
      await deleteUserAccount(userToDelete.id);
      setUsersList((prev) => prev.filter((u) => u.id !== userToDelete.id));
      showToast(`Пользователь ${userToDelete.first_name} удален`, 'info');
    } catch {
      showToast('Ошибка при удалении пользователя', 'error');
    } finally {
      setUserToDelete(null);
    }
  };

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await resolveAdminReport(reportId, status);
      setReportsList((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
      showToast(
        status === 'resolved' ? 'Жалоба помечена как решенная' : 'Жалоба отклонена',
        'success'
      );
    } catch {
      showToast('Ошибка при обновлении жалобы', 'error');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast('Заполните заголовок и текст сообщения', 'info');
      return;
    }

    setIsBroadcasting(true);
    try {
      await broadcastSystemNotification(broadcastTitle.trim(), broadcastMessage.trim());
      showToast('Системное оповещение успешно отправлено всем пользователям!', 'success');
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch {
      showToast('Ошибка при отправке оповещения', 'error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Admin Top Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/10 via-zinc-900 to-amber-900/20 border border-amber-500/30 p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Панель Администратора</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-100 tracking-tight">
              Центр управления SchoolHub
            </h1>
            <p className="text-sm text-zinc-400">
              Администратор: <span className="text-amber-300 font-semibold">{user?.email || profile?.first_name || 'Администратор'}</span> • Полный доступ к данным, модерации и пользователям
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadAllAdminData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Обновить данные</span>
            </button>

            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <span>В приложение</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Пользователи</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">{stats.totalUsers}</div>
          <span className="text-[11px] text-zinc-400 mt-1">Ученики и учителя</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Классы</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">{stats.totalClasses}</div>
          <span className="text-[11px] text-zinc-400 mt-1">Активные группы</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Школы</span>
            <SchoolIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">{stats.totalSchools}</div>
          <span className="text-[11px] text-zinc-400 mt-1">В каталоге</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Задания</span>
            <BookOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">{stats.totalAssignments}</div>
          <span className="text-[11px] text-zinc-400 mt-1">Домашние задания</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Жалобы</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100">{stats.pendingReports}</div>
          <span className="text-[11px] text-rose-400/90 font-medium mt-1">Требуют внимания</span>
        </div>
      </div>

      {/* Admin Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'users'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Пользователи ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('content')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'content'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Классы и Школы</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'reports'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Модерация</span>
          {stats.pendingReports > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
              {stats.pendingReports}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'broadcast'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Оповещение всем</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            activeTab === 'system'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Статус системы</span>
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Поиск по имени или email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-200 placeholder-zinc-400 focus:outline-hidden focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-zinc-400">Роль:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-300 focus:outline-hidden focus:border-amber-500"
              >
                <option value="all">Все пользователи</option>
                <option value="student">Ученики</option>
                <option value="teacher">Учителя</option>
                <option value="admin">Администраторы</option>
              </select>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-zinc-300">
                <thead className="bg-zinc-950/60 text-zinc-400 text-[11px] font-semibold border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Пользователь</th>
                    <th className="px-4 py-3">Email / ID</th>
                    <th className="px-4 py-3">Школа / Класс</th>
                    <th className="px-4 py-3">Роль</th>
                    <th className="px-4 py-3">Статус Admin</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isTargetAdmin = Boolean(u.is_admin || u.role === 'admin');
                      const isCurrentUser =
                        u.id === user?.id ||
                        u.email === 'saidodilkhon2@gmail.com';

                      return (
                        <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-200">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                                {u.first_name?.[0] || 'U'}
                              </div>
                              <div>
                                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                                  <span>{u.first_name || 'Без имени'} {u.last_name || ''}</span>
                                  {isCurrentUser && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                                      Вы
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400">
                                  {u.created_at ? formatDateCustom(u.created_at) : 'Недавно'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">
                            {u.email || u.id.slice(0, 16) + '...'}
                          </td>

                          <td className="px-4 py-3 text-zinc-400">
                            <div>{u.school?.name || 'Школа не указана'}</div>
                            {u.grade && u.letter ? (
                              <span className="text-[11px] text-amber-300 font-medium">
                                Класс {u.grade}-{u.letter}
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400">Класс не выбран</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <select
                              value={u.role || 'student'}
                              onChange={(e) => handleRoleChange(u, e.target.value as any)}
                              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-hidden focus:border-amber-500"
                            >
                              <option value="student">Ученик</option>
                              <option value="teacher">Учитель</option>
                              <option value="admin">Администратор</option>
                            </select>
                          </td>

                          <td className="px-4 py-3">
                            {isTargetAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[11px]">
                                Обычный
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleToggleAdminRole(u)}
                                title={isTargetAdmin ? 'Снять права администратора' : 'Сделать администратором'}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  isTargetAdmin
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-amber-300 hover:bg-zinc-700'
                                }`}
                              >
                                <Shield className="w-4 h-4" />
                              </button>

                              {!isCurrentUser && (
                                <button
                                  onClick={() => setUserToDelete(u)}
                                  title="Удалить пользователя"
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 border border-zinc-700 hover:border-rose-500/30 text-zinc-400 hover:text-rose-300 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTENT (CLASSES & SCHOOLS) */}
      {activeTab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Classes list */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-zinc-200">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Активные классы ({classesList.length})</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {classesList.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-zinc-200 flex items-center gap-2">
                      <span>Класс {cls.name}</span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        Код: {cls.invite_code}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {cls.school?.name || 'Школа №1'} • ID: {cls.id}
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300">
                    Активен
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Schools list */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-zinc-200">
                <SchoolIcon className="w-4 h-4 text-emerald-400" />
                <span>Школы в базе данных ({schoolsList.length})</span>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {schoolsList.map((sch) => (
                <div
                  key={sch.id}
                  className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-zinc-200">{sch.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{sch.city}</div>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {sch.id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REPORTS & MODERATION */}
      {activeTab === 'reports' && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-zinc-100 text-base">Жалобы пользователей и модерация контента</h3>
              <p className="text-xs text-zinc-400">
                Запросы на проверку сообщений чата класса и материалов
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {reportsList.length === 0 ? (
              <div className="text-center py-10 text-zinc-400 text-sm">
                Жалоб на данный момент нет. Вся экосистема в порядке!
              </div>
            ) : (
              reportsList.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                        {rep.reason}
                      </span>
                      <span className="text-xs text-zinc-400">
                        Отправитель: <span className="text-zinc-300 font-medium">{rep.reporter_id}</span>
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        • {formatDateCustom(rep.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300">
                      ID Сообщения / Объекта: <code className="text-amber-300">{rep.message_id}</code>
                    </p>
                    <div className="text-[11px] text-zinc-400">
                      Статус: <strong className={rep.status === 'pending' ? 'text-amber-400' : 'text-emerald-400'}>{rep.status}</strong>
                    </div>
                  </div>

                  {rep.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResolveReport(rep.id, 'resolved')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Решено</span>
                      </button>
                      <button
                        onClick={() => handleResolveReport(rep.id, 'dismissed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Отклонить</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BROADCAST ANNOUNCEMENT */}
      {activeTab === 'broadcast' && (
        <div className="max-w-2xl bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="font-bold text-zinc-100 text-base flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              <span>Глобальное оповещение всем пользователям</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Оповещение отобразится в Центре Уведомлений у всех учеников и учителей системы
            </p>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Заголовок объявления
              </label>
              <input
                type="text"
                placeholder="Например: Обновление расписания или общешкольное мероприятие"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Текст оповещения
              </label>
              <textarea
                rows={4}
                placeholder="Напишите подробное сообщение для всех учеников..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-amber-500 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isBroadcasting}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isBroadcasting ? 'Отправка...' : 'Отправить оповещение'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: SYSTEM HEALTH */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-zinc-100 text-base flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <span>Состояние базы данных и сервисов</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-zinc-300 font-medium">Режим работы</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Активен (Supabase & Local Store)
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-zinc-300 font-medium">Таблицы базы данных</span>
                <span className="text-zinc-400">profiles, classes, assignments, messages, reports</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-zinc-300 font-medium">Шифрование и RLS</span>
                <span className="text-emerald-400 font-semibold">Включено</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-zinc-300 font-medium">Текущий супер-администратор</span>
                <span className="text-amber-300 font-semibold font-mono">{user?.email || 'Администратор'}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-zinc-100 text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Быстрые действия администратора</span>
            </h3>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  loadAllAdminData();
                  showToast('Кэш данных синхронизирован', 'success');
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/50 border border-zinc-800 text-zinc-200 text-xs font-semibold transition-colors"
              >
                <span>Принудительная ре-синхронизация данных</span>
                <RefreshCw className="w-4 h-4 text-zinc-400" />
              </button>

              <button
                onClick={() => {
                  broadcastSystemNotification('Тестовое оповещение', 'Проверка работоспособности системы уведомлений');
                  showToast('Тестовое оповещение отправлено', 'info');
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/50 border border-zinc-800 text-zinc-200 text-xs font-semibold transition-colors"
              >
                <span>Проверить отправку уведомлений</span>
                <Bell className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting User */}
      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        title="Удалить пользователя?"
        message={`Вы действительно хотите удалить профиль "${userToDelete?.first_name} ${userToDelete?.last_name || ''}"? Это действие необратимо.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        isDestructive
        onConfirm={handleDeleteUserConfirmed}
        onClose={() => setUserToDelete(null)}
      />
    </div>
  );
}
