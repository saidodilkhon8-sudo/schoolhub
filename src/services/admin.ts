import { supabase } from '../lib/supabase';
import { Profile, Assignment, ClassGroup, School } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import {
  getMockAllProfiles,
  updateMockUserRole,
  deleteMockProfile,
  getMockAllAssignments,
  getMockClasses,
  getMockSchools,
  getMockAdminReports,
  resolveMockAdminReport,
  createMockNotification,
  AdminReportItem,
} from '../lib/mockStore';

export interface AdminStats {
  totalUsers: number;
  totalClasses: number;
  totalAssignments: number;
  totalSchools: number;
  pendingReports: number;
}

export async function fetchAdminUsers(): Promise<Profile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, school:schools(*)')
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockAllProfiles();
      }
      return getMockAllProfiles();
    }
    if (!data || data.length === 0) {
      return getMockAllProfiles();
    }
    return data as unknown as Profile[];
  } catch {
    return getMockAllProfiles();
  }
}

export async function updateUserRoleAndAdmin(
  userId: string,
  role: 'admin' | 'student' | 'teacher',
  isAdmin: boolean
): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role, is_admin: isAdmin })
      .eq('id', userId)
      .select('*, school:schools(*)')
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
      }
      return updateMockUserRole(userId, role, isAdmin);
    }
    updateMockUserRole(userId, role, isAdmin);
    return data as Profile;
  } catch {
    return updateMockUserRole(userId, role, isAdmin);
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
      }
    }
    deleteMockProfile(userId);
  } catch {
    deleteMockProfile(userId);
  }
}

export async function fetchAdminStats(): Promise<AdminStats> {
  try {
    const users = await fetchAdminUsers();
    const classes = getMockClasses();
    const assignments = getMockAllAssignments();
    const schools = getMockSchools();
    const reports = getMockAdminReports();

    return {
      totalUsers: users.length,
      totalClasses: classes.length,
      totalAssignments: assignments.length,
      totalSchools: schools.length,
      pendingReports: reports.filter((r) => r.status === 'pending').length,
    };
  } catch {
    return {
      totalUsers: 6,
      totalClasses: 3,
      totalAssignments: 8,
      totalSchools: 5,
      pendingReports: 1,
    };
  }
}

export async function fetchAdminReports(): Promise<AdminReportItem[]> {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return getMockAdminReports();
    }
    return data as AdminReportItem[];
  } catch {
    return getMockAdminReports();
  }
}

export async function resolveAdminReport(
  reportId: string,
  status: 'resolved' | 'dismissed'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', reportId);

    if (error) {
      resolveMockAdminReport(reportId, status);
      return;
    }
    resolveMockAdminReport(reportId, status);
  } catch {
    resolveMockAdminReport(reportId, status);
  }
}

export async function broadcastSystemNotification(
  title: string,
  message: string,
  tabLink: 'homework' | 'schedule' | 'class' | 'grades' | 'dashboard' = 'dashboard'
): Promise<void> {
  // Broadcast to mock store so current user and session get it immediately
  createMockNotification({
    user_id: 'default-student',
    title: `📢 ${title}`,
    message,
    type: 'class',
    is_read: false,
    link_tab: tabLink,
  });

  try {
    // Also try writing to Supabase notifications if table exists
    await supabase.from('notifications').insert({
      title: `📢 ${title}`,
      message,
      type: 'class',
      is_read: false,
      user_id: 'all',
    });
  } catch {
    // Supabase table may not exist, mock is handled
  }
}
