//
// File: notificationService.ts
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Handles persistent system notifications, alert actions, read/unread status updates, and subscriber cleanup logs
//

import { supabase } from '../supabase';
import { InAppNotification } from '../types';

function mapNotification(row: any): InAppNotification {
  return {
    id: row.id,
    title: row.title || '',
    message: row.message || '',
    type: row.type || 'info',
    userId: row.user_id || undefined,
    read: !!row.read,
    createdAt: row.created_at || new Date().toISOString()
  };
}

/**
 * Creates a system/user notification in the Supabase notifications table.
 */
export async function sendInAppNotification(data: {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  userId?: string;
}) {
  try {
    await supabase.from('notifications').insert({
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      user_id: data.userId || null,
      read: false
    });
  } catch (err: any) {
    console.error('[Notifications Service] Critical fail writing notification:', err.message);
  }
}

/**
 * Subscribes to notifications in real-time via Supabase Realtime.
 * Returns a cleanup function.
 */
export function subscribeToNotifications(
  onUpdate: (notifications: InAppNotification[]) => void,
  _userId?: string
) {
  const load = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    onUpdate((data || []).map(mapNotification));
  };

  load();

  const channel = supabase
    .channel('notifications-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(id: string) {
  try {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  } catch (err) {
    console.error('[Notifications Service] Error marking notification read:', err);
  }
}

/**
 * Marks all notifications as read.
 */
export async function markAllNotificationsAsRead(notifications: InAppNotification[]) {
  const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
  if (unreadIds.length) {
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  }
}

/**
 * Clears/Deletes a notification.
 */
export async function deleteNotification(id: string) {
  try {
    await supabase.from('notifications').delete().eq('id', id);
  } catch (err) {
    console.error('[Notifications Service] Error deleting notification:', err);
  }
}
