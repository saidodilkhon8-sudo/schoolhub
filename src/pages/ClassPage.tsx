import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  getClassById,
  getClassMembers,
  joinClass,
  findClassByInviteCode,
} from '../services/classes';
import {
  getClassMessages,
  sendMessage,
  deleteMessage,
  subscribeToClassMessages,
} from '../services/messages';
import { getExams, createExam, deleteExam } from '../services/exams';
import {
  getMaterials,
  uploadMaterial,
  deleteMaterial,
  getMaterialDownloadUrl,
  ALLOWED_EXTENSIONS,
} from '../services/materials';
import { getSubjects } from '../services/subjects';
import { submitReport } from '../services/reports';
import { blockUser, getBlockedUserIds } from '../services/blocks';
import {
  ClassGroup,
  ClassMember,
  Message,
  Exam,
  Material,
  Subject,
} from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import {
  formatDateCustom,
  getDaysUntil,
  formatTimeAgo,
  formatFileSize,
} from '../utils/format';
import {
  Users,
  MessageCircle,
  Calendar,
  FileText,
  Send,
  Trash2,
  Flag,
  UserX,
  Copy,
  Download,
  Upload,
  Plus,
  Clock,
  Shield,
  Check,
  AlertTriangle,
  Key,
} from 'lucide-react';

type ClassSubTab = 'chat' | 'classmates' | 'exams' | 'materials';

