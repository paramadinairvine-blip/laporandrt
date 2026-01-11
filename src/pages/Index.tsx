import { Link } from 'react-router-dom';
import { DamageReportForm } from '@/components/DamageReportForm';
import { Building2, ShieldCheck, ClipboardList } from 'lucide-react';
import campusBackground from '@/assets/campus-background.jpg';
import logoDrt from '@/assets/logo-drt.png';

const Index = () => {
  // Optional: Add your Google Apps Script webhook URL here
  const googleWebhookUrl = undefined; // e.g., 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'

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
        {/* Fade overlay for readability */}
        <div className="absolute inset-0 bg-background/85" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-primary/95 text-primary-foreground shadow-lg backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-foreground/10 rounded-lg">
                  <Building2 className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold">Laporan Kerusakan Fasilitas</h1>
                  <p className="text-sm text-primary-foreground/80">Sistem Pelaporan Kampus</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link 
                  to="/auth" 
                  className="flex items-center gap-2 px-4 py-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-lg transition-colors text-sm font-medium"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin Dashboard</span>
                  <span className="sm:hidden">Admin</span>
                </Link>
                <img 
                  src={logoDrt} 
                  alt="Logo DRT" 
                  className="h-12 md:h-14 w-auto object-contain"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 md:py-12 flex-1">
          <div className="max-w-2xl mx-auto">
            {/* Info Section */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <ClipboardList className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Form Pelaporan Kerusakan
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Laporkan kerusakan fasilitas kampus dengan mengisi form di bawah ini. 
                Tim kami akan segera menindaklanjuti laporan Anda.
              </p>
            </div>

            {/* Form Card */}
            <div className="form-section">
              <DamageReportForm googleWebhookUrl={googleWebhookUrl} />
            </div>

            {/* Footer Info */}
            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Butuh bantuan? Hubungi bagian sarana prasarana kampus.</p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-primary/95 text-primary-foreground py-4 backdrop-blur-sm">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm font-medium">@DRT2026</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;