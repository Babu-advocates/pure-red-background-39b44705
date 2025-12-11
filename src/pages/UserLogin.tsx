import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import legalIllustration from "@/assets/legal-illustration.png";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100),
  password: z.string().trim().min(1, "Password is required").max(100)
});

type LoginFormValues = z.infer<typeof loginSchema>;

const UserLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  useEffect(() => {
    // Check if user is already logged in
    const user = localStorage.getItem('userLoggedIn');
    if (user) {
      navigate("/templates");
    }
  }, [navigate]);

  const handleLogin = async (values: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('main_login')
        .select('*')
        .eq('username', values.username)
        .eq('password', values.password)
        .maybeSingle();
      
      if (error || !data) {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: "Invalid username or password"
        });
      } else {
        // Store login session; used across the app
        localStorage.setItem('userLoggedIn', values.username);
        // Cleanup old keys if present
        localStorage.removeItem('isLoggedIn');
        localStorage.setItem('username', values.username);
        
        toast({
          title: "Success",
          description: "Logged in successfully"
        });
        navigate("/templates");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "An error occurred during login"
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <img 
            src={legalIllustration} 
            alt="Legal Document Management" 
            className="w-full max-w-lg object-contain"
          />
        </div>

        {/* Right side - Login Form */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-6 flex items-center justify-center">
              <h1 className="text-xl font-semibold text-white">Login</h1>
            </div>

            {/* Form Content */}
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h2>
                <p className="text-slate-600">Sign in to your account</p>
              </div>

              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
                  <FormField 
                    control={loginForm.control} 
                    name="username" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700">Username</FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            placeholder="Enter your username"
                            className="h-12 bg-slate-50 border-slate-200"
                            {...field} 
                          />
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
                        <FormLabel className="text-slate-700">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              className="h-12 bg-slate-50 border-slate-200 pr-12"
                              {...field} 
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} 
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white font-semibold text-base"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLogin;
