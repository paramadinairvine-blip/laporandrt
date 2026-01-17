import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LOCATIONS, STATUS_OPTIONS, DAMAGE_TYPES } from '@/lib/constants';
import { ClipboardList, Search, Filter, RefreshCw, Loader2, Image, Home, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import campusBackground from '@/assets/campus-background.jpg';
import logoDrt from '@/assets/logo-drt.png';
import whatsappIcon from '@/assets/whatsapp-icon.png';

// Public view interface - no reporter_name for privacy
interface DamageReportPublic {
  id: string;
  damage_description: string;
  location: 'asrama_kampus_1' | 'asrama_kampus_2' | 'asrama_kampus_3';
  damage_type: 'rehab' | 'listrik' | 'air' | 'taman' | 'lainnya';
  photo_url: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

const Reports = () => {
  const [reports, setReports] = useState<DamageReportPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      // Use public view to protect reporter privacy
      const { data, error } = await supabase
        .from('damage_reports_public')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      console.error('Failed to fetch reports:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getLocationLabel = (value: string) => {
    const location = LOCATIONS.find(loc => loc.value === value);
    return location?.label || value;
  };

  const getDamageTypeLabel = (value: string) => {
    const type = DAMAGE_TYPES.find(t => t.value === value);
    return type?.label || value;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="destructive">Belum Tertangani</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Sedang Diproses</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Sudah Tertangani</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.damage_description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter === 'all' || report.location === locationFilter;
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    return matchesSearch && matchesLocation && matchesStatus;
  });

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Background Image with Overlay */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${campusBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-background/85" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-primary/95 text-primary-foreground shadow-lg backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white rounded-lg p-2 shadow-lg shadow-black/20">
                  <img 
                    src={logoDrt} 
                    alt="Logo DRT" 
                    className="h-10 md:h-12 w-auto object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold">Daftar Laporan</h1>
                  <p className="text-sm text-primary-foreground/80">Sistem Pelaporan Pesantren</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link 
                  to="/" 
                  className="flex items-center gap-2 px-4 py-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-lg transition-colors text-sm font-medium"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Beranda</span>
                </Link>
                <Link 
                  to="/auth" 
                  className="flex items-center gap-2 px-4 py-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-lg transition-colors text-sm font-medium"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 flex-1">
          {/* Stats Card */}
          <Card className="mb-6 bg-card/95 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Statistik Laporan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-primary">{reports.length}</p>
                  <p className="text-sm text-muted-foreground">Total Laporan</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-red-500">{reports.filter(r => r.status === 'pending').length}</p>
                  <p className="text-sm text-muted-foreground">Belum Tertangani</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-yellow-500">{reports.filter(r => r.status === 'in_progress').length}</p>
                  <p className="text-sm text-muted-foreground">Sedang Diproses</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{reports.filter(r => r.status === 'completed').length}</p>
                  <p className="text-sm text-muted-foreground">Sudah Tertangani</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="mb-6 bg-card/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari berdasarkan deskripsi kerusakan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Lokasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Lokasi</SelectItem>
                      {LOCATIONS.map((loc) => (
                        <SelectItem key={loc.value} value={loc.value}>
                          {loc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={fetchReports}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reports Table */}
          <Card className="bg-card/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
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
                        <TableHead>Jenis Kerusakan</TableHead>
                        <TableHead>Deskripsi Kerusakan</TableHead>
                        <TableHead>Lokasi</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Foto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(report.created_at), 'dd MMM yyyy', { locale: idLocale })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getDamageTypeLabel(report.damage_type)}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{report.damage_description}</TableCell>
                          <TableCell>{getLocationLabel(report.location)}</TableCell>
                          <TableCell>{getStatusBadge(report.status)}</TableCell>
                          <TableCell>
                            {report.photo_url ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Image className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl">
                                  <img
                                    src={report.photo_url}
                                    alt="Foto kerusakan"
                                    className="w-full h-auto rounded-lg"
                                  />
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="bg-primary/95 text-primary-foreground py-4 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium">@DRT2026</p>
              <a 
                href="https://wa.me/6285156526862" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:text-primary-foreground/80 transition-colors"
              >
                <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5" />
                <span>085156526862</span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Reports;
