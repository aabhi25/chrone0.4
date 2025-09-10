import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import TimetableView from "@/pages/TimetableView";
import TeacherView from "@/pages/TeacherView";
import ClassesPage from "@/pages/ClassesPage";
import ClassDetailPage from "@/pages/ClassDetailPage";
import SubjectsPage from "@/pages/SubjectsPage";
import SchoolsPage from "@/pages/SchoolsPage";
import SettingsPage from "@/pages/SettingsPage";
import TimetableStructurePage from "@/pages/TimetableStructurePage";
import TeacherSchedulePage from "@/pages/TeacherSchedulePage";
import TeacherProfile from "@/pages/TeacherProfile";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const isSuperAdmin = user?.role === "super_admin";
  const isSchoolAdmin = user?.role === "admin";

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        
        {/* Super Admin only pages */}
        {isSuperAdmin && <Route path="/schools" component={SchoolsPage} />}
        
        {/* School Admin only pages */}
        {isSchoolAdmin && <Route path="/classes" component={ClassesPage} />}
        {isSchoolAdmin && <Route path="/classes/:id" component={ClassDetailPage} />}
        {isSchoolAdmin && <Route path="/subjects" component={SubjectsPage} />}
        {isSchoolAdmin && <Route path="/timetable" component={TimetableView} />}
        {isSchoolAdmin && <Route path="/teachers" component={TeacherView} />}
        {isSchoolAdmin && <Route path="/teacher/:id" component={TeacherProfile} />}
        {isSchoolAdmin && <Route path="/teacher-schedule" component={TeacherSchedulePage} />}
        {isSchoolAdmin && <Route path="/timetable-structure" component={TimetableStructurePage} />}
        
        {/* Settings page - available to all authenticated users */}
        <Route path="/settings" component={SettingsPage} />
        
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
