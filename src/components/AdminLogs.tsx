import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { 
  History, 
  Loader2, 
  User, 
  Edit, 
  Trash2, 
  Key, 
  UserPlus,
  ClipboardList,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AdminLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

interface AdminLogsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'update_status':
      return <Edit className="w-4 h-4" />;
    case 'delete_report':
      return <Trash2 className="w-4 h-4" />;
    case 'reset_password':
      return <Key className="w-4 h-4" />;
    case 'add_admin':
      return <UserPlus className="w-4 h-4" />;
    case 'delete_admin':
      return <Trash2 className="w-4 h-4" />;
    default:
      return <ClipboardList className="w-4 h-4" />;
  }
};

const getActionBadge = (action: string) => {
  const actionMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'update_status': { label: 'Ubah Status', variant: 'default' },
    'delete_report': { label: 'Hapus Laporan', variant: 'destructive' },
    'reset_password': { label: 'Reset Password', variant: 'secondary' },
    'add_admin': { label: 'Tambah Admin', variant: 'outline' },
    'delete_admin': { label: 'Hapus Admin', variant: 'destructive' },
  };
  
  const config = actionMap[action] || { label: action, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getTargetTypeBadge = (targetType: string) => {
  const typeMap: Record<string, string> = {
    'report': 'Laporan',
    'admin': 'Admin',
    'user': 'Pengguna',
  };
  return typeMap[targetType] || targetType;
};

export const AdminLogs = ({ isOpen, onOpenChange }: AdminLogsProps) => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs((data as AdminLog[]) || []);
    } catch (error: any) {
      toast({
        title: 'Gagal Memuat Log',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();

      // Subscribe to realtime updates
      const channel = supabase
        .channel('admin-logs-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'admin_logs'
          },
          (payload) => {
            const newLog = payload.new as AdminLog;
            setLogs(prev => [newLog, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Log Aktivitas Admin
          </DialogTitle>
          <DialogDescription>
            Riwayat semua aktivitas yang dilakukan oleh admin di sistem
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada log aktivitas</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss', { locale: idLocale })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{log.admin_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        {getActionBadge(log.action)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTargetTypeBadge(log.target_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-sm text-muted-foreground truncate">
                      {log.details ? (
                        <span title={JSON.stringify(log.details)}>
                          {log.details.description || log.details.email || log.details.status || '-'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
