import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { 
  School, Users, Activity, Shield, CheckCircle, XCircle, CalendarDays, Clock,
  UserPlus, Calendar, Eye, ClipboardCheck, Search, AlertTriangle,
  UserCog, TrendingUp, PieChart, User, BookOpen
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { getCurrentDateIST, formatDateIST } from "@shared/utils/dateUtils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState, useMemo, useRef, useEffect } from "react";
import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";

interface AdminDashboardStats {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  schoolAdminLogins: Array<{
    schoolName: string;
    adminName: string;
    lastLogin: Date | null;
  }>;
  schoolTeacherCounts: Array<{
    schoolName: string;
    activeTeachers: number;
  }>;
}

interface SchoolInfo {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  adminName: string;
  isActive: boolean;
  totalTeachers: number;
}

interface TeacherAttendance {
  id: string;
  teacherId: string;
  date: string;
  status: "present" | "absent" | "sick_leave" | "personal_leave" | "medical_leave";
  leaveStartDate?: string;
  leaveEndDate?: string;
  reason?: string;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  subjects?: string[];
}

interface TimetableAlert {
  teacher: Teacher;
  attendance: TeacherAttendance;
  affectedClasses: number;
}

interface ClassData {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

interface SearchResult {
  id: string;
  name: string;
  type: 'teacher' | 'class';
  subtitle?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const isSuperAdmin = user?.role === "super_admin";
  const isSchoolAdmin = user?.role === "admin";
  
  const { data: adminStats, isLoading: adminStatsLoading } = useQuery<AdminDashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
    enabled: isSuperAdmin,
  });

  // Calculate today's date
  const today = getCurrentDateIST();

  const { data: schoolInfo, isLoading: schoolInfoLoading } = useQuery<SchoolInfo>({
    queryKey: ["/api/school-info"],
    enabled: isSchoolAdmin,
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers"],
    enabled: isSchoolAdmin,
  });

  // Fetch classes for search functionality
  const { data: classes = [] } = useQuery<ClassData[]>({
    queryKey: ["/api/classes"],
    enabled: isSchoolAdmin,
  });

  const { data: timetableStructure } = useQuery({
    queryKey: ["/api/timetable-structure"],
    enabled: isSchoolAdmin,
  });

  const { data: todayAttendance = [] } = useQuery<TeacherAttendance[]>({
    queryKey: ["/api/teacher-attendance", today],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teacher-attendance?date=${today}`);
      return response.json() as Promise<TeacherAttendance[]>;
    },
    enabled: isSchoolAdmin,
  });

  // Fetch pending timetable changes for real-time notifications
  const { data: pendingTimetableChanges = [] } = useQuery<any[]>({
    queryKey: ["/api/timetable-changes/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/timetable-changes/active`);
      return response.json() as Promise<any[]>;
    },
    enabled: isSchoolAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });
  
  // Check if today is an active school day
  const todayDayName = format(new Date(), 'EEEE').toLowerCase(); // Gets day name like 'monday'
  const isActiveDay = (timetableStructure as any)?.workingDays?.includes(todayDayName) || false;

  // Use the same logic as TeacherView - check each teacher's status
  const getTeacherAttendanceStatus = (teacherId: string) => {
    // Only calculate attendance for active days
    if (!isActiveDay) return "not_applicable";
    
    const attendance = todayAttendance.find(
      (att) => att.teacherId === teacherId
    );
    return attendance?.status || "present";
  };

  // Calculate attendance counts only for active days
  const presentTeachers = isActiveDay ? teachers.filter(teacher => getTeacherAttendanceStatus(teacher.id) === "present") : [];
  const absentTeachers = isActiveDay ? teachers.filter(teacher => getTeacherAttendanceStatus(teacher.id) === "absent") : [];
  const onLeaveTeachers = isActiveDay ? teachers.filter(teacher => {
    const status = getTeacherAttendanceStatus(teacher.id);
    return status !== "present" && status !== "absent";
  }) : [];
  
  // Count teachers with no attendance marked today
  const teachersWithAttendance = new Set(todayAttendance.map(r => r.teacherId));
  const teachersWithoutAttendance = teachers.filter(t => !teachersWithAttendance.has(t.id));

  // Prepare data for attendance pie chart
  const attendanceChartData = isActiveDay ? [
    { name: 'Present', value: presentTeachers.length, color: '#22c55e' },
    { name: 'Absent', value: absentTeachers.length, color: '#ef4444' },
    { name: 'On Leave', value: onLeaveTeachers.length, color: '#f97316' }
  ].filter(item => item.value > 0) : [];

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !isSchoolAdmin) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];
    
    // Search teachers
    teachers.forEach(teacher => {
      if (teacher.name.toLowerCase().includes(query) || 
          teacher.email?.toLowerCase().includes(query)) {
        results.push({
          id: teacher.id,
          name: teacher.name,
          type: 'teacher',
          subtitle: teacher.email || 'Teacher'
        });
      }
    });
    
    // Search classes
    classes.forEach(classItem => {
      const className = `Class ${classItem.grade}${classItem.section}`;
      if (className.toLowerCase().includes(query) ||
          classItem.grade.toLowerCase().includes(query) ||
          (classItem.section && classItem.section.toLowerCase().includes(query))) {
        results.push({
          id: classItem.id,
          name: className,
          type: 'class',
          subtitle: `${classItem.studentCount} students`
        });
      }
    });
    
    return results.slice(0, 8); // Limit to 8 results
  }, [searchQuery, teachers, classes, isSchoolAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search result click
  const handleSearchResultClick = (result: SearchResult) => {
    if (result.type === 'teacher') {
      setLocation(`/teacher/${result.id}`);
    } else if (result.type === 'class') {
      setLocation(`/classes/${result.id}`);
    }
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSearchDropdown(value.trim().length > 0);
  };

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add-teacher':
        setLocation('/teachers?action=add');
        break;
      case 'show-timetable':
        setLocation('/timetable');
        break;
      case 'teacher-schedule':
        setLocation('/teacher-schedule');
        break;
      case 'mark-attendance':
        setLocation('/teachers?tab=attendance');
        break;
      case 'assign-substitute':
        setLocation('/timetable?action=substitute');
        break;
    }
  };

  // Get teachers currently on leave with date ranges
  const teachersOnLeave = todayAttendance.filter(record => 
    record.status !== "present" && record.leaveStartDate && record.leaveEndDate &&
    record.leaveStartDate <= today && today <= record.leaveEndDate
  ).reduce((acc: Array<{
    teacherId: string;
    teacherName: string;
    startDate: string;
    endDate: string;
    status: string;
    reason?: string;
  }>, record) => {
    const teacher = teachers.find(t => t.id === record.teacherId);
    if (teacher && !acc.find(t => t.teacherId === record.teacherId)) {
      acc.push({
        teacherId: record.teacherId,
        teacherName: teacher.name,
        startDate: record.leaveStartDate!,
        endDate: record.leaveEndDate!,
        status: record.status,
        reason: record.reason
      });
    }
    return acc;
  }, []);

  return (
    <div>
      {/* Enhanced Header with Search and Notifications */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* School Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <School className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">
                  {isSuperAdmin ? "Super Admin Dashboard" : "School Admin Dashboard"}
                </h2>
                <div className="text-muted-foreground flex items-center space-x-2">
                  <span>{isSuperAdmin ? "School Management Overview" : schoolInfo?.name || "School Management"}</span>
                  {isSchoolAdmin && schoolInfo?.name && (
                    <Badge variant="outline" className="text-xs">
                      {teachers.length} Teachers
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Search Bar and User Profile */}
          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <div className="relative" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teachers, classes..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
                className="pl-10 w-64"
              />
              
              {/* Search Results Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {searchResults.map((result) => (
                    <div
                      key={`${result.type}-${result.id}`}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => handleSearchResultClick(result)}
                    >
                      <div className="mr-3 p-2 rounded-full bg-gray-100">
                        {result.type === 'teacher' ? (
                          <User className="h-4 w-4 text-blue-600" />
                        ) : (
                          <BookOpen className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">
                          {result.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.subtitle}
                        </div>
                      </div>
                      <div className="ml-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            result.type === 'teacher' 
                              ? 'border-blue-200 text-blue-700' 
                              : 'border-green-200 text-green-700'
                          }`}
                        >
                          {result.type === 'teacher' ? 'Teacher' : 'Class'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {/* No results state */}
                  {searchQuery.trim() && searchResults.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No teachers or classes found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
            
            
            {/* Admin Profile Card */}
            <div className="flex items-center space-x-3 bg-muted/50 rounded-lg px-3 py-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground capitalize flex items-center space-x-1">
                  <UserCog className="h-3 w-3" />
                  <span>{user?.role?.replace('_', ' ')}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <div className="p-6 overflow-y-auto h-full">
        {isSuperAdmin ? (
          <>
            {/* Super Admin Content */}
            {/* School Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {adminStatsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
                  <School className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{adminStats?.totalSchools ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Schools registered</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Schools</CardTitle>
                  <Activity className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{adminStats?.activeSchools ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Currently operational</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Inactive Schools</CardTitle>
                  <Users className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{adminStats?.inactiveSchools ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Need attention</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
        
        {/* School Admin Activity & Teacher Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* School Admin Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>School Admin Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminStatsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4" data-testid="admin-activity-list">
                  {adminStats?.schoolAdminLogins?.map((admin, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{admin.schoolName}</p>
                        <p className="text-xs text-muted-foreground">{admin.adminName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {admin.lastLogin 
                            ? formatDistanceToNow(new Date(admin.lastLogin), { addSuffix: true })
                            : 'Never'
                          }
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-muted-foreground">No school admins found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Teacher Counts by School */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <School className="h-5 w-5" />
                <span>Active Teachers by School</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminStatsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4" data-testid="teacher-counts-list">
                  {adminStats?.schoolTeacherCounts?.map((school, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{school.schoolName}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {school.activeTeachers} teachers
                        </span>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-muted-foreground">No schools found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </>
        ) : (
          <>
            {/* Modern School Admin Dashboard */}
            <div className="space-y-8">
              
              {/* TOP ROW: Key Metrics with Visuals */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Teachers Card */}
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-blue-800">Total Teachers</CardTitle>
                    <Users className="h-5 w-5 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-900">{teachers.length}</div>
                    <div className="flex items-center mt-2 space-x-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-700">Registered in system</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Present Teachers Card */}
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-green-800">Present Today</CardTitle>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-900">
                      {isActiveDay ? presentTeachers.length : "—"}
                    </div>
                    <div className="flex items-center mt-2 space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-700">
                        {isActiveDay ? "In school today" : "School closed"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Absent Teachers Card */}
                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-red-800">Absent Today</CardTitle>
                    <XCircle className="h-5 w-5 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-900">
                      {isActiveDay ? absentTeachers.length : "—"}
                    </div>
                    <div className="flex items-center mt-2 space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-red-700">
                        {isActiveDay ? "Need substitutes" : "No tracking"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Teachers on Leave Card */}
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-orange-800">On Leave</CardTitle>
                    <CalendarDays className="h-5 w-5 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-900">{onLeaveTeachers.length}</div>
                    <div className="flex items-center mt-2 space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-sm text-orange-700">Various leave types</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* MIDDLE ROW: Quick Actions Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span>Quick Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Button 
                      onClick={() => handleQuickAction('show-timetable')}
                      className="h-20 flex flex-col items-center justify-center space-y-2 bg-green-600 hover:bg-green-700"
                    >
                      <Calendar className="h-6 w-6" />
                      <span className="text-sm font-medium">Show Timetable</span>
                    </Button>
                    
                    <Button 
                      onClick={() => handleQuickAction('mark-attendance')}
                      className="h-20 flex flex-col items-center justify-center space-y-2 bg-orange-600 hover:bg-orange-700"
                    >
                      <ClipboardCheck className="h-6 w-6" />
                      <span className="text-sm font-medium">Mark Attendance</span>
                    </Button>
                    
                    <Button 
                      onClick={() => handleQuickAction('teacher-schedule')}
                      className="h-20 flex flex-col items-center justify-center space-y-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Eye className="h-6 w-6" />
                      <span className="text-sm font-medium">Teacher Schedule</span>
                    </Button>
                    
                    <Button 
                      onClick={() => handleQuickAction('assign-substitute')}
                      className="h-20 flex flex-col items-center justify-center space-y-2 bg-red-600 hover:bg-red-700"
                      disabled={!pendingTimetableChanges.length}
                    >
                      <AlertTriangle className="h-6 w-6" />
                      <span className="text-sm font-medium">Assign Substitute</span>
                    </Button>
                    
                    <Button 
                      onClick={() => handleQuickAction('add-teacher')}
                      className="h-20 flex flex-col items-center justify-center space-y-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <UserPlus className="h-6 w-6" />
                      <span className="text-sm font-medium">Add Teacher</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* BOTTOM ROW: Alerts, Charts, and School Info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Timetable Alerts - Only show if there are pending changes */}
                {pendingTimetableChanges.length > 0 && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span>Timetable Alerts</span>
                        <Badge variant="destructive">{pendingTimetableChanges.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {pendingTimetableChanges.slice(0, 3).map((change, index) => (
                          <Alert key={index} className="border-red-200 bg-red-50">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription>
                              <div className="flex items-center justify-between">
                                <div>
                                  <strong className="text-red-800">Pending timetable change</strong> requires attention.
                                  <span className="text-red-700"> Please review and assign substitute teachers.</span>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleQuickAction('assign-substitute')}
                                  className="ml-4"
                                >
                                  Assign Substitute
                                </Button>
                              </div>
                            </AlertDescription>
                          </Alert>
                        ))}
                        {pendingTimetableChanges.length > 3 && (
                          <div className="text-sm text-muted-foreground text-center pt-2">
                            +{pendingTimetableChanges.length - 3} more pending changes
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Attendance Chart and School Info */}
                <div className={`space-y-6 ${pendingTimetableChanges.length > 0 ? '' : 'lg:col-span-3'}`}>
                  {/* Attendance Pie Chart */}
                  {isActiveDay && attendanceChartData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <PieChart className="h-5 w-5 text-primary" />
                          <span>Attendance Overview</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                              <Pie
                                data={attendanceChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {attendanceChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number, name: string) => [value, name]}
                                labelStyle={{ color: '#374151' }}
                              />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-1 gap-2 mt-4">
                          {attendanceChartData.map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: item.color }}
                                ></div>
                                <span className="text-sm">{item.name}</span>
                              </div>
                              <span className="text-sm font-medium">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* School Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <School className="h-5 w-5 text-primary" />
                        <span>School Information</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {schoolInfoLoading ? (
                        <Skeleton className="h-20" />
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <div className="text-lg font-semibold">{schoolInfo?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {schoolInfo?.address || "Address not provided"}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-sm text-muted-foreground">Contact:</div>
                            <div className="text-sm font-medium">{schoolInfo?.contactPhone}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-sm text-muted-foreground">Today:</div>
                            <Badge variant={isActiveDay ? "default" : "secondary"}>
                              {isActiveDay ? "School Day" : "Holiday"}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
