import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, School, Calendar, Users, Shield, Info } from "lucide-react";
import { useLocation } from "wouter";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loginMutation, user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect based on user role after successful login
  useEffect(() => {
    if (isAuthenticated && user) {
      // Ensure school admins always go to dashboard
      if (user.role === "admin") {
        setLocation("/");
      } else if (user.role === "super_admin") {
        setLocation("/");
      } else {
        // Default fallback to dashboard
        setLocation("/");
      }
    }
  }, [isAuthenticated, user, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <School className="h-8 w-8 text-primary mr-2" />
              <span className="text-2xl font-bold">Chrona</span>
            </div>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your timetable management account
            </CardDescription>
            
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-login">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Hero Section */}
      <div className="flex-1 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center p-8">
        <div className="max-w-lg text-center space-y-6">
          <h1 className="text-4xl font-bold text-foreground">
            Smart Timetable Management
          </h1>
          <p className="text-xl text-muted-foreground">
            Streamline your school's scheduling with AI-powered optimization, 
            multi-role access, and comprehensive management tools.
          </p>
          
          <div className="grid grid-cols-1 gap-4 mt-8">
            <div className="flex items-center space-x-3 p-4 bg-background/50 rounded-lg backdrop-blur-sm">
              <Calendar className="h-8 w-8 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold">AI-Powered Scheduling</h3>
                <p className="text-sm text-muted-foreground">
                  Generate optimal timetables automatically
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-background/50 rounded-lg backdrop-blur-sm">
              <Users className="h-8 w-8 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold">Multi-Role Access</h3>
                <p className="text-sm text-muted-foreground">
                  Administrators, teachers, students & parents
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-background/50 rounded-lg backdrop-blur-sm">
              <School className="h-8 w-8 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold">Multi-School Support</h3>
                <p className="text-sm text-muted-foreground">
                  Manage multiple schools from one platform
                </p>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}