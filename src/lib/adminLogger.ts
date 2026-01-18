import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  action: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, any>;
}

export const logAdminAction = async (entry: LogEntry) => {
  try {
    // Get current user info
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get admin name from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const adminName = profile?.full_name || profile?.email?.split('@')[0] || 'Unknown Admin';

    // Insert log entry
    await supabase
      .from('admin_logs')
      .insert({
        admin_id: user.id,
        admin_name: adminName,
        action: entry.action,
        target_type: entry.target_type,
        target_id: entry.target_id || null,
        details: entry.details || null
      });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
};
