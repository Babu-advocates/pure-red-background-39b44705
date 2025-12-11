import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import legalIllustration from "@/assets/legal-illustration.png";
const authSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100),
  password: z.string().trim().min(1, "Password is required").max(100)
});
type AuthFormValues = z.infer<typeof authSchema>;
const Auth = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const loginForm = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });
  useEffect(() => {
    // Check if admin is already logged in
    const adminLoggedIn = localStorage.getItem('adminLoggedIn');
    if (adminLoggedIn) {
      navigate("/admin-techverse");
    }
  }, [navigate]);
  const handleLogin = async (values: AuthFormValues) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('admin_login')
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
        // Store admin login session
        localStorage.setItem('adminLoggedIn', values.username);
        
        toast({
          title: "Success",
          description: "Logged in successfully"
        });
        navigate("/admin-techverse");
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
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Button 
        variant="outline" 
        onClick={() => navigate("/templates")}
        className="absolute top-6 left-6 animate-fade-in hover-scale"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Button>

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Illustration */}
        <div className="hidden lg:flex items-center justify-center animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          <img 
            src={legalIllustration} 
            alt="Legal Document Management" 
            className="w-full max-w-lg object-contain hover:scale-105 transition-transform duration-500"
          />
        </div>

        {/* Right side - Login Form */}
        <div className="w-full max-w-md mx-auto animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-6 flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/templates")}
                className="text-white hover:bg-white/10 hover-scale"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="text-xl font-semibold text-white">Admin Login</h1>
            </div>

            {/* Form Content */}
            <div className="p-8">
              <div className="text-center mb-8 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h2>
                <p className="text-slate-600">Sign in to your account</p>
              </div>

              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
                  <div className="animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
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
                              className="h-12 bg-slate-50 border-slate-200 transition-all duration-200 focus:scale-[1.02]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                  </div>
                  
                  <div className="animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
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
                                className="h-12 bg-slate-50 border-slate-200 pr-12 transition-all duration-200 focus:scale-[1.02]"
                                {...field} 
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-200 hover:scale-110"
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                  </div>
                  
                  <div className="animate-fade-in" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white font-semibold text-base hover-scale transition-all duration-300"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default Auth;