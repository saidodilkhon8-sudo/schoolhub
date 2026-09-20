import { supabase } from '../lib/supabase';
import { Report } from '../types';
import { isTableMissingError, setSchemaMissing } from '../lib/dbStatus';
import { reportMockMessage } from '../lib/mockStore';

export async function submitReport(
  reporterId: string,
  messageId: string,
  reason: 'Спам' | 'Оскорбление' | 'Неподходящий контент' | 'Другое'
): Promise<Report> {
  try {
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        message_id: messageId,
        reason,
      })
      .select()
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        setSchemaMissing(true);
        reportMockMessage(reporterId, messageId, reason);
        return {
          id: `rep-${Date.now()}`,
          reporter_id: reporterId,
          message_id: messageId,
          reason,
          created_at: new Date().toISOString(),
        };
      }
      throw error;
    }
    return data as Report;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      setSchemaMissing(true);
      reportMockMessage(reporterId, messageId, reason);
      return {
        id: `rep-${Date.now()}`,
        reporter_id: reporterId,
        message_id: messageId,
        reason,
        created_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}
