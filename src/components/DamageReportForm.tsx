import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { LOCATIONS, DAMAGE_TYPES } from '@/lib/constants';
import { Upload, X, CheckCircle, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const formSchema = z.object({
  reporter_name: z.string().trim().min(1, 'Nama pelapor harus diisi').max(100, 'Nama maksimal 100 karakter'),
  damage_description: z.string().trim().min(10, 'Deskripsi minimal 10 karakter').max(1000, 'Deskripsi maksimal 1000 karakter'),
  location: z.enum(['asrama_kampus_1', 'asrama_kampus_2', 'asrama_kampus_3'], {
    required_error: 'Pilih lokasi kerusakan'
  }),
  damage_type: z.enum(['rehab', 'listrik', 'air', 'taman', 'lainnya'], {
    required_error: 'Pilih jenis kerusakan'
  }),
});

type FormData = z.infer<typeof formSchema>;

interface DamageReportFormProps {
  onSuccess?: () => void;
}

export const DamageReportForm = ({ onSuccess }: DamageReportFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reporter_name: '',
      damage_description: '',
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: 'Format tidak didukung',
        description: 'Gunakan format JPG, PNG, atau WebP',
        variant: 'destructive'
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Ukuran file terlalu besar',
        description: 'Maksimal ukuran file adalah 5MB',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `reports/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('damage-photos')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('damage-photos')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const sendToGoogleSheets = async (data: FormData, photoUrl: string | null) => {
    try {
      const locationLabel = LOCATIONS.find(l => l.value === data.location)?.label || data.location;
      
      // Call edge function to send to Google Sheets
      const { error } = await supabase.functions.invoke('send-to-sheets', {
        body: {
          reporter_name: data.reporter_name,
          damage_description: data.damage_description,
          location: locationLabel,
          photo_url: photoUrl || '',
          created_at: new Date().toISOString()
        }
      });

      if (error) {
        console.error('Failed to send to Google Sheets:', error);
      } else {
        console.log('Data sent to Google Sheets successfully');
      }
    } catch (error) {
      console.error('Failed to send to Google Sheets:', error);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      let photoUrl: string | null = null;

      if (selectedFile) {
        photoUrl = await uploadPhoto(selectedFile);
      }

      const { error } = await supabase
        .from('damage_reports')
        .insert({
          reporter_name: data.reporter_name,
          damage_description: data.damage_description,
          location: data.location,
          damage_type: data.damage_type,
          photo_url: photoUrl
        });

      if (error) throw error;

      // Send to Google Sheets in background
      sendToGoogleSheets(data, photoUrl);

      toast({
        title: 'Laporan Terkirim',
        description: 'Terima kasih, laporan kerusakan Anda telah berhasil dikirim.',
      });

      form.reset();
      removeFile();
      onSuccess?.();

    } catch (error: any) {
      toast({
        title: 'Gagal Mengirim',
        description: error.message || 'Terjadi kesalahan saat mengirim laporan',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="reporter_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground font-medium">Nama Pelapor</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Masukkan nama lengkap Anda" 
                  {...field} 
                  className="bg-background"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="damage_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground font-medium">Deskripsi Kerusakan</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Jelaskan detail kerusakan yang terjadi..."
                  className="min-h-[120px] bg-background resize-none"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground font-medium">Lokasi Kerusakan</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih lokasi kerusakan" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LOCATIONS.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="damage_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground font-medium">Jenis Kerusakan</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih jenis kerusakan" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DAMAGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Foto Kerusakan (Opsional)</label>
          
          {!selectedFile ? (
            <div 
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Klik untuk mengunggah foto
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WebP (Maks. 5MB)
              </p>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img 
                src={previewUrl!} 
                alt="Preview" 
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={removeFile}
                className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 text-base font-medium"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Mengirim Laporan...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Kirim Laporan
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};