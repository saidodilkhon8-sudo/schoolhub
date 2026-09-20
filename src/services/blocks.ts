import { supabase } from '../lib/supabase';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import { blockMockUser, getBlockedMockUserIds } from '../lib/mockStore';

export async function getBlockedUserIds(blockerId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_user_id')
      .eq('blocker_id', blockerId);

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getBlockedMockUserIds(blockerId);
      }
      throw error;
    }
    return (data || []).map((row) => row.blocked_user_id);
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getBlockedMockUserIds(blockerId);
    }
    throw err;
  }
}

export async function blockUser(blockerId: string, blockedUserId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('blocked_users')
      .upsert(
        {
          blocker_id: blockerId,
          blocked_user_id: blockedUserId,
        },
        { onConflict: 'blocker_id,blocked_user_id' }
      );

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        blockMockUser(blockerId, blockedUserId);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      blockMockUser(blockerId, blockedUserId);
      return;
    }
    throw err;
  }
}

export async function unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_user_id', blockedUserId);

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return;
    }
    throw err;
  }
}
