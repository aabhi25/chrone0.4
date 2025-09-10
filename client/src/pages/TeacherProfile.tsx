import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, User, Mail, Phone, IdCard, Calendar as CalendarIcon,
  BookOpen, Users, CheckCircle, XCircle, CalendarDays, Clock,
  FileText, TrendingUp, Activity, UserX, AlertTriangle
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { getCurrentDateIST, formatDateIST } from "@shared/utils/dateUtils";

interface Teacher {
  id: string;
  name: string;
  email: string;
  contactNumber?: string;
  schoolIdNumber?: string;
  isActive: boolean;
  status?: 'active' | 'left_school' | 'on_leave';
  subjects: string[];
  classes: string[];
  maxDailyPeriods: number;
}

interface TeacherAttendance {
  id: string;
  teacherId: string;
  date: string;
  status: "present" | "absent" | "sick_leave" | "personal_leave" | "medical_leave";
  reason?: string;
  leaveStartDate?: string;
  leaveEndDate?: string;
}

interface TimetableEntry {
  id: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  classId: string;
  subject?: { name: string; code: string };
  class?: { grade: string; section: string };
}

interface ClassData {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

interface SubjectData {
  id: string;
  name: string;
  code: string;
}

export default function TeacherProfile() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/teacher/:id");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [selectedReplacement, setSelectedReplacement] = useState<string>('');
  const [replacingTeacher, setReplacingTeacher] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string>('');
  const teacherId = params?.id;

  if (!match || !teacherId) {
    setLocation("/teachers");
    return null;
  }

  // Fetch teacher details
  const { data: teacher, isLoading: teacherLoading } = useQuery<Teacher>({
    queryKey: ["/api/teachers", teacherId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/${teacherId}`);
      return response.json() as Promise<Teacher>;
    },
  });

  // Fetch all classes to map teacher's classes
  const { data: allClasses = [] } = useQuery<ClassData[]>({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/classes");
      return response.json() as Promise<ClassData[]>;
    },
  });

  // Fetch all subjects to map teacher's subjects
  const { data: allSubjects = [] } = useQuery<SubjectData[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subjects");
      return response.json() as Promise<SubjectData[]>;
    },
  });

  // Fetch teacher's schedule
  const { data: schedule = [] } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/teachers", teacherId, "schedule"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/${teacherId}/schedule`);
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: !!teacherId,
  });

  // Fetch teacher's attendance for selected month
  const { data: attendance = [] } = useQuery<TeacherAttendance[]>({
    queryKey: ["/api/teacher-attendance", teacherId, format(selectedDate, "yyyy-MM")],
    queryFn: async () => {
      const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");
      const response = await apiRequest("GET", `/api/teacher-attendance?teacherId=${teacherId}&startDate=${startDate}&endDate=${endDate}`);
      return response.json() as Promise<TeacherAttendance[]>;
    },
    enabled: !!teacherId,
  });

