import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Settings, School, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const getNavigationItems = (userRole: string | undefined) => {
  // Super Admin: Only manage schools and see dashboard
  if (userRole === "super_admin") {
    return [
      { path: "/", icon: "fas fa-tachometer-alt", label: "Dashboard" },
      { path: "/schools", icon: "fas fa-building", label: "Schools" },
    ];
  }

  // School Admin: Manage day-to-day school operations
  if (userRole === "admin") {
    return [
      { path: "/", icon: "fas fa-tachometer-alt", label: "Dashboard" },
      { path: "/timetable", icon: "fas fa-calendar-alt", label: "Timetables" },
      { path: "/teachers", icon: "fas fa-chalkboard-teacher", label: "Teachers" },
      { path: "/teacher-schedule", icon: "fas fa-calendar-check", label: "Teacher Schedule" },
      { path: "/classes", icon: "fas fa-users", label: "Classes" },
      { path: "/timetable-structure", icon: "fas fa-clock", label: "Time Table Structure" },
    ];
  }

  // Default fallback
  return [
    { path: "/", icon: "fas fa-tachometer-alt", label: "Dashboard" },
  ];
};

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const navigationItems = getNavigationItems(user?.role);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Shield className="h-4 w-4" />;
      case "admin":
        return <School className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex-shrink-0">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-graduation-cap text-primary-foreground"></i>
          </div>
          <div>
            <h1 className="font-bold text-lg">Chrona</h1>
            <p className="text-xs text-muted-foreground">Smart Timetable Management</p>
          </div>
        </div>
        
        {/* User info */}
        {user && (
          <div className="mt-4 p-3 bg-accent/50 rounded-lg">
            <div className="flex items-center space-x-2">
              {getRoleIcon(user.role)}
              <p className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {user.role.replace('_', ' ')}
            </p>
            {user.role !== "super_admin" && user.schoolId && (
              <p className="text-xs text-muted-foreground">
                School ID: {user.schoolId}
              </p>
            )}
          </div>
        )}
      </div>
      
      <nav className="px-4 pb-6">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <div
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg mb-1 transition-colors cursor-pointer",
                location === item.path
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <i className={`${item.icon} w-5`}></i>
              <span>{item.label}</span>
            </div>
          </Link>
        ))}
        
        <div className="mt-8 pt-4 border-t border-border">
          <Link href="/settings">
            <Button
              variant="ghost"
              className="w-full justify-start px-3 py-2 mb-1"
              data-testid="nav-settings"
            >
              <Settings className="h-4 w-4 mr-3" />
              <span>Settings</span>
            </Button>
          </Link>
          
          <Button
            variant="ghost"
            className="w-full justify-start px-3 py-2 mb-1 text-destructive hover:text-destructive"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-3" />
            <span>Logout</span>
          </Button>
        </div>
      </nav>
    </aside>
  );
}
