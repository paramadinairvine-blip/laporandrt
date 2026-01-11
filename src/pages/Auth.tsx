import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, LogIn, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().trim().email('Email tidak valid').max(255, 'Email terlalu panjang'),
  password: z.string().min(6, 'Password minimal 6 karakter').max(100, 'Password terlalu panjang'),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama terlalu panjang'),
  email: z.string().trim().email('Email tidak valid').max(255, 'Email terlalu panjang'),
  password: z.string().min(6, 'Password minimal 6 karakter').max(100, 'Password terlalu panjang'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

const Auth = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' }
  });

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  // Check if any users exist to determine if signup should be available
  useEffect(() => {
    const checkUsers = async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      // Show signup only if no users exist (first admin setup)
      setShowSignup(count === 0);
    };
    checkUsers();
  }, []);

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        let message = 'Terjadi kesalahan saat login';
        if (error.message.includes('Invalid login credentials')) {
          message = 'Email atau password salah';
        } else if (error.message.includes('Email not confirmed')) {
          message = 'Email belum dikonfirmasi';
        }
        toast({ title: 'Login Gagal', description: message, variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await signUp(data.email, data.password, data.fullName);
      if (error) {
        let message = 'Terjadi kesalahan saat mendaftar';
        if (error.message.includes('already registered')) {
          message = 'Email sudah terdaftar';
        }
        toast({ title: 'Pendaftaran Gagal', description: message, variant: 'destructive' });
      } else {
        toast({ 
          title: 'Pendaftaran Berhasil', 
          description: 'Akun admin pertama telah dibuat. Silakan login.' 
        });
        signupForm.reset();
        setShowSignup(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4">
        <div className="container mx-auto px-4">
          <Link to="/" className="flex items-center gap-3 w-fit">
            <div className="p-2 bg-primary-foreground/10 rounded-lg">
              <Building2 className="w-6 h-6" />
            </div>
            <span className="font-semibold">Sistem Pelaporan Pesantren</span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
            <CardDescription>
              {showSignup ? 'Buat akun admin pertama untuk memulai' : 'Login untuk mengakses dashboard admin'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showSignup ? (
              // First-time setup: Show signup form
              <Tabs defaultValue="signup" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Daftar Admin</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
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
                        control={loginForm.control}
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
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <LogIn className="w-4 h-4 mr-2" />
                        )}
                        Login
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="signup">
                  <Form {...signupForm}>
                    <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                      <FormField
                        control={signupForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nama Lengkap</FormLabel>
                            <FormControl>
                              <Input placeholder="Nama Admin" {...field} />
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
                              <Input type="email" placeholder="admin@pesantren.id" {...field} />
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
                        Buat Akun Admin
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            ) : (
              // Normal: Show login form only
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
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
                    control={loginForm.control}
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
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4 mr-2" />
                    )}
                    Login
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;