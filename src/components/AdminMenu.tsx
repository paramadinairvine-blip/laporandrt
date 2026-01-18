import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  KeyRound, 
  Loader2,
  Shield,
  ChevronDown,
  Key,
  History
} from 'lucide-react';
import { logAdminAction } from '@/lib/adminLogger';
import { AdminLogs } from '@/components/AdminLogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AdminUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

const addAdminSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama terlalu panjang'),
  email: z.string().trim().email('Email tidak valid').max(255, 'Email terlalu panjang'),
  password: z.string().min(6, 'Password minimal 6 karakter').max(100, 'Password terlalu panjang'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword'],
});

const directResetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password minimal 6 karakter').max(100, 'Password terlalu panjang'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword'],
});

type AddAdminFormData = z.infer<typeof addAdminSchema>;
type DirectResetPasswordFormData = z.infer<typeof directResetPasswordSchema>;

export const AdminMenu = () => {
  const { user, signUp } = useAuth();
  const { toast } = useToast();
  
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isDataAdminOpen, setIsDataAdminOpen] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);

  const addAdminForm = useForm<AddAdminFormData>({
    resolver: zodResolver(addAdminSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' }
  });

  const directResetPasswordForm = useForm<DirectResetPasswordFormData>({
    resolver: zodResolver(directResetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' }
  });

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      // Get all admin user_ids from user_roles
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (roleError) throw roleError;

      if (!roleData || roleData.length === 0) {
        setAdmins([]);
        return;
      }

      // Get profile info for each admin
      const adminIds = roleData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', adminIds);

      if (profileError) throw profileError;

      const adminList: AdminUser[] = (profileData || []).map(profile => ({
        user_id: profile.id,
        email: profile.email,
        full_name: profile.full_name
      }));

      setAdmins(adminList);
    } catch (error: any) {
      toast({
        title: 'Gagal Memuat Data Admin',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch admins when dialog opens and set up realtime subscription
  useEffect(() => {
    if (isDataAdminOpen) {
      fetchAdmins();
    }

    // Subscribe to user_roles changes for realtime updates
    const channel = supabase
      .channel('admin-roles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: 'role=eq.admin'
        },
        () => {
          // Refetch admins when any admin role changes
          fetchAdmins();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDataAdminOpen]);

  const handleAddAdmin = async (data: AddAdminFormData) => {
    setIsSubmitting(true);
    try {
      // Create new user account using Supabase Admin API via edge function
      const { data: result, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName
        }
      });

      // Handle edge function errors (including 400 responses)
      const errorMessage = error?.message || result?.error;
      if (errorMessage) {
        let message = errorMessage;
        if (message.toLowerCase().includes('already') && message.toLowerCase().includes('registered')) {
          message = 'Email sudah terdaftar';
        }
        toast({ title: 'Gagal Membuat Admin', description: message, variant: 'destructive' });
        return;
      }

      if (!result?.success) {
        toast({ title: 'Gagal Membuat Admin', description: 'Terjadi kesalahan saat membuat akun', variant: 'destructive' });
        return;
      }
      
      // Log admin action
      await logAdminAction({
        action: 'add_admin',
        target_type: 'admin',
        target_id: result?.userId,
        details: { email: data.email, name: data.fullName }
      });

      toast({ 
        title: 'Akun Admin Berhasil Dibuat', 
        description: `Akun admin untuk ${data.email} telah dibuat dengan role admin.` 
      });
      
      addAdminForm.reset();
      setIsAddAdminOpen(false);
      fetchAdmins();
    } catch (error: any) {
      let message = error?.message || 'Terjadi kesalahan saat membuat akun';
      if (message.toLowerCase().includes('already') && message.toLowerCase().includes('registered')) {
        message = 'Email sudah terdaftar';
      }
      toast({
        title: 'Gagal Membuat Admin',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;
    
    // Prevent self-deletion
    if (selectedAdmin.user_id === user?.id) {
      toast({
        title: 'Tidak Dapat Menghapus',
        description: 'Anda tidak dapat menghapus akun Anda sendiri',
        variant: 'destructive'
      });
      setIsDeleteDialogOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      // Remove admin role from user_roles table
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedAdmin.user_id)
        .eq('role', 'admin');

      if (error) throw error;

      // Log admin action
      await logAdminAction({
        action: 'delete_admin',
        target_type: 'admin',
        target_id: selectedAdmin.user_id,
        details: { email: selectedAdmin.email, name: selectedAdmin.full_name }
      });

      toast({
        title: 'Admin Berhasil Dihapus',
        description: `Role admin untuk ${selectedAdmin.email || selectedAdmin.full_name} telah dihapus`
      });
      
      setIsDeleteDialogOpen(false);
      setSelectedAdmin(null);
      fetchAdmins();
    } catch (error: any) {
      toast({
        title: 'Gagal Menghapus Admin',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectResetPassword = async (data: DirectResetPasswordFormData) => {
    if (!selectedAdmin) return;

    setIsSubmitting(true);
    try {
      // Call edge function to reset password directly
      const { data: result, error } = await supabase.functions.invoke('reset-admin-password', {
        body: {
          targetUserId: selectedAdmin.user_id,
          newPassword: data.newPassword
        }
      });

      if (error) throw error;

      if (result?.error) {
        throw new Error(result.error);
      }

      // Log admin action
      await logAdminAction({
        action: 'reset_password',
        target_type: 'admin',
        target_id: selectedAdmin.user_id,
        details: { email: selectedAdmin.email, name: selectedAdmin.full_name }
      });

      toast({
        title: 'Password Berhasil Diubah',
        description: `Password untuk ${selectedAdmin.email || selectedAdmin.full_name} telah diperbarui`
      });
      
      directResetPasswordForm.reset();
      setIsResetPasswordOpen(false);
      setSelectedAdmin(null);
    } catch (error: any) {
      toast({
        title: 'Gagal Reset Password',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setIsDeleteDialogOpen(true);
  };

  const openResetPasswordDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    directResetPasswordForm.reset();
    setIsResetPasswordOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <Shield className="w-4 h-4 mr-2" />
            Admin
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setIsDataAdminOpen(true)}>
            <Users className="w-4 h-4 mr-2" />
            Data Admin
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsAddAdminOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Tambah Admin
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsLogsOpen(true)}>
            <History className="w-4 h-4 mr-2" />
            Log Aktivitas
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Data Admin Dialog */}
      <Dialog open={isDataAdminOpen} onOpenChange={setIsDataAdminOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Data Admin
            </DialogTitle>
            <DialogDescription>
              Daftar semua admin yang terdaftar di sistem
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada admin terdaftar
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.user_id}>
                      <TableCell className="font-medium">
                        {admin.full_name || '-'}
                        {admin.user_id === user?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
                        )}
                      </TableCell>
                      <TableCell>{admin.email || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResetPasswordDialog(admin)}
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog(admin)}
                            disabled={admin.user_id === user?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Admin Dialog */}
      <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Tambah Admin Baru
            </DialogTitle>
            <DialogDescription>
              Buat akun admin baru untuk sistem pelaporan
            </DialogDescription>
          </DialogHeader>
          <Form {...addAdminForm}>
            <form onSubmit={addAdminForm.handleSubmit(handleAddAdmin)} className="space-y-4">
              <FormField
                control={addAdminForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama lengkap admin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addAdminForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@pesantren.id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addAdminForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addAdminForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Buat Admin
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Admin Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus role admin untuk{' '}
              <strong>{selectedAdmin?.full_name || selectedAdmin?.email}</strong>? 
              Akun tetap ada, tetapi tidak akan memiliki akses admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAdmin}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Hapus Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Ubah Password Admin
            </DialogTitle>
            <DialogDescription>
              Ubah password untuk <strong>{selectedAdmin?.full_name || selectedAdmin?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <Form {...directResetPasswordForm}>
            <form onSubmit={directResetPasswordForm.handleSubmit(handleDirectResetPassword)} className="space-y-4">
              <FormField
                control={directResetPasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Baru</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={directResetPasswordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsResetPasswordOpen(false)} disabled={isSubmitting}>
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  Simpan Password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Admin Logs Dialog */}
      <AdminLogs isOpen={isLogsOpen} onOpenChange={setIsLogsOpen} />
    </>
  );
};
