import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import {
  getMockMessages,
  sendMockMessage,
  deleteMockMessage,
} from '../lib/mockStore';

export async function getClassMessages(classId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profile:profiles(id, first_name, last_name, avatar_url)
      `)
      .eq('class_id', classId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return getMockMessages(classId);
      }
      throw error;
    }
    return (data || []) as unknown as Message[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return getMockMessages(classId);
    }
    throw err;
  }
}

export async function sendMessage(classId: string, userId: string, content: string): Promise<Message> {
  const cleanContent = content.trim();
  if (!cleanContent) throw new Error('Сообщение не может быть пустым');

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        class_id: classId,
        user_id: userId,
        content: cleanContent,
      })
      .select(`
        *,
        profile:profiles(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        return sendMockMessage(classId, userId, cleanContent);
      }
      throw error;
    }
    return data as unknown as Message;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      return sendMockMessage(classId, userId, cleanContent);
    }
    throw err;
  }
}

export async function deleteMessage(messageId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', userId);

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        deleteMockMessage(messageId);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      deleteMockMessage(messageId);
      return;
    }
    throw err;
  }
}

export function subscribeToClassMessages(
  classId: string,
  onNewMessage: (msg: Message) => void,
  onDeletedMessage: (msgId: string) => void
) {
  // Listen for local mock store events as well
  const handleLocalMsg = (e: any) => {
    if (e.detail && e.detail.class_id === classId) {
      onNewMessage(e.detail);
    }
  };
  const handleLocalDelete = (e: any) => {
    if (e.detail && e.detail.id) {
      onDeletedMessage(e.detail.id);
    }
  };
  window.addEventListener('schoolhub_new_message', handleLocalMsg);
  window.addEventListener('schoolhub_delete_message', handleLocalDelete);

  const channel = supabase
    .channel(`class-chat-${classId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `class_id=eq.${classId}`,
      },
      async (payload) => {
        // Fetch message with profile
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            profile:profiles(id, first_name, last_name, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onNewMessage(data as unknown as Message);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `class_id=eq.${classId}`,
      },
      (payload) => {
        if (payload.old?.id) {
          onDeletedMessage(payload.old.id);
        }
      }
    )
    .subscribe();

  return () => {
    window.removeEventListener('schoolhub_new_message', handleLocalMsg);
    window.removeEventListener('schoolhub_delete_message', handleLocalDelete);
    supabase.removeChannel(channel);
  };
}
