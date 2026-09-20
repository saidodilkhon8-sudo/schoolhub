import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import { NotificationItem } from '../types';
import { NavTab } from '../components/Navigation';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  subscribeToRealtimeAlerts,
  dispatchLocalNotification,
} from '../services/notifications';
import { playNotificationChime } from '../utils/sound';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  realtimeStatus: 'connected' | 'connecting' | 'disconnected';
  isCenterOpen: boolean;
  setIsCenterOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  activeAlert: NotificationItem | null;
  dismissActiveAlert: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  triggerTestNotification: (type: 'homework' | 'schedule') => void;
  navigateTab: (tab: NavTab) => void;
  registerNavigationHandler: (handler: (tab: NavTab) => void) => () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isCenterOpen, setIsCenterOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<NotificationItem | null>(null);

  const navHandlerRef = useRef<((tab: NavTab) => void) | null>(null);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const registerNavigationHandler = useCallback((handler: (tab: NavTab) => void) => {
    navHandlerRef.current = handler;
    return () => {
      navHandlerRef.current = null;
    };
  }, []);

  const navigateTab = useCallback((tab: NavTab) => {
    if (navHandlerRef.current) {
      navHandlerRef.current(tab);
    }
  }, []);

  // Fetch initial notifications
  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const items = await getNotifications(user.id);
      setNotifications(items);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Handle incoming real-time alert
  const handleIncomingAlert = useCallback(
    (notif: NotificationItem) => {
      // Check if user has notifications enabled
      const enabled = profile?.notifications_enabled ?? true;

      // Update notifications list (avoiding duplicate ID)
      setNotifications((prev) => {
        const existingIdx = prev.findIndex((n) => n.id === notif.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = notif;
          return updated;
        }
        return [notif, ...prev];
      });

      if (enabled) {
        // Play subtle sound chime
        playNotificationChime();

        // Show floating toast/banner alert
        setActiveAlert(notif);

        if (alertTimeoutRef.current) {
          clearTimeout(alertTimeoutRef.current);
        }

        // Auto dismiss after 6.5 seconds
        alertTimeoutRef.current = setTimeout(() => {
          setActiveAlert((current) => (current?.id === notif.id ? null : current));
        }, 6500);
      }
    },
    [profile?.notifications_enabled]
  );

  const dismissActiveAlert = useCallback(() => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
    setActiveAlert(null);
  }, []);

  // Subscribe to Supabase Realtime changes
  useEffect(() => {
    if (!user) {
      setRealtimeStatus('disconnected');
      return;
    }

    const unsubscribe = subscribeToRealtimeAlerts({
      userId: user.id,
      classId: profile?.class_id || null,
      onNotification: handleIncomingAlert,
      onStatusChange: setRealtimeStatus,
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, profile?.class_id, handleIncomingAlert]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsAsRead(user.id);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const removeNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (activeAlert?.id === id) {
      dismissActiveAlert();
    }
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const clearAll = async () => {
    if (!user) return;
    setNotifications([]);
    dismissActiveAlert();
    try {
      await clearAllNotifications(user.id);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  // Trigger interactive test notification
  const triggerTestNotification = (type: 'homework' | 'schedule') => {
    if (!user) return;

    if (type === 'homework') {
      const mockHw: NotificationItem = {
        id: `test-hw-${Date.now()}`,
        user_id: user.id,
        title: 'Новое Д/З: Алгебра (№ 234, 235)',
        message: 'Параграф 14, свойства степеней • Срок сдачи: завтра к 08:30',
        type: 'homework',
        is_read: false,
        created_at: new Date().toISOString(),
        link_tab: 'homework',
        metadata: {
          subject_name: 'Алгебра',
          action: 'created',
        },
      };
      dispatchLocalNotification(mockHw);
    } else {
      const mockSch: NotificationItem = {
        id: `test-sch-${Date.now()}`,
        user_id: user.id,
        title: 'Изменение в расписании: Физика',
        message: 'Вторник, 3-й урок перенесен в кабинет № 304 (Лаборатория)',
        type: 'schedule',
        is_read: false,
        created_at: new Date().toISOString(),
        link_tab: 'schedule',
        metadata: {
          day_of_week: 2,
          lesson_number: 3,
          room: '304',
          action: 'updated',
        },
      };
      dispatchLocalNotification(mockSch);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        realtimeStatus,
        isCenterOpen,
        setIsCenterOpen,
        activeAlert,
        dismissActiveAlert,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
        triggerTestNotification,
        navigateTab,
        registerNavigationHandler,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