  // Fetch available teachers for replacement
  const { data: availableTeachers = [], refetch: refetchAvailableTeachers } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers/available-for-replacement", teacherId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/available-for-replacement/${teacherId}`);
      return response.json() as Promise<Teacher[]>;
    },
    enabled: !!teacherId && replaceDialogOpen,
  });

  // Get teacher's classes and subjects details
  const teacherClasses = teacher?.classes?.map(classId => 
    allClasses.find(c => c.id === classId)
  ).filter(Boolean) || [];

  const teacherSubjects = teacher?.subjects?.map(subjectId => 
    allSubjects.find(s => s.id === subjectId)
  ).filter(Boolean) || [];

  // Calculate attendance statistics
  const presentDays = attendance.filter(a => a.status === "present").length;
  const absentDays = attendance.filter(a => a.status === "absent").length;
  const leaveDays = attendance.filter(a => a.status !== "present" && a.status !== "absent").length;
  const totalRecords = attendance.length;
  const attendancePercentage = totalRecords > 0 ? Math.round((presentDays / totalRecords) * 100) : 100;

  // Group schedule by day
  const scheduleByDay = schedule.reduce((acc, entry) => {
    if (!acc[entry.day]) acc[entry.day] = [];
    acc[entry.day].push(entry);
    return acc;
  }, {} as Record<string, TimetableEntry[]>);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge variant="default" className="bg-green-100 text-green-800">Present</Badge>;
      case "absent":
        return <Badge variant="destructive">Absent</Badge>;
      case "sick_leave":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Sick Leave</Badge>;
      case "personal_leave":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Personal Leave</Badge>;
      case "medical_leave":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Medical Leave</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleReplaceTeacher = async () => {
    if (!selectedReplacement || !teacherId) return;

    setReplacingTeacher(true);
    setConflictWarning('');

    try {
      const response = await apiRequest("POST", "/api/teachers/replace", {
        originalTeacherId: teacherId,
        replacementTeacherId: selectedReplacement,
        reason: "Teacher replacement through profile"
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.conflicts && errorData.conflicts.length > 0) {
          setConflictWarning(`Warning: ${errorData.conflicts.length} scheduling conflicts detected.`);
          return;
        }
        throw new Error(errorData.message || "Failed to replace teacher");
      }

      const result = await response.json();
      setReplaceDialogOpen(false);
      setSelectedReplacement('');
      
      // Refresh teacher data
      window.location.reload();
    } catch (error) {
      console.error("Error replacing teacher:", error);
      setConflictWarning(error instanceof Error ? error.message : "Failed to replace teacher");
    } finally {
      setReplacingTeacher(false);
    }
  };

  const getTeacherStatusBadge = (teacher: Teacher) => {
    if (teacher.status === 'left_school') {
      return <Badge variant="destructive" className="ml-2">Left School</Badge>;
    } else if (teacher.status === 'on_leave') {
      return <Badge variant="secondary" className="ml-2">On Leave</Badge>;
    } else if (!teacher.isActive) {
      return <Badge variant="outline" className="ml-2">Inactive</Badge>;
    }
    return <Badge variant="default" className="ml-2 bg-green-100 text-green-800">Active</Badge>;
  };

  if (teacherLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Teacher Not Found</h2>
          <p className="text-gray-600 mt-2">The requested teacher profile could not be found.</p>
          <Button onClick={() => setLocation("/teachers")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Teachers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/teachers")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Teachers</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{teacher.name}</h1>
            <p className="text-gray-600">Teacher Profile & Details</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={teacher.isActive ? "default" : "secondary"}>
            {teacher.isActive ? "Active" : "Inactive"}
          </Badge>
          {getTeacherStatusBadge(teacher)}
          
          {/* Replace Teacher Button */}
          <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                className="flex items-center space-x-2"
                onClick={() => {
                  setSelectedReplacement('');
                  setConflictWarning('');
                  refetchAvailableTeachers();
                }}
              >
                <UserX className="h-4 w-4" />
                <span>Replace Teacher</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <UserX className="h-5 w-5 text-red-600" />
                  <span>Replace Teacher</span>
                </DialogTitle>
                <DialogDescription>
                  Select a replacement teacher for {teacher.name}. This will transfer all their timetable assignments.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Replacement Teacher</label>
                  <Select value={selectedReplacement} onValueChange={setSelectedReplacement}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a replacement teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{teacher.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({teacher.email})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {conflictWarning && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      {conflictWarning}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex space-x-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReplaceDialogOpen(false);
                      setSelectedReplacement('');
                      setConflictWarning('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReplaceTeacher}
                    disabled={!selectedReplacement || replacingTeacher}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {replacingTeacher ? "Replacing..." : "Replace Teacher"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal Information */}
        <div className="space-y-6">
          {/* Personal Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Personal Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{teacher.email}</p>
                </div>
              </div>
              
              {teacher.contactNumber && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Contact Number</p>
                    <p className="text-sm text-muted-foreground">{teacher.contactNumber}</p>
                  </div>
                </div>
              )}
              
              {teacher.schoolIdNumber && (
                <div className="flex items-center space-x-3">
                  <IdCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">School ID</p>
                    <p className="text-sm text-muted-foreground">{teacher.schoolIdNumber}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Max Daily Periods</p>
                  <p className="text-sm text-muted-foreground">{teacher.maxDailyPeriods} periods/day</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Attendance Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-green-600">{attendancePercentage}%</div>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center mb-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-lg font-semibold text-green-600">{presentDays}</div>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                
                <div>
                  <div className="flex items-center justify-center mb-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="text-lg font-semibold text-red-600">{absentDays}</div>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
                
                <div>
                  <div className="flex items-center justify-center mb-1">
                    <CalendarDays className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="text-lg font-semibold text-orange-600">{leaveDays}</div>
                  <p className="text-xs text-muted-foreground">On Leave</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Classes and Subjects */}
        <div className="space-y-6">
          {/* Classes Taught */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Classes Taught</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teacherClasses.length > 0 ? (
                <div className="space-y-3">
                  {teacherClasses.map((classData) => (
                    <div key={classData?.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <div className="font-medium">Class {classData?.grade}{classData?.section}</div>
                        <div className="text-sm text-muted-foreground">{classData?.studentCount} students</div>
                      </div>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No classes assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Subjects Taught */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Subjects Taught</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teacherSubjects.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {teacherSubjects.map((subject) => (
                    <div key={subject?.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <div className="font-medium">{subject?.name}</div>
                        <div className="text-sm text-muted-foreground">Code: {subject?.code}</div>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">Subject</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No subjects assigned</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Schedule and Attendance History */}
        <div className="space-y-6">
          {/* Weekly Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5" />
                <span>Weekly Schedule</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(scheduleByDay).length > 0 ? (
                <div className="space-y-3">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day => (
                    <div key={day}>
                      <div className="font-medium text-sm capitalize mb-2">{day}</div>
                      <div className="space-y-1">
                        {scheduleByDay[day]?.map((entry) => (
                          <div key={entry.id} className="text-xs p-2 bg-muted/30 rounded flex justify-between">
                            <span>Period {entry.period}</span>
                            <span>{entry.subject?.name || 'Subject'}</span>
                          </div>
                        )) || (
                          <div className="text-xs text-muted-foreground p-2">No classes</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No schedule available</p>
              )}
            </CardContent>
          </Card>

          {/* Attendance History with Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Attendance History</span>
                </div>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {format(selectedDate, "MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setCalendarOpen(false);
                        }
                      }}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {attendance
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <div>
                        <div className="text-sm font-medium">
                          {formatDateIST(record.date, { month: 'short', day: 'numeric' })}
                        </div>
                        {record.reason && (
                          <div className="text-xs text-muted-foreground">{record.reason}</div>
                        )}
                      </div>
                      {getStatusBadge(record.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No attendance records for {format(selectedDate, "MMMM yyyy")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}