export function ClassPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<ClassSubTab>('chat');
  const [classInfo, setClassInfo] = useState<ClassGroup | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat input
  const [messageContent, setMessageContent] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Report Modal
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState<'Спам' | 'Оскорбление' | 'Неподходящий контент' | 'Другое'>('Спам');

  // Block Modal
  const [blockTargetUser, setBlockTargetUser] = useState<{ id: string; name: string } | null>(null);

  // Add Exam Modal
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [examSubjectId, setExamSubjectId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [submittingExam, setSubmittingExam] = useState(false);

  // Upload Material Modal
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialSubjectId, setMaterialSubjectId] = useState('');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDesc, setMaterialDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  // Join by code modal (for students not in class yet)
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);

  // Load class data
  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!profile?.class_id || !user) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const [
          cData,
          mems,
          msgs,
          exs,
          mats,
          subs,
          blocked,
        ] = await Promise.all([
          getClassById(profile.class_id),
          getClassMembers(profile.class_id),
          getClassMessages(profile.class_id),
          getExams(profile.class_id),
          getMaterials(profile.class_id),
          getSubjects(profile.class_id),
          getBlockedUserIds(user.id),
        ]);

        if (!active) return;
        setClassInfo(cData);
        setMembers(mems);
        setMessages(msgs);
        setExams(exs);
        setMaterials(mats);
        setSubjects(subs);
        setBlockedUserIds(blocked);

        if (subs.length > 0) {
          setExamSubjectId(subs[0].id);
          setMaterialSubjectId(subs[0].id);
        }
      } catch (err: any) {
        console.warn('Class data error:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [profile?.class_id, user]);

  // Realtime subscription for chat messages
  useEffect(() => {
    if (!profile?.class_id) return;

    const unsubscribe = subscribeToClassMessages(
      profile.class_id,
      (newMsg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
      (deletedId) => {
        setMessages((prev) => prev.filter((m) => m.id !== deletedId));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [profile?.class_id]);

  // Auto scroll chat to bottom when messages load or switch to chat tab
  useEffect(() => {
    if (currentTab === 'chat' && messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [currentTab, messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.class_id || !user || !messageContent.trim()) return;

    setSendingMessage(true);
    const content = messageContent;
    setMessageContent('');

    try {
      const sent = await sendMessage(profile.class_id, user.id, content);
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      console.error('Send message error:', err);
      showToast('Ошибка при отправке сообщения', 'error');
      setMessageContent(content); // restore on error
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;
    try {
      await deleteMessage(messageId, user.id);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      showToast('Сообщение удалено', 'info');
    } catch (err: any) {
      console.error('Delete message error:', err);
      showToast('Не удалось удалить сообщение', 'error');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportingMessage) return;
    try {
      await submitReport(user.id, reportingMessage.id, reportReason);
      showToast(t('report_sent'), 'success');
      setReportingMessage(null);
    } catch (err: any) {
      console.error('Report error:', err);
      showToast('Не удалось отправить жалобу', 'error');
    }
  };

  const handleBlockUserConfirm = async () => {
    if (!user || !blockTargetUser) return;
    try {
      await blockUser(user.id, blockTargetUser.id);
      setBlockedUserIds((prev) => [...prev, blockTargetUser.id]);
      showToast(`Пользователь ${blockTargetUser.name} заблокирован`, 'info');
    } catch (err: any) {
      console.error('Block error:', err);
      showToast('Не удалось заблокировать', 'error');
    } finally {
      setBlockTargetUser(null);
    }
  };

  const handleCopyInviteCode = () => {
    if (!classInfo?.invite_code) return;
    navigator.clipboard.writeText(classInfo.invite_code);
    showToast(t('invite_copied'), 'success');
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.class_id || !user || !examSubjectId) return;

    setSubmittingExam(true);
    try {
      const created = await createExam({
        user_id: user.id,
        class_id: profile.class_id,
        subject_id: examSubjectId,
        title: examTitle.trim(),
        description: examDesc.trim() || undefined,
        exam_date: examDate,
      });
      setExams((prev) => [...prev, created]);
      showToast('Контрольная запланирована', 'success');
      setIsExamModalOpen(false);
      setExamTitle('');
      setExamDesc('');
    } catch (err: any) {
      console.error('Create exam error:', err);
      showToast('Ошибка при добавлении контрольной', 'error');
    } finally {
      setSubmittingExam(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      await deleteExam(examId);
      setExams((prev) => prev.filter((e) => e.id !== examId));
      showToast('Контрольная удалена', 'info');
    } catch (err: any) {
      console.error('Delete exam error:', err);
      showToast('Не удалось удалить контрольную', 'error');
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.class_id || !user || !selectedFile) return;

    setUploadingMaterial(true);
    try {
      const uploaded = await uploadMaterial({
        class_id: profile.class_id,
        user_id: user.id,
        subject_id: materialSubjectId || null,
        title: materialTitle.trim() || selectedFile.name,
        description: materialDesc.trim() || undefined,
        file: selectedFile,
      });
      setMaterials((prev) => [uploaded, ...prev]);
      showToast('Материал успешно загружен', 'success');
      setIsMaterialModalOpen(false);
      setSelectedFile(null);
      setMaterialTitle('');
      setMaterialDesc('');
    } catch (err: any) {
      console.error('Upload material error:', err);
      showToast(err.message || 'Ошибка загрузки файла', 'error');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (material: Material) => {
    try {
      await deleteMaterial(material.id, material.file_path);
      setMaterials((prev) => prev.filter((m) => m.id !== material.id));
      showToast('Материал удален', 'info');
    } catch (err: any) {
      console.error('Delete material error:', err);
      showToast('Не удалось удалить материал', 'error');
    }
  };

  const handleJoinClassByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinInviteCode.trim()) return;

    setJoiningByCode(true);
    try {
      const found = await findClassByInviteCode(joinInviteCode);
      if (!found) {
        showToast('Класс с таким кодом не найден', 'error');
        return;
      }
      await joinClass(found.id, user.id);
      showToast(`Вы успешно присоединились к классу ${found.name}!`, 'success');
      setIsJoinCodeModalOpen(false);
      await refreshProfile();
    } catch (err: any) {
      console.error('Join error:', err);
      showToast('Не удалось присоединиться к классу', 'error');
    } finally {
      setJoiningByCode(false);
    }
  };

  // Filter messages to hide blocked users
  const visibleMessages = messages.filter((m) => !blockedUserIds.includes(m.user_id));

  // If user has not joined class yet (Empty State)
  if (!profile?.class_id) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <EmptyState
          icon={Users}
          title={t('not_in_class')}
          description="Присоединись к своему классу по коду приглашения, чтобы общаться с одноклассниками, видеть расписание и делиться материалами."
          actionLabel={t('enter_code')}
          onAction={() => setIsJoinCodeModalOpen(true)}
        />

        <Modal
          isOpen={isJoinCodeModalOpen}
          onClose={() => setIsJoinCodeModalOpen(false)}
          title={t('enter_code')}
        >
          <form onSubmit={handleJoinClassByCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Код приглашения
              </label>
              <input
                type="text"
                required
                value={joinInviteCode}
                onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                placeholder="8A-K7P4X2"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider text-zinc-100 uppercase focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={joiningByCode}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-50"
            >
              {joiningByCode ? t('loading') : t('btn_join')}
            </button>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 md:pb-8">
      {/* Class Header Banner */}
      <div className="bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-600/20 text-blue-400 font-bold text-xs border border-blue-500/20">
              {classInfo?.name || `${profile.grade}-${profile.letter}`}
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              {classInfo?.school?.name || 'Школа'}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight mt-1.5 flex items-center gap-2">
            <span>{classInfo?.school?.name || 'Школа'} · {classInfo?.name}</span>
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {t('participants_count', { count: members.length })}
          </p>
        </div>

        {/* Invite Code Badge */}
        {classInfo?.invite_code && (
          <div className="self-start sm:self-auto flex items-center gap-2.5 p-2 px-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <div>
              <span className="block text-[10px] text-zinc-500 uppercase font-semibold">
                {t('invite_code_label')}
              </span>
              <span className="font-mono text-xs font-bold text-zinc-200 tracking-wider">
                {classInfo.invite_code}
              </span>
            </div>
            <button
              onClick={handleCopyInviteCode}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title={t('copy_invite')}
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Class Internal Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => setCurrentTab('chat')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            currentTab === 'chat'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{t('chat_title')}</span>
        </button>
        <button
          onClick={() => setCurrentTab('classmates')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            currentTab === 'classmates'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('classmates')} ({members.length})</span>
        </button>
        <button
          onClick={() => setCurrentTab('exams')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            currentTab === 'exams'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t('exams_title')} ({exams.length})</span>
        </button>
        <button
          onClick={() => setCurrentTab('materials')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            currentTab === 'materials'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t('materials_title')} ({materials.length})</span>
        </button>
      </div>

      {/* TAB 1: REALTIME CHAT */}
      {currentTab === 'chat' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col h-[560px] shadow-lg overflow-hidden">
          {/* Chat Messages List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {loading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-zinc-950/60 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <MessageCircle className="w-10 h-10 text-zinc-700 mb-2" />
                <p className="text-sm font-bold text-zinc-300">{t('empty_chat')}</p>
                <p className="text-xs text-zinc-500 mt-1">{t('empty_chat_sub')}</p>
              </div>
            ) : (
              visibleMessages.map((msg) => {
                const isOwn = msg.user_id === user?.id;
                const authorName = `${msg.profile?.first_name || 'Ученик'} ${msg.profile?.last_name || ''}`;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 group ${
                      isOwn ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0 overflow-hidden mt-0.5">
                      {msg.profile?.avatar_url ? (
                        <img
                          src={msg.profile.avatar_url}
                          alt={authorName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        msg.profile?.first_name?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div className={`max-w-[78%] sm:max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className="flex items-center gap-2 mb-0.5 px-1">
                        <span className="text-[11px] font-bold text-zinc-300">
                          {isOwn ? 'Вы' : authorName}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {formatTimeAgo(msg.created_at)}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed break-words relative ${
                          isOwn
                            ? 'bg-blue-600 text-white rounded-tr-xs shadow-md shadow-blue-900/10'
                            : 'bg-zinc-800 text-zinc-100 rounded-tl-xs border border-zinc-700/60'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Hover Actions: Delete (if own) or Report / Block (if classmate) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1 px-1">
                        {isOwn ? (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-[10px] text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{t('delete_message')}</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setReportingMessage(msg)}
                              className="text-[10px] text-zinc-500 hover:text-amber-400 flex items-center gap-1 transition-colors mr-2"
                            >
                              <Flag className="w-3 h-3" />
                              <span>{t('report_message')}</span>
                            </button>
                            <button
                              onClick={() =>
                                setBlockTargetUser({
                                  id: msg.user_id,
                                  name: authorName,
                                })
                              }
                              className="text-[10px] text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                            >
                              <UserX className="w-3 h-3" />
                              <span>{t('block_user')}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center gap-2"
          >
            <input
              type="text"
              required
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder={t('chat_input_placeholder')}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={sendingMessage || !messageContent.trim()}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-md shadow-blue-600/20"
              aria-label={t('send')}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: CLASSMATES (Requirement 9: only first_name, last_name, avatar. Never email/phone) */}
      {currentTab === 'classmates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Список одноклассников ({members.length})</span>
            <span className="text-[11px] text-zinc-500">Конфиденциальность: контакты скрыты</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map((m) => {
              const p = m.profile;
              const isMe = m.user_id === user?.id;
              const fullName = `${p?.first_name || 'Ученик'} ${p?.last_name || ''}`;

              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 shadow-sm hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden shadow-sm">
                      {p?.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={fullName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        p?.first_name?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-zinc-100 truncate">
                        {fullName}
                      </h4>
                      <span className="text-[11px] text-zinc-400">
                        {isMe ? 'Это вы' : 'Ученик класса'}
                      </span>
                    </div>
                  </div>

                  {!isMe && (
                    <button
                      onClick={() =>
                        setBlockTargetUser({
                          id: m.user_id,
                          name: fullName,
                        })
                      }
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 transition-colors"
                      title={t('block_user')}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EXAMS (Requirement 14) */}
      {currentTab === 'exams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100">
              {t('exams_title')}
            </h2>
            <button
              onClick={() => setIsExamModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('add_exam')}</span>
            </button>
          </div>

          {exams.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={t('empty_exams')}
              description="Запланируй предстоящую контрольную работу, четвертной срез или олимпиаду."
              actionLabel={t('add_exam')}
              onAction={() => setIsExamModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {exams.map((ex) => {
                const daysInfo = getDaysUntil(ex.exam_date);
                const isAuthor = ex.user_id === user?.id;

                return (
                  <div
                    key={ex.id}
                    className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between shadow-sm relative group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-purple-400">
                          {ex.subject?.name || 'Предмет'}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                            daysInfo.isToday
                              ? 'bg-amber-500/20 text-amber-300'
                              : daysInfo.isPast
                              ? 'bg-zinc-800 text-zinc-500'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {daysInfo.label}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-zinc-100 mt-1.5">
                        {ex.title}
                      </h3>

                      {ex.description && (
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          {ex.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3 mt-4 text-xs text-zinc-400 font-mono">
                      <span>{formatDateCustom(ex.exam_date, language)}</span>
                      {isAuthor && (
                        <button
                          onClick={() => handleDeleteExam(ex.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MATERIALS (Requirement 16: PDF, PNG, JPG, DOCX up to 25MB) */}
      {currentTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {t('materials_title')}
              </h2>
              <span className="text-[11px] text-zinc-500">
                {t('file_formats_hint')}
              </span>
            </div>
            <button
              onClick={() => setIsMaterialModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('upload_material')}</span>
            </button>
          </div>

          {materials.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('empty_materials')}
              description="Загрузи конспекты, PDF учебники, презентации или фотографии доски."
              actionLabel={t('upload_material')}
              onAction={() => setIsMaterialModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {materials.map((mat) => {
                const isAuthor = mat.user_id === user?.id;
                const downloadUrl = getMaterialDownloadUrl(mat.file_path);

                return (
                  <div
                    key={mat.id}
                    className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold text-blue-400">
                          {mat.subject?.name || 'Предмет'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 uppercase">
                          {mat.file_type || 'файл'}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-zinc-100 truncate">
                        {mat.title}
                      </h3>

                      {mat.description && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                          {mat.description}
                        </p>
                      )}

                      <div className="text-[11px] text-zinc-500 mt-2 flex items-center gap-2">
                        <span>{formatFileSize(mat.file_size)}</span>
                        <span>•</span>
                        <span>{mat.profile?.first_name || 'Ученик'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3 mt-3">
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('download')}</span>
                      </a>

                      {isAuthor && (
                        <button
                          onClick={() => handleDeleteMaterial(mat)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Report Message (Requirement 17) */}
      <Modal
        isOpen={Boolean(reportingMessage)}
        onClose={() => setReportingMessage(null)}
        title={t('report_message')}
      >
        <form onSubmit={handleReportSubmit} className="space-y-4">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Пожаловаться на сообщение: «{reportingMessage?.content}». Жалоба отправляется конфиденциально.
          </p>

          <div className="space-y-2">
            {(['Спам', 'Оскорбление', 'Неподходящий контент', 'Другое'] as const).map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors"
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={reason}
                  checked={reportReason === reason}
                  onChange={() => setReportReason(reason)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-zinc-200">{reason}</span>
              </label>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setReportingMessage(null)}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
            >
              Отправить жалобу
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DIALOG: Block User (Requirement 18) */}
      <ConfirmDialog
        isOpen={Boolean(blockTargetUser)}
        onClose={() => setBlockTargetUser(null)}
        onConfirm={handleBlockUserConfirm}
        title="Заблокировать пользователя"
        message={`Вы уверены, что хотите заблокировать ${blockTargetUser?.name}? Его сообщения больше не будут отображаться для вас в чате класса.`}
        confirmLabel="Заблокировать"
        cancelLabel={t('cancel')}
        isDestructive={true}
      />

      {/* MODAL: Add Exam */}
      <Modal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        title={t('add_exam')}
      >
        <form onSubmit={handleSaveExam} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              {t('select_subject')}
            </label>
            <select
              value={examSubjectId}
              onChange={(e) => setExamSubjectId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Название (например: Контрольная работа за 1 четверть)
            </label>
            <input
              type="text"
              required
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="Контрольная по математике"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Дата проведения
            </label>
            <input
              type="date"
              required
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Описание / Темы (необязательно)
            </label>
            <textarea
              rows={2}
              value={examDesc}
              onChange={(e) => setExamDesc(e.target.value)}
              placeholder="Повторить формулы со страницы 45..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsExamModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submittingExam}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              {submittingExam ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Upload Material */}
      <Modal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        title={t('upload_material')}
      >
        <form onSubmit={handleUploadMaterial} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              {t('select_subject')}
            </label>
            <select
              value={materialSubjectId}
              onChange={(e) => setMaterialSubjectId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Название материала
            </label>
            <input
              type="text"
              required
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              placeholder="Конспект к уроку №4, Таблица формул"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* File Input with Drag and Drop */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Выберите файл ({t('file_formats_hint')})
            </label>
            <div className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 text-center cursor-pointer bg-zinc-950/40 relative">
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    if (!materialTitle) setMaterialTitle(file.name.replace(/\.[^/.]+$/, ''));
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              {selectedFile ? (
                <div className="text-xs text-blue-400 font-semibold truncate">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </div>
              ) : (
                <>
                  <p className="text-xs text-zinc-300 font-semibold">Нажмите или перетащите файл сюда</p>
                  <p className="text-[11px] text-zinc-500 mt-1">PDF, PNG, JPG, DOCX до 25 МБ</p>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Комментарий (необязательно)
            </label>
            <textarea
              rows={2}
              value={materialDesc}
              onChange={(e) => setMaterialDesc(e.target.value)}
              placeholder="Дополнительные примечания к материалу..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsMaterialModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={uploadingMaterial || !selectedFile}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              {uploadingMaterial ? t('loading') : 'Загрузить файл'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
