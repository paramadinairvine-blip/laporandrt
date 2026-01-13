import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LOCATIONS, STATUS_OPTIONS } from '@/lib/constants';
import { 
  Building2, LogOut, Search, Filter, RefreshCw, Loader2, 
  ClipboardList, Calendar, MapPin, TrendingUp, Image, UserPlus, CheckCircle, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface DamageReport {
  id: string;
  reporter_name: string;
  damage_description: string;
  location: 'asrama_kampus_1' | 'asrama_kampus_2' | 'asrama_kampus_3';
  photo_url: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama terlalu panjang'),
  email: z.string().trim().email('Email tidak valid').max(255, 'Email terlalu panjang'),
  password: z.string().min(6, 'Password minimal 6 karakter').max(100, 'Password terlalu panjang'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin, signOut, signUp } = useAuth();
  const { toast } = useToast();
  
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' }
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('damage_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      toast({
        title: 'Gagal Memuat Data',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleAddUser = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await signUp(data.email, data.password, data.fullName);
      if (error) {
        let message = 'Terjadi kesalahan saat membuat akun';
        if (error.message.includes('already registered')) {
          message = 'Email sudah terdaftar';
        }
        toast({ title: 'Gagal Membuat Akun', description: message, variant: 'destructive' });
      } else {
        toast({ 
          title: 'Akun Berhasil Dibuat', 
          description: `Akun untuk ${data.email} telah dibuat.` 
        });
        signupForm.reset();
        setIsAddUserOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLocationLabel = (value: string) => {
    return LOCATIONS.find(l => l.value === value)?.label || value;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_OPTIONS.find(s => s.value === status);
    if (!statusConfig) return null;
    
    const colorMap: Record<string, string> = {
      'pending': 'bg-yellow-500 hover:bg-yellow-600',
      'completed': 'bg-green-500 hover:bg-green-600'
    };
    
    return (
      <Badge className={`${colorMap[status] || 'bg-gray-500'} text-white`}>
        {statusConfig.label}
      </Badge>
    );
  };

  const handleStatusChange = async (reportId: string, newStatus: 'pending' | 'completed') => {
    try {
      const { error } = await supabase
        .from('damage_reports')
        .update({ status: newStatus })
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: 'Status Diperbarui',
        description: `Laporan berhasil diubah ke ${newStatus === 'completed' ? 'Sudah Tertangani' : 'Belum Tertangani'}`
      });
      
      fetchReports();
    } catch (error: any) {
      toast({
        title: 'Gagal Mengubah Status',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteReport = async (reportId: string, photoUrl: string | null) => {
    try {
      // Delete photo from storage if exists
      if (photoUrl) {
        const urlParts = photoUrl.split('/damage-photos/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('damage-photos').remove([filePath]);
        }
      }

      // Delete report from database
      const { error } = await supabase
        .from('damage_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: 'Laporan Dihapus',
        description: 'Laporan berhasil dihapus dari sistem'
      });
      
      fetchReports();
    } catch (error: any) {
      toast({
        title: 'Gagal Menghapus Laporan',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Filter reports
  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.reporter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.damage_description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter === 'all' || report.location === locationFilter;
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    return matchesSearch && matchesLocation && matchesStatus;
  });

  // Statistics
  const totalReports = reports.length;
  const todayReports = reports.filter(r => 
    new Date(r.created_at).toDateString() === new Date().toDateString()
  ).length;
  
  const locationStats = LOCATIONS.map(loc => ({
    name: loc.label,
    value: reports.filter(r => r.location === loc.value).length
  }));

  const statusStats = STATUS_OPTIONS.map(status => ({
    name: status.label,
    value: reports.filter(r => r.status === status.value).length
  }));

  const COLORS = ['#1e40af', '#3b82f6', '#60a5fa'];
  const STATUS_COLORS = ['#eab308', '#22c55e'];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="p-2 bg-primary-foreground/10 rounded-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Dashboard Admin</h1>
                <p className="text-xs text-primary-foreground/80">Sistem Pelaporan Pesantren</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/completed')}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Sudah Tertangani
              </Button>
              {isAdmin && (
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="text-primary-foreground hover:bg-primary-foreground/10"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Tambah Akun
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tambah Akun Baru</DialogTitle>
                    </DialogHeader>
                    <Form {...signupForm}>
                      <form onSubmit={signupForm.handleSubmit(handleAddUser)} className="space-y-4">
                        <FormField
                          control={signupForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nama Lengkap</FormLabel>
                              <FormControl>
                                <Input placeholder="Nama lengkap" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signupForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="email@pesantren.id" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signupForm.control}
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
                          control={signupForm.control}
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
                          Buat Akun
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Laporan</CardTitle>
              <ClipboardList className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalReports}</div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Laporan Hari Ini</CardTitle>
              <Calendar className="w-5 h-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{todayReports}</div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Belum Ditangani</CardTitle>
              <TrendingUp className="w-5 h-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {reports.filter(r => r.status === 'pending').length}
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Selesai</CardTitle>
              <MapPin className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {reports.filter(r => r.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Laporan per Lokasi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={locationStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {locationStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Laporan per Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusStats}>
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {statusStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama pelapor atau deskripsi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Lokasi</SelectItem>
                  {LOCATIONS.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchReports} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daftar Laporan Kerusakan</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Tidak ada laporan ditemukan</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Pelapor</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Foto</TableHead>
                      {isAdmin && <TableHead>Ubah Status</TableHead>}
                      {isAdmin && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(report.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                        </TableCell>
                        <TableCell className="font-medium">{report.reporter_name}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{report.damage_description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getLocationLabel(report.location)}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell>
                          {report.photo_url ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0">
                                  <img 
                                    src={report.photo_url} 
                                    alt="Foto kerusakan"
                                    className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                  />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl">
                                <img 
                                  src={report.photo_url} 
                                  alt="Foto kerusakan"
                                  className="w-full h-auto rounded"
                                />
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-muted-foreground text-sm flex items-center gap-1">
                              <Image className="w-4 h-4" />
                              Tidak ada
                            </span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Select 
                              value={report.status} 
                              onValueChange={(value: 'pending' | 'completed') => handleStatusChange(report.id, value)}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    <span className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full ${status.color}`} />
                                      {status.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        {isAdmin && (
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteReport(report.id, report.photo_url)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;