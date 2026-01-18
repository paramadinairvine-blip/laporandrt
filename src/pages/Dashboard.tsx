import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LOCATIONS, STATUS_OPTIONS, DAMAGE_TYPES } from '@/lib/constants';
import { 
  LogOut, Search, Filter, RefreshCw, Loader2, 
  ClipboardList, Calendar, MapPin, TrendingUp, Image, CheckCircle, Trash2,
  Download, FileSpreadsheet, CalendarIcon, X
} from 'lucide-react';
import { AdminMenu } from '@/components/AdminMenu';
import * as XLSX from 'xlsx';
import logoDrt from '@/assets/logo-drt.png';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { logAdminAction } from '@/lib/adminLogger';

interface DamageReport {
  id: string;
  reporter_name: string;
  damage_description: string;
  damage_type: 'rehab' | 'listrik' | 'air' | 'taman' | 'lainnya';
  location: 'asrama_kampus_1' | 'asrama_kampus_2' | 'asrama_kampus_3';
  photo_url: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [damageTypeFilter, setDamageTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchReports();
      fetchUserName();

      // Subscribe to realtime updates for damage_reports
      const channel = supabase
        .channel('dashboard-reports-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'damage_reports'
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newReport = payload.new as DamageReport;
              setReports(prev => [newReport, ...prev]);
              toast({
                title: 'Laporan Baru',
                description: `Laporan dari ${newReport.reporter_name} telah masuk`
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedReport = payload.new as DamageReport;
              setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setReports(prev => prev.filter(r => r.id !== deletedId));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, toast]);

  const fetchUserName = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    
    if (!error && data?.full_name) {
      setUserName(data.full_name);
    } else {
      // Fallback to email if no profile name
      setUserName(user.email?.split('@')[0] || null);
    }
  };

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
    navigate('/');
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

      // Log admin action
      await logAdminAction({
        action: 'update_status',
        target_type: 'report',
        target_id: reportId,
        details: { status: newStatus === 'completed' ? 'Sudah Tertangani' : 'Belum Tertangani' }
      });

      toast({
        title: 'Status Diperbarui',
        description: `Laporan berhasil diubah ke ${newStatus === 'completed' ? 'Sudah Tertangani' : 'Belum Tertangani'}`
      });
    } catch (error: any) {
      toast({
        title: 'Gagal Mengubah Status',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteReport = async (reportId: string, photoUrl: string | null, reporterName: string) => {
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

      // Log admin action
      await logAdminAction({
        action: 'delete_report',
        target_type: 'report',
        target_id: reportId,
        details: { reporter_name: reporterName }
      });

      toast({
        title: 'Laporan Dihapus',
        description: 'Laporan berhasil dihapus dari sistem'
      });
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
    const matchesDamageType = damageTypeFilter === 'all' || report.damage_type === damageTypeFilter;
    
    // Date range filter
    const reportDate = new Date(report.created_at);
    const matchesDateFrom = !dateFrom || !isBefore(reportDate, startOfDay(dateFrom));
    const matchesDateTo = !dateTo || !isAfter(reportDate, endOfDay(dateTo));
    
    return matchesSearch && matchesLocation && matchesStatus && matchesDamageType && matchesDateFrom && matchesDateTo;
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

  const getDamageTypeLabel = (value: string) => {
    return DAMAGE_TYPES.find(d => d.value === value)?.label || value;
  };

  const exportToExcel = (exportFiltered: boolean) => {
    const dataToExport = exportFiltered ? filteredReports : reports;
    
    if (dataToExport.length === 0) {
      toast({
        title: 'Tidak Ada Data',
        description: 'Tidak ada data untuk diekspor',
        variant: 'destructive'
      });
      return;
    }

    const excelData = dataToExport.map((report, index) => ({
      'No': index + 1,
      'Tanggal': format(new Date(report.created_at), 'dd/MM/yyyy HH:mm', { locale: idLocale }),
      'Nama Pelapor': report.reporter_name,
      'Jenis Kerusakan': getDamageTypeLabel(report.damage_type),
      'Deskripsi': report.damage_description,
      'Lokasi': getLocationLabel(report.location),
      'Status': report.status === 'completed' ? 'Sudah Tertangani' : 'Belum Tertangani',
      'URL Foto': report.photo_url || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Kerusakan');

    // Auto-size columns
    const colWidths = [
      { wch: 5 },   // No
      { wch: 18 },  // Tanggal
      { wch: 20 },  // Nama Pelapor
      { wch: 15 },  // Jenis Kerusakan
      { wch: 40 },  // Deskripsi
      { wch: 20 },  // Lokasi
      { wch: 18 },  // Status
      { wch: 50 },  // URL Foto
    ];
    worksheet['!cols'] = colWidths;

    const filterInfo = exportFiltered ? '_filtered' : '_all';
    const fileName = `Laporan_Kerusakan${filterInfo}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: 'Ekspor Berhasil',
      description: `${dataToExport.length} laporan berhasil diekspor ke Excel`
    });
  };

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
              <div className="bg-white rounded-lg p-2 shadow-lg shadow-black/20">
                <img 
                  src={logoDrt} 
                  alt="Logo DRT" 
                  className="h-8 md:h-10 w-auto object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold">Dashboard Admin</h1>
                <p className="text-xs text-primary-foreground/80">Sistem Pelaporan Pesantren</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              {userName && (
                <span className="text-sm text-primary-foreground/80 hidden md:inline">
                  Halo, <span className="font-semibold text-primary-foreground">{userName}</span>
                </span>
              )}
              <Button 
                variant="ghost" 
                onClick={() => navigate('/completed')}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Sudah Tertangani
              </Button>
              {isAdmin && <AdminMenu />}
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
            <div className="flex flex-col gap-4">
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
                <Select value={damageTypeFilter} onValueChange={setDamageTypeFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter Jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Jenis</SelectItem>
                    {DAMAGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchReports} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              
              {/* Date Range Filter */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Rentang Tanggal:</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[160px] justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Dari Tanggal"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        disabled={(date) => dateTo ? isAfter(date, dateTo) : false}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">-</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[160px] justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Sampai Tanggal"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        disabled={(date) => dateFrom ? isBefore(date, dateFrom) : false}
                      />
                    </PopoverContent>
                  </Popover>
                  {(dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDateFrom(undefined);
                        setDateTo(undefined);
                      }}
                      className="h-8 px-2"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Export Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Ekspor ke Excel:</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportToExcel(true)}
                    disabled={filteredReports.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Ekspor Hasil Filter ({filteredReports.length})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportToExcel(false)}
                    disabled={reports.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Ekspor Semua ({reports.length})
                  </Button>
                </div>
              </div>
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
                                <DialogHeader>
                                  <DialogTitle>Foto Kerusakan</DialogTitle>
                                </DialogHeader>
                                <div className="relative">
                                  <img 
                                    src={report.photo_url} 
                                    alt="Foto kerusakan"
                                    className="w-full h-auto rounded"
                                  />
                                  <div className="mt-4 flex justify-end">
                                    <Button 
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = report.photo_url!;
                                        link.download = `foto-kerusakan-${report.id}.jpg`;
                                        link.target = '_blank';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        toast({ title: 'Mengunduh foto...' });
                                      }}
                                      className="gap-2"
                                    >
                                      <Download className="w-4 h-4" />
                                      Download Foto
                                    </Button>
                                  </div>
                                </div>
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
                            <div className="flex items-center gap-1">
                              {report.photo_url && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={async () => {
                                    try {
                                      toast({ title: 'Mengunduh foto...' });
                                      const response = await fetch(report.photo_url!);
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `foto-kerusakan-${report.id}.jpg`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      window.URL.revokeObjectURL(url);
                                      toast({ title: 'Foto berhasil diunduh!' });
                                    } catch (error) {
                                      toast({ title: 'Gagal mengunduh foto', variant: 'destructive' });
                                    }
                                  }}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteReport(report.id, report.photo_url, report.reporter_name)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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