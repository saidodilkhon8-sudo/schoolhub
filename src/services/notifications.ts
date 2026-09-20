import { supabase } from '../lib/supabase';
import { NotificationItem } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import {
  getMockNotifications,
  createMockNotification,
  markMockNotificationRead,
  markAllMockNotificationsRead,
  deleteMockNotification,
  clearAllMockNotifications,
} from '../lib/mockStore';

export async function getNotifications(userId: string): Promise<NotificationItem[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        return getMockNotifications(userId);
      }
      throw error;
    }
    return (data || []) as NotificationItem[];
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42501') {
      if (isTableMissingError(err)) setSchemaMissing(true);
      return getMockNotifications(userId);
    }
    console.warn('Could not fetch notifications from Supabase, using local fallback:', err);
    return getMockNotifications(userId);
  }
}

export async function createNotification(
  notification: Omit<NotificationItem, 'id' | 'created_at'>
): Promise<NotificationItem> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.user_id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        is_read: notification.is_read ?? false,
      })
      .select()
      .single();

    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        if (isTableMissingError(error)) setSchemaMissing(true);
        const mock = createMockNotification(notification);
        dispatchLocalNotification(mock);
        return mock;
      }
      throw error;
    }

    const saved = data as NotificationItem;
    dispatchLocalNotification(saved);
    return saved;
  } catch (err: any) {
    if (isTableMissingError(err) || err?.code === '42501') {
      if (isTableMissingError(err)) setSchemaMissing(true);
    }
    const mock = createMockNotification(notification);
    dispatchLocalNotification(mock);
    return mock;
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        markMockNotificationRead(id);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    markMockNotificationRead(id);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        markAllMockNotificationsRead(userId);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    markAllMockNotificationsRead(userId);
  }
}

export async function deleteNotification(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        deleteMockNotification(id);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    deleteMockNotification(id);
  }
}

export async function clearAllNotifications(userId: string): Promise<void> {
  try {
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
    if (error) {
      if (isTableMissingError(error) || error.code === '42501') {
        clearAllMockNotifications(userId);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    clearAllMockNotifications(userId);
  }
}

// Local event dispatcher for cross-component / mock sync
export function dispatchLocalNotification(notif: NotificationItem) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('schoolhub_notification_event', { detail: notif })
    );
  }
}

export function broadcastHomeworkEvent(data: {
  action: 'created' | 'updated' | 'deleted';
  assignment: any;
  authorId?: string;
}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('schoolhub_homework_event', { detail: data })
    );
  }
}

export function broadcastScheduleEvent(data: {
  action: 'created' | 'updated' | 'deleted';
  lesson: any;
  authorId?: string;
}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('schoolhub_schedule_event', { detail: data })
    );
  }
}

const DAY_NAMES: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
};

/**
 * Realtime subscription engine:
 * Subscribes to Supabase Postgres Changes on 'assignments', 'schedule', and 'notifications'.
 * Also coordinates local window events so simulated/offline events behave consistently.
 */
export function subscribeToRealtimeAlerts(params: {
  userId: string;
  classId?: string | null;
  onNotification: (notif: NotificationItem) => void;
  onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void;
}): () => void {
  const { userId, classId, onNotification, onStatusChange } = params;

  // Process and deliver notification with deduplication
  const handledIds = new Set<string>();

  const deliverNotification = (notif: NotificationItem) => {
    if (handledIds.has(notif.id)) return;
    handledIds.add(notif.id);

    // Keep set bounded
    if (handledIds.size > 200) {
      const first = handledIds.values().next().value;
      if (first) handledIds.delete(first);
    }

    onNotification(notif);
  };

  // Local window listeners
  const handleLocalNotifEvent = (e: any) => {
    if (e.detail) {
      deliverNotification(e.detail);
    }
  };

  const handleLocalHomeworkEvent = (e: any) => {
    const { action, assignment, authorId } = e.detail || {};
    if (!assignment) return;

    // Don't show redundant popup if author just created it in this active session
    const isMine = authorId === userId;
    const title =
      action === 'created'
        ? `Новое Д/З: ${assignment.title}`
        : action === 'updated'
        ? `Обновлено Д/З: ${assignment.title}`
        : `Удалено Д/З: ${assignment.title}`;

    const subjectName = assignment.subject?.name || 'Предмет';
    const message = `${subjectName} • срок: ${assignment.due_date || 'скоро'}${
      isMine ? ' (сохранено)' : ''
    }`;

    const item: NotificationItem = {
      id: `hw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      title,
      message,
      type: 'homework',
      is_read: false,
      created_at: new Date().toISOString(),
      link_tab: 'homework',
      metadata: {
        subject_name: subjectName,
        due_date: assignment.due_date,
        action,
      },
    };

    deliverNotification(item);
  };

  const handleLocalScheduleEvent = (e: any) => {
    const { action, lesson, authorId } = e.detail || {};
    if (!lesson) return;

    const dayName = DAY_NAMES[lesson.day_of_week] || 'Расписание';
    const subjName = lesson.subject?.name || 'Урок';
    const isMine = authorId === userId;

    let title = 'Изменение в расписании';
    let message = '';

    if (action === 'created') {
      title = `Добавлен урок: ${subjName}`;
      message = `${dayName}, ${lesson.lesson_number}-й урок (${lesson.start_time}-${lesson.end_time})${
        lesson.room ? `, каб. ${lesson.room}` : ''
      }`;
    } else if (action === 'updated') {
      title = `Обновлен урок: ${subjName}`;
      message = `${dayName}, ${lesson.lesson_number}-й урок (${lesson.start_time}-${lesson.end_time})${
        lesson.room ? ` • Каб. ${lesson.room}` : ''
      }${lesson.teacher ? ` • ${lesson.teacher}` : ''}`;
    } else {
      title = `Отменен урок: ${subjName}`;
      message = `${dayName}, ${lesson.lesson_number}-й урок удален из расписания`;
    }

    if (isMine) {
      message += ' (вами)';
    }

    const item: NotificationItem = {
      id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      title,
      message,
      type: 'schedule',
      is_read: false,
      created_at: new Date().toISOString(),
      link_tab: 'schedule',
      metadata: {
        day_of_week: lesson.day_of_week,
        lesson_number: lesson.lesson_number,
        room: lesson.room,
        teacher: lesson.teacher,
        action,
      },
    };

    deliverNotification(item);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('schoolhub_notification_event', handleLocalNotifEvent);
    window.addEventListener('schoolhub_homework_event', handleLocalHomeworkEvent);
    window.addEventListener('schoolhub_schedule_event', handleLocalScheduleEvent);
  }

  // Supabase Realtime Channel
  const channelName = `realtime-alerts-${userId.substring(0, 8)}-${
    classId ? classId.substring(0, 8) : 'general'
  }`;

  onStatusChange?.('connecting');

  const channel = supabase.channel(channelName);

  // 1. Listen for new / updated / deleted HOMEWORK assignments
  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'assignments',
      },
      async (payload) => {
        const newAssignment = payload.new as any;
        if (!newAssignment) return;

        // Check if relevant to this user or class
        const isClassMatch = classId && newAssignment.class_id === classId;
        const isUserMatch = newAssignment.user_id === userId;
        if (!isClassMatch && !isUserMatch) return;

        // Fetch subject name for nice display if possible
        let subjectName = 'Предмет';
        if (newAssignment.subject_id) {
          try {
            const { data: sub } = await supabase
              .from('subjects')
              .select('name')
              .eq('id', newAssignment.subject_id)
              .single();
            if (sub?.name) subjectName = sub.name;
          } catch {
            // fallback
          }
        }

        const isOwn = newAssignment.user_id === userId;
        const item: NotificationItem = {
          id: `realtime-hw-${newAssignment.id || Date.now()}`,
          user_id: userId,
          title: `Новое Д/З: ${newAssignment.title}`,
          message: `${subjectName} • срок: ${newAssignment.due_date || 'скоро'}${
            isOwn ? ' (синхронизировано)' : ''
          }`,
          type: 'homework',
          is_read: false,
          created_at: newAssignment.created_at || new Date().toISOString(),
          link_tab: 'homework',
          metadata: {
            subject_name: subjectName,
            due_date: newAssignment.due_date,
            action: 'created',
          },
        };

        deliverNotification(item);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'assignments',
      },
      async (payload) => {
        const updated = payload.new as any;
        if (!updated) return;

        const isClassMatch = classId && updated.class_id === classId;
        const isUserMatch = updated.user_id === userId;
        if (!isClassMatch && !isUserMatch) return;

        const item: NotificationItem = {
          id: `realtime-hw-up-${updated.id}-${Date.now()}`,
          user_id: userId,
          title: `Обновлено Д/З: ${updated.title}`,
          message: `Срок сдачи: ${updated.due_date || 'скоро'} • ${
            updated.completed ? 'Отмечено как выполненное' : 'Актуализировано'
          }`,
          type: 'homework',
          is_read: false,
          created_at: new Date().toISOString(),
          link_tab: 'homework',
          metadata: {
            due_date: updated.due_date,
            action: 'updated',
          },
        };

        deliverNotification(item);
      }
    )
    // 2. Listen for SCHEDULE changes (Insert, Update, Delete)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'schedule',
      },
      async (payload) => {
        const newLesson = payload.new as any;
        if (!newLesson) return;

        const isClassMatch = classId && newLesson.class_id === classId;
        if (!isClassMatch && newLesson.user_id !== userId) return;

        let subjectName = 'Новый урок';
        if (newLesson.subject_id) {
          try {
            const { data: sub } = await supabase
              .from('subjects')
              .select('name')
              .eq('id', newLesson.subject_id)
              .single();
            if (sub?.name) subjectName = sub.name;
          } catch {
            // fallback
          }
        }

        const dayName = DAY_NAMES[newLesson.day_of_week] || 'Расписание';
        const item: NotificationItem = {
          id: `realtime-sch-${newLesson.id || Date.now()}`,
          user_id: userId,
          title: `Новый урок в расписании: ${subjectName}`,
          message: `${dayName}, ${newLesson.lesson_number}-й урок (${newLesson.start_time}-${newLesson.end_time})${
            newLesson.room ? `, каб. ${newLesson.room}` : ''
          }`,
          type: 'schedule',
          is_read: false,
          created_at: new Date().toISOString(),
          link_tab: 'schedule',
          metadata: {
            day_of_week: newLesson.day_of_week,
            lesson_number: newLesson.lesson_number,
            room: newLesson.room,
            action: 'created',
          },
        };

        deliverNotification(item);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'schedule',
      },
      async (payload) => {
        const updated = payload.new as any;
        if (!updated) return;

        const isClassMatch = classId && updated.class_id === classId;
        if (!isClassMatch && updated.user_id !== userId) return;

        let subjectName = 'Урок';
        if (updated.subject_id) {
          try {
            const { data: sub } = await supabase
              .from('subjects')
              .select('name')
              .eq('id', updated.subject_id)
              .single();
            if (sub?.name) subjectName = sub.name;
          } catch {
            // fallback
          }
        }

        const dayName = DAY_NAMES[updated.day_of_week] || 'Расписание';
        const item: NotificationItem = {
          id: `realtime-sch-up-${updated.id}-${Date.now()}`,
          user_id: userId,
          title: `Изменение в расписании: ${subjectName}`,
          message: `${dayName}, ${updated.lesson_number}-й урок (${updated.start_time}-${updated.end_time})${
            updated.room ? ` • Каб. ${updated.room}` : ''
          }${updated.teacher ? ` • ${updated.teacher}` : ''}`,
          type: 'schedule',
          is_read: false,
          created_at: new Date().toISOString(),
          link_tab: 'schedule',
          metadata: {
            day_of_week: updated.day_of_week,
            lesson_number: updated.lesson_number,
            room: updated.room,
            teacher: updated.teacher,
            action: 'updated',
          },
        };

        deliverNotification(item);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'schedule',
      },
      (payload) => {
        const oldLesson = payload.old as any;
        const item: NotificationItem = {
          id: `realtime-sch-del-${Date.now()}`,
          user_id: userId,
          title: 'Урок удален из расписания',
          message: 'Расписание класса обновлено. Проверьте текущий порядок уроков.',
          type: 'schedule',
          is_read: false,
          created_at: new Date().toISOString(),
          link_tab: 'schedule',
          metadata: {
            action: 'deleted',
            lesson_id: oldLesson?.id,
          },
        };

        deliverNotification(item);
      }
    )
    // 3. Listen for direct NOTIFICATIONS table alerts
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const notif = payload.new as NotificationItem;
        if (notif) {
          deliverNotification(notif);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onStatusChange?.('disconnected');
      } else {
        onStatusChange?.('connecting');
      }
    });

  // Cleanup handler
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('schoolhub_notification_event', handleLocalNotifEvent);
      window.removeEventListener('schoolhub_homework_event', handleLocalHomeworkEvent);
      window.removeEventListener('schoolhub_schedule_event', handleLocalScheduleEvent);
    }
    try {
      supabase.removeChannel(channel);
    } catch (e) {
      console.warn('Error removing realtime channel:', e);
    }
  };
}
