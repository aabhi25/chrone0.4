import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTeacherSchema, insertTeacherAttendanceSchema, bulkAttendanceSchema, type Teacher, type TimetableEntry, type TeacherAttendance } from "@shared/schema";
import { getCurrentDateIST, formatDateIST } from "@shared/utils/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, User, Users, Mail, Phone, IdCard, Calendar, CalendarDays, Clock, CheckCircle, XCircle, BookOpen } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import { z } from "zod";

const formSchema = insertTeacherSchema.extend({
  name: z.string().min(1, "Teacher name is required"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  contactNumber: z.string().min(1, "Contact number is required"),
  schoolIdNumber: z.string().min(1, "School ID number is required"),
  classes: z.array(z.string()).min(1, "Please select at least one class"),
  subjects: z.array(z.string()).min(1, "Please select at least one subject"),
}).omit({ availability: true, maxLoad: true });

type TeacherFormData = z.infer<typeof formSchema>;

export default function TeacherView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  // Initialize active tab based on URL parameter
  const getInitialTab = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    return tabParam === 'attendance' ? 'attendance' : 'teachers';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [isBulkAttendanceOpen, setIsBulkAttendanceOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getCurrentDateIST());

  // Check URL parameters to set active tab when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'attendance') {
      setActiveTab('attendance');
    } else {
      setActiveTab('teachers');
    }
  }, [location]);

  const addForm = useForm<TeacherFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      contactNumber: "",
      schoolIdNumber: "",
      schoolId: user?.schoolId || "",
      isActive: true,
      classes: [],
      subjects: [],
    },
  });

  const editForm = useForm<TeacherFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      contactNumber: "",
      schoolIdNumber: "",
      schoolId: user?.schoolId || "",
      isActive: true,
      classes: [],
      subjects: [],
    },
  });

  const bulkAttendanceForm = useForm({
    resolver: zodResolver(bulkAttendanceSchema),
    defaultValues: {
      teacherId: "",
      status: "absent" as const,
      reason: "",
      startDate: getCurrentDateIST(),
      endDate: getCurrentDateIST(),
      isFullDay: true,
    },
  });

  // Force refresh of class-subject assignments when component mounts
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/class-subject-assignments"] });
  }, []);

  // Helper function to get subjects for selected classes
  const getSubjectsForClasses = (selectedClassIds: string[]) => {
    const relevantAssignments = classSubjectAssignments.filter((assignment: any) => 
      selectedClassIds.includes(assignment.classId)
    );
    
    // Group subjects by grade level to avoid duplicates across sections
    const subjectGradeMap = new Map<string, any>();
    
    relevantAssignments.forEach((assignment: any) => {
      const subject = subjects.find((s: any) => s.id === assignment.subjectId);
      const classData = classes.find((c: any) => c.id === assignment.classId);
      
      if (subject && classData) {
        const gradeSubjectKey = `${classData.grade}-${assignment.subjectId}`;
        
        if (!subjectGradeMap.has(gradeSubjectKey)) {
          subjectGradeMap.set(gradeSubjectKey, {
            id: assignment.subjectId,
            name: subject.name,
            grade: classData.grade,
            subjectName: subject.name,
            displayName: `Class ${classData.grade} - ${subject.name}`
          });
        }
      }
    });
    
    // Convert map to array and sort by grade then by subject name
    return Array.from(subjectGradeMap.values()).sort((a: any, b: any) => {
      // First sort by grade (using numeric comparison)
      const gradeComparison = a.grade.localeCompare(b.grade, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
      
      // If grades are the same, sort by subject name
      if (gradeComparison === 0) {
        return a.subjectName.localeCompare(b.subjectName);
      }
      
      return gradeComparison;
    });
  };

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["/api/teachers", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers?schoolId=${user?.schoolId}`);
      return response.json() as Promise<Teacher[]>;
    },
    enabled: !!user?.schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subjects");
      return response.json();
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/classes");
      return response.json();
    },
  });

  const { data: classSubjectAssignments = [] } = useQuery({
    queryKey: ["/api/class-subject-assignments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/class-subject-assignments");
      return response.json();
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache this data
  });

  const { data: timetableStructure } = useQuery({
    queryKey: ["/api/timetable-structure"],
    enabled: !!user?.schoolId,
  });

  // Query for timetable entries
  const { data: timetableEntries = [], isLoading: isTimetableLoading } = useQuery({
    queryKey: ["/api/timetable/detailed"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable/detailed");
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: activeTab === "timetable",
  });

  // Query for teacher attendance
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["/api/teacher-attendance", user?.schoolId, selectedDate],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teacher-attendance?date=${selectedDate}`);
      return response.json() as Promise<TeacherAttendance[]>;
    },
    enabled: !!user?.schoolId && activeTab === "attendance",
  });

  // Query for all teachers on leave (with date ranges)
  const { data: allTeachersOnLeave = [] } = useQuery({
    queryKey: ["/api/teacher-attendance/all-leave", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teacher-attendance`);
      const allAttendance = await response.json() as TeacherAttendance[];
      
      // Filter for leave records and group by teacher with date ranges
      const leaveRecords = allAttendance.filter(att => 
        att.status !== "present" && att.leaveStartDate && att.leaveEndDate
      );
      
      // Group by teacher and get unique leave periods
      const leaveByTeacher = new Map<string, {
        teacherId: string;
        teacherName: string;
        periods: Array<{
          startDate: string; 
          endDate: string; 
          reason?: string; 
          status: string;
          isActive: boolean;
        }>;
      }>();
      
      const today = getCurrentDateIST();
      
      leaveRecords.forEach(record => {
        const teacher = teachers.find(t => t.id === record.teacherId);
        if (!teacher) return;
        
        if (!leaveByTeacher.has(record.teacherId)) {
          leaveByTeacher.set(record.teacherId, {
            teacherId: record.teacherId,
            teacherName: teacher.name,
            periods: []
          });
        }
        
        const existing = leaveByTeacher.get(record.teacherId)!;
        const periodExists = existing.periods.some(p => 
          p.startDate === record.leaveStartDate && p.endDate === record.leaveEndDate
        );
        
        if (!periodExists && record.leaveStartDate && record.leaveEndDate) {
          const isActive = record.leaveStartDate <= today && today <= record.leaveEndDate;
          existing.periods.push({
            startDate: record.leaveStartDate,
            endDate: record.leaveEndDate,
            reason: record.reason || undefined,
            status: record.status,
            isActive
          });
        }
      });
      
      // Sort periods by start date (most recent first)
      leaveByTeacher.forEach(data => {
        data.periods.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      });
      
      return Array.from(leaveByTeacher.values());
    },
    enabled: !!user?.schoolId && (activeTab === "attendance" || activeTab === "leave") && teachers.length > 0,
  });

  // Filter for currently active leave periods
  const currentlyOnLeave = allTeachersOnLeave.filter(teacher => 
    teacher.periods.some(period => period.isActive)
  );

  const createTeacherMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      // Prepare backend data with classes included
      const response = await apiRequest("POST", "/api/teachers", { 
        ...data,
        schoolId: user?.schoolId,
        availability: {
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: []
        },
        maxLoad: 30
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setIsAddDialogOpen(false);
      addForm.reset({
        name: "",
        email: "",
        contactNumber: "",
        schoolIdNumber: "",
        schoolId: user?.schoolId || "",
        isActive: true,
        classes: [],
        subjects: [],
      });
      toast({
        title: "Success",
        description: "Teacher added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add teacher",
        variant: "destructive",
      });
    },
  });

  const updateTeacherMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TeacherFormData }) => {
      // Prepare backend data with classes included
      const response = await apiRequest("PUT", `/api/teachers/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setEditingTeacher(null);
      editForm.reset({
        name: "",
        email: "",
        contactNumber: "",
        schoolIdNumber: "",
        schoolId: user?.schoolId || "",
        isActive: true,
        classes: [],
        subjects: [],
      });
      toast({
        title: "Success",
        description: "Teacher updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update teacher",
        variant: "destructive",
      });
    },
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/teachers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({
        title: "Success",
        description: "Teacher deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete teacher",
        variant: "destructive",
      });
    },
  });

  // Attendance mutations
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ teacherId, status }: { teacherId: string; status: string }) => {
      const response = await apiRequest("POST", "/api/teacher-attendance", {
        teacherId,
        schoolId: user?.schoolId,
        attendanceDate: selectedDate,
        status,
        isFullDay: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-attendance"] });
      // Immediately refresh timetable changes to show substitutions
      queryClient.invalidateQueries({ queryKey: ["timetable-changes"] });
      queryClient.refetchQueries({ queryKey: ["timetable-changes"] });
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark attendance",
        variant: "destructive",
      });
    },
  });

  const bulkAttendanceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/teacher-attendance/bulk", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-attendance"] });
      // Immediately refresh timetable changes to show substitutions
      queryClient.invalidateQueries({ queryKey: ["timetable-changes"] });
      queryClient.refetchQueries({ queryKey: ["timetable-changes"] });
      setIsBulkAttendanceOpen(false);
      bulkAttendanceForm.reset();
      toast({
        title: "Success",
        description: "Bulk attendance marked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark bulk attendance",
        variant: "destructive",
      });
    },
  });

  const handleAddTeacher = (data: TeacherFormData) => {
    createTeacherMutation.mutate(data);
  };

  const handleEditTeacher = (data: TeacherFormData) => {
    if (editingTeacher) {
      updateTeacherMutation.mutate({ id: editingTeacher.id, data });
    }
  };

  const handleDeleteTeacher = (id: string) => {
    deleteTeacherMutation.mutate(id);
  };

  const startEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    
    editForm.reset({
      name: teacher.name,
      email: teacher.email ?? "",
      contactNumber: teacher.contactNumber ?? "",
      schoolIdNumber: teacher.schoolIdNumber ?? "",
      schoolId: teacher.schoolId,
      isActive: teacher.isActive,
      classes: teacher.classes || [],
      subjects: teacher.subjects || [],
    });
  };

  // Attendance handlers
  const handleMarkAttendance = (teacherId: string, status: string) => {
    markAttendanceMutation.mutate({ teacherId, status });
  };

  const handleBulkAttendance = (data: any) => {
    bulkAttendanceMutation.mutate(data);
  };

  // Check if selected date is an active school day
  const selectedDayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const isActiveDay = (timetableStructure as any)?.workingDays?.includes(selectedDayName) || false;

  // Get attendance status for a teacher (only on active days)
  const getTeacherAttendanceStatus = (teacherId: string) => {
    // Only calculate attendance for active days
    if (!isActiveDay) return "not_applicable";
    
    const attendance = attendanceData.find(
      (att) => att.teacherId === teacherId && att.attendanceDate === selectedDate
    );
    return attendance?.status || "present";
  };

  if (!user?.schoolId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You need to be associated with a school to manage teachers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            Teachers
          </h1>
          <p className="text-muted-foreground">
            Manage teachers, timetables, and attendance
          </p>
        </div>
        <SearchBar className="w-64" />
      </div>

      {/* Tabbed Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="teachers" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Teachers
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Teacher Attendance
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Teachers on Leave
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="space-y-4">
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
              <Button data-testid="button-add-teacher">
                <Plus className="mr-2 h-4 w-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>
                  Add a new teacher to your school
                </DialogDescription>
              </DialogHeader>
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(handleAddTeacher)} className="space-y-4">
                  <FormField
                    control={addForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teacher Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., John Smith" {...field} data-testid="input-teacher-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={addForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="teacher@school.com" 
                            {...field} 
                            data-testid="input-teacher-email" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="contactNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., +1234567890" 
                            {...field} 
                            data-testid="input-teacher-contact" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="schoolIdNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School ID Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., T001" 
                            {...field} 
                            data-testid="input-teacher-school-id" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="classes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classes Taught *</FormLabel>
                        <FormControl>
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (value && !field.value.includes(value)) {
                                field.onChange([...field.value, value]);
                                // Clear subjects when classes change
                                addForm.setValue("subjects", []);
                              }
                            }}
                          >
                            <SelectTrigger data-testid="select-add-classes">
                              <SelectValue placeholder="Add classes..." />
                            </SelectTrigger>
                            <SelectContent>
                              {classes
                                .filter((classData: any) => !field.value.includes(classData.id))
                                .sort((a: any, b: any) => {
                                  const aDisplay = a.section && a.section.trim() !== '' && a.section !== '-' 
                                    ? `${a.grade}-${a.section}` 
                                    : a.grade;
                                  const bDisplay = b.section && b.section.trim() !== '' && b.section !== '-' 
                                    ? `${b.grade}-${b.section}` 
                                    : b.grade;
                                  return aDisplay.localeCompare(bDisplay, undefined, { numeric: true, sensitivity: 'base' });
                                })
                                .map((classData: any) => (
                                  <SelectItem key={classData.id} value={classData.id}>
                                    Class {classData.section && classData.section.trim() !== '' && classData.section !== '-' 
                                      ? `${classData.grade}-${classData.section}` 
                                      : classData.grade}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        {/* Selected classes display */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.value
                            .sort((a: string, b: string) => {
                              const classA = classes.find((c: any) => c.id === a);
                              const classB = classes.find((c: any) => c.id === b);
                              if (!classA || !classB) return 0;
                              
                              const aDisplay = classA.section && classA.section.trim() !== '' && classA.section !== '-' 
                                ? `${classA.grade}-${classA.section}` 
                                : classA.grade;
                              const bDisplay = classB.section && classB.section.trim() !== '' && classB.section !== '-' 
                                ? `${classB.grade}-${classB.section}` 
                                : classB.grade;
                              
                              return aDisplay.localeCompare(bDisplay, undefined, { numeric: true, sensitivity: 'base' });
                            })
                            .map((classId: string) => {
                            const classData = classes.find((c: any) => c.id === classId);
                            return classData ? (
                              <div
                                key={classId}
                                className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm"
                              >
                                <span>Class {classData.section && classData.section.trim() !== '' && classData.section !== '-' 
                                  ? `${classData.grade}-${classData.section}` 
                                  : classData.grade}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedClasses = field.value.filter((id: string) => id !== classId);
                                    field.onChange(updatedClasses);
                                    
                                    // Remove subjects that belong to the removed class
                                    const currentSubjects = addForm.getValues("subjects");
                                    const subjectsForRemovedClass = classSubjectAssignments
                                      .filter((assignment: any) => assignment.classId === classId)
                                      .map((assignment: any) => assignment.subjectId);
                                    
                                    const updatedSubjects = currentSubjects.filter((subjectId: string) => 
                                      !subjectsForRemovedClass.includes(subjectId)
                                    );
                                    
                                    addForm.setValue("subjects", updatedSubjects);
                                  }}
                                  className="ml-1 hover:bg-green-200 rounded-full w-4 h-4 flex items-center justify-center"
                                  data-testid={`remove-add-class-${classId}`}
                                >
                                  ×
                                </button>
                              </div>
                            ) : null;
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="subjects"
                    render={({ field }) => {
                      const selectedClasses = addForm.watch("classes");
                      const availableSubjects = getSubjectsForClasses(selectedClasses || []);
                      
                      return (
                        <FormItem>
                          <FormLabel>Subjects Taught *</FormLabel>
                          <FormControl>
                            <Select
                              value=""
                              disabled={!selectedClasses || selectedClasses.length === 0}
                              onValueChange={(value) => {
                                if (value && !field.value.includes(value)) {
                                  field.onChange([...field.value, value]);
                                }
                              }}
                            >
                              <SelectTrigger data-testid="select-add-subjects">
                                <SelectValue placeholder={
                                  !selectedClasses || selectedClasses.length === 0 
                                    ? "Select classes first..." 
                                    : "Add subjects..."
                                } />
                              </SelectTrigger>
                              <SelectContent>
                                {availableSubjects
                                  .filter((subjectOption: any) => !field.value.includes(subjectOption.id))
                                  .map((subjectOption: any) => (
                                    <SelectItem key={subjectOption.id} value={subjectOption.id}>
                                      {subjectOption.displayName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          {/* Selected subjects display */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {field.value.map((subjectId: string) => {
                              const subjectOption = availableSubjects.find((s: any) => s.id === subjectId);
                              return subjectOption ? (
                                <div
                                  key={subjectId}
                                  className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
                                >
                                  <span>{subjectOption.displayName}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      field.onChange(field.value.filter((id: string) => id !== subjectId));
                                    }}
                                    className="ml-1 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center"
                                    data-testid={`remove-add-subject-${subjectId}`}
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : null;
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createTeacherMutation.isPending}
                      data-testid="button-save-teacher"
                    >
                      {createTeacherMutation.isPending ? "Adding..." : "Add Teacher"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>

          {/* Teachers List */}
          <Card>
        <CardHeader>
          <CardTitle>All Teachers</CardTitle>
          <CardDescription>
            {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} in your school
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No teachers found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first teacher
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-teacher">
                <Plus className="mr-2 h-4 w-4" />
                Add Teacher
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {teachers
                .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically A-Z
                .map((teacher) => {
                  // Get teacher's subjects
                  const teacherSubjects = (teacher.subjects || [])
                    .map(subjectId => subjects.find((s: any) => s.id === subjectId))
                    .filter(Boolean)
                    .map((s: any) => s.name);

                  // Get teacher's assigned classes from teacher.classes array
                  const teacherClassAssignments = (teacher.classes || [])
                    .map((classId: string) => {
                      const classData = classes.find((c: any) => c.id === classId);
                      if (!classData) return null;
                      
                      // Format display: show section if it exists and is not empty/dash
                      const hasSection = classData.section && classData.section.trim() !== '' && classData.section !== '-';
                      return hasSection 
                        ? `Class ${classData.grade}-${classData.section}`
                        : `Class ${classData.grade}`;
                    })
                    .filter(Boolean)
                    .sort((a: string | null, b: string | null) => {
                      if (!a || !b) return 0;
                      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
                    }); // Sort classes

                  return (
                <Card key={teacher.id} className="hover:shadow-md transition-shadow" data-testid={`teacher-card-${teacher.id}`}>
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 
                          className="font-semibold text-sm truncate cursor-pointer hover:text-primary transition-colors" 
                          data-testid={`teacher-name-${teacher.id}`}
                          onClick={() => setLocation(`/teacher/${teacher.id}`)}
                        >
                          {teacher.name}
                        </h3>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 pt-0 pb-3">
                    {teacher.email && (
                      <div className="flex items-center gap-1 text-xs">
                        <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground truncate" data-testid={`teacher-email-${teacher.id}`}>
                          {teacher.email}
                        </span>
                      </div>
                    )}
                    
                    {/* Subjects taught */}
                    {teacherSubjects.length > 0 && (
                      <div className="flex items-start gap-1 text-xs">
                        <BookOpen className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {teacherSubjects.map((subjectName, index) => (
                            <span
                              key={index}
                              className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs"
                              data-testid={`teacher-subject-${teacher.id}-${index}`}
                            >
                              {subjectName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Classes taught */}
                    {teacherClassAssignments.length > 0 && (
                      <div className="flex items-start gap-1 text-xs">
                        <Users className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {teacherClassAssignments.map((className: string | null, index: number) => {
                            if (!className) return null;
                            return (
                              <span
                                key={index}
                                className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs"
                                data-testid={`teacher-class-${teacher.id}-${index}`}
                              >
                                {className}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-1 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(teacher)}
                        data-testid={`button-edit-teacher-${teacher.id}`}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            data-testid={`button-delete-teacher-${teacher.id}`}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Teacher</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{teacher.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <DialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTeacher(teacher.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-teacher-${teacher.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </DialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Teacher Dialog */}
      <Dialog open={!!editingTeacher} onOpenChange={() => setEditingTeacher(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>
              Update the teacher information
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditTeacher)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teacher Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Smith" {...field} data-testid="input-edit-teacher-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="teacher@school.com" 
                        {...field} 
                        data-testid="input-edit-teacher-email" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="contactNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Number *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., +1234567890" 
                        {...field} 
                        data-testid="input-edit-teacher-contact" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="schoolIdNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School ID Number *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., T001" 
                        {...field} 
                        data-testid="input-edit-teacher-school-id" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="classes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classes Taught *</FormLabel>
                    <FormControl>
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (value && !field.value.includes(value)) {
                            field.onChange([...field.value, value]);
                            // Clear subjects when classes change
                            editForm.setValue("subjects", []);
                          }
                        }}
                      >
                        <SelectTrigger data-testid="select-edit-classes">
                          <SelectValue placeholder="Add classes..." />
                        </SelectTrigger>
                        <SelectContent>
                          {classes
                            .filter((classData: any) => !field.value.includes(classData.id))
                            .sort((a: any, b: any) => {
                              const aDisplay = a.section && a.section.trim() !== '' && a.section !== '-' 
                                ? `${a.grade}-${a.section}` 
                                : a.grade;
                              const bDisplay = b.section && b.section.trim() !== '' && b.section !== '-' 
                                ? `${b.grade}-${b.section}` 
                                : b.grade;
                              return aDisplay.localeCompare(bDisplay, undefined, { numeric: true, sensitivity: 'base' });
                            })
                            .map((classData: any) => (
                              <SelectItem key={classData.id} value={classData.id}>
                                Grade {classData.section && classData.section.trim() !== '' && classData.section !== '-' 
                                  ? `${classData.grade}-${classData.section}` 
                                  : classData.grade}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {/* Selected classes display */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {classes.length > 0 && field.value.length > 0 ? (
                        field.value
                          .sort((a: string, b: string) => {
                            const classA = classes.find((c: any) => c.id === a);
                            const classB = classes.find((c: any) => c.id === b);
                            if (!classA || !classB) return 0;
                            
                            const aDisplay = classA.section && classA.section.trim() !== '' && classA.section !== '-' 
                              ? `${classA.grade}-${classA.section}` 
                              : classA.grade;
                            const bDisplay = classB.section && classB.section.trim() !== '' && classB.section !== '-' 
                              ? `${classB.grade}-${classB.section}` 
                              : classB.grade;
                            
                            return aDisplay.localeCompare(bDisplay, undefined, { numeric: true, sensitivity: 'base' });
                          })
                          .map((classId: string) => {
                            const classData = classes.find((c: any) => c.id === classId);
                                return classData ? (
                              <div
                                key={classId}
                                className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm"
                              >
                                <span>Class {classData.section && classData.section.trim() !== '' && classData.section !== '-' 
                                  ? `${classData.grade}-${classData.section}` 
                                  : classData.grade}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedClasses = field.value.filter((id: string) => id !== classId);
                                    field.onChange(updatedClasses);
                                    
                                    // Remove subjects that belong to the removed class
                                    const currentSubjects = editForm.getValues("subjects");
                                    const subjectsForRemovedClass = classSubjectAssignments
                                      .filter((assignment: any) => assignment.classId === classId)
                                      .map((assignment: any) => assignment.subjectId);
                                    
                                    const updatedSubjects = currentSubjects.filter((subjectId: string) => 
                                      !subjectsForRemovedClass.includes(subjectId)
                                    );
                                    
                                    editForm.setValue("subjects", updatedSubjects);
                                  }}
                                  className="ml-1 hover:bg-green-200 rounded-full w-4 h-4 flex items-center justify-center"
                                  data-testid={`remove-edit-class-${classId}`}
                                >
                                  ×
                                </button>
                              </div>
                            ) : null;
                          })
                      ) : field.value.length > 0 && classes.length === 0 ? (
                        <div className="text-sm text-gray-500">Loading classes...</div>
                      ) : null}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="subjects"
                render={({ field }) => {
                  const selectedClasses = editForm.watch("classes");
                  // For editing: show all subjects if no classes selected (so existing subjects can be managed)
                  // For new selections: only show subjects for selected classes
                  const availableSubjects = selectedClasses && selectedClasses.length > 0 
                    ? getSubjectsForClasses(selectedClasses)
                    : subjects.map((subject: any) => ({ ...subject, displayName: subject.name }));
                  
                  return (
                    <FormItem>
                      <FormLabel>Subjects Taught *</FormLabel>
                      <FormControl>
                        <Select
                          value=""
                          disabled={false}
                          onValueChange={(value) => {
                            if (value && !field.value.includes(value)) {
                              field.onChange([...field.value, value]);
                            }
                          }}
                        >
                          <SelectTrigger data-testid="select-edit-subjects">
                            <SelectValue placeholder="Add subjects..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSubjects
                              .filter((subjectOption: any) => !field.value.includes(subjectOption.id))
                              .map((subjectOption: any) => (
                                <SelectItem key={subjectOption.id} value={subjectOption.id}>
                                  {subjectOption.displayName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      {/* Selected subjects display */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {field.value.map((subjectId: string) => {
                          const subjectOption = availableSubjects.find((s: any) => s.id === subjectId);
                          return subjectOption ? (
                            <div
                              key={subjectId}
                              className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
                            >
                              <span>{subjectOption.displayName}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  field.onChange(field.value.filter((id: string) => id !== subjectId));
                                }}
                                className="ml-1 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center"
                                data-testid={`remove-edit-subject-${subjectId}`}
                              >
                                ×
                              </button>
                            </div>
                          ) : null;
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateTeacherMutation.isPending}
                  data-testid="button-save-edit-teacher"
                >
                  {updateTeacherMutation.isPending ? "Updating..." : "Update Teacher"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
        </TabsContent>


        {/* Teacher Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Teacher Attendance
              </CardTitle>
              <CardDescription>
                Track and manage teacher attendance records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Date Selection and Bulk Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <label htmlFor="date-select" className="text-sm font-medium">
                      Select Date:
                    </label>
                    <Input
                      id="date-select"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-auto"
                      data-testid="input-attendance-date"
                    />
                  </div>
                  <Dialog open={isBulkAttendanceOpen} onOpenChange={setIsBulkAttendanceOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-bulk-attendance">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Mark Leave Period
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Mark Leave Period</DialogTitle>
                        <DialogDescription>
                          Mark a teacher as absent for multiple days (leave period)
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...bulkAttendanceForm}>
                        <form onSubmit={bulkAttendanceForm.handleSubmit(handleBulkAttendance)} className="space-y-4">
                          <FormField
                            control={bulkAttendanceForm.control}
                            name="teacherId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Teacher</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-bulk-teacher">
                                      <SelectValue placeholder="Select a teacher" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {teachers.map((teacher) => (
                                      <SelectItem key={teacher.id} value={teacher.id}>
                                        {teacher.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={bulkAttendanceForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Leave Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-leave-type">
                                      <SelectValue placeholder="Select leave type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="absent">Absent</SelectItem>
                                    <SelectItem value="on_leave">On Leave</SelectItem>
                                    <SelectItem value="medical_leave">Medical Leave</SelectItem>
                                    <SelectItem value="personal_leave">Personal Leave</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={bulkAttendanceForm.control}
                              name="startDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Start Date</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="date" 
                                      {...field} 
                                      data-testid="input-start-date" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={bulkAttendanceForm.control}
                              name="endDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>End Date</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="date" 
                                      {...field} 
                                      data-testid="input-end-date" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={bulkAttendanceForm.control}
                            name="reason"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Reason (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Enter reason for leave..." 
                                    {...field} 
                                    data-testid="textarea-leave-reason"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <DialogFooter>
                            <Button 
                              type="submit" 
                              disabled={bulkAttendanceMutation.isPending}
                              data-testid="button-save-bulk-attendance"
                            >
                              {bulkAttendanceMutation.isPending ? "Marking..." : "Mark Leave Period"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Attendance Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Present Today
                          </p>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            {isActiveDay ? teachers.filter(teacher => getTeacherAttendanceStatus(teacher.id) === "present").length : "—"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <div>
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Absent Today
                          </p>
                          <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                            {isActiveDay ? teachers.filter(teacher => getTeacherAttendanceStatus(teacher.id) !== "present").length : "—"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Total Teachers
                          </p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {teachers.length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>


                {/* Individual Teacher Attendance */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    Attendance for {selectedDate ? formatDateIST(selectedDate) : "Today"}
                    {!isActiveDay && <span className="text-sm font-normal text-muted-foreground ml-2">(Not a school day)</span>}
                  </h3>
                  {!isActiveDay ? (
                    <div className="p-4 text-center text-muted-foreground border rounded-lg">
                      <p>School is closed on this day. Attendance tracking is not applicable.</p>
                    </div>
                  ) : (
                    teachers.map((teacher) => {
                      const attendanceStatus = getTeacherAttendanceStatus(teacher.id);
                      const isPresent = attendanceStatus === "present";
                    
                    return (
                      <div key={teacher.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <div>
                            <h4 
                              className="font-medium cursor-pointer hover:text-primary transition-colors" 
                              onClick={() => setLocation(`/teacher/${teacher.id}`)}
                            >
                              {teacher.name}
                            </h4>
                            <p className="text-sm text-muted-foreground">{teacher.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={isPresent ? "default" : "destructive"}
                            className="flex items-center gap-1"
                          >
                            {isPresent ? (
                              <>
                                <CheckCircle className="h-3 w-3" />
                                Present
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" />
                                {attendanceStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </>
                            )}
                          </Badge>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={markAttendanceMutation.isPending}
                            onClick={() => {
                              const newStatus = isPresent ? "absent" : "present";
                              handleMarkAttendance(teacher.id, newStatus);
                            }}
                            data-testid={`button-mark-${teacher.id}`}
                          >
                            {markAttendanceMutation.isPending 
                              ? "Updating..." 
                              : `Mark ${isPresent ? "Absent" : "Present"}`
                            }
                          </Button>
                        </div>
                      </div>
                    );
                  })
                  )}
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Teachers Leave Management
              </CardTitle>
              <CardDescription>
                View and manage teacher leave periods and attendance history
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Teachers Currently on Leave */}
              {currentlyOnLeave.length > 0 && (
                <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                      <CalendarDays className="h-5 w-5" />
                      Teachers Currently on Leave
                    </CardTitle>
                    <CardDescription className="text-orange-600 dark:text-orange-300">
                      {currentlyOnLeave.length} teacher{currentlyOnLeave.length !== 1 ? 's' : ''} currently on leave
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentlyOnLeave.map((teacherData) => (
                        <div key={teacherData.teacherId} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">{teacherData.teacherName}</h4>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="space-y-2">
                                {teacherData.periods
                                  .filter(period => period.isActive)
                                  .map((period, index) => (
                                    <div key={index} className="text-sm">
                                      <div className="flex items-center gap-2 justify-end">
                                        <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-600 dark:text-orange-300">
                                          {period.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </Badge>
                                      </div>
                                      <div className="text-gray-600 dark:text-gray-400 mt-1">
                                        {formatDateIST(period.startDate, { month: 'short', day: 'numeric' })} - {formatDateIST(period.endDate, { month: 'short', day: 'numeric' })}
                                      </div>
                                      {period.reason && (
                                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                                          {period.reason}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* All Teachers Leave History */}
              {allTeachersOnLeave.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      All Teachers Leave Records
                    </CardTitle>
                    <CardDescription>
                      Complete history of all teacher leave periods ({allTeachersOnLeave.length} teacher{allTeachersOnLeave.length !== 1 ? 's' : ''} with leave records)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {allTeachersOnLeave.map((teacherData) => (
                        <div key={teacherData.teacherId} className="border rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-white" />
                            </div>
                            <h4 className="font-semibold text-lg">{teacherData.teacherName}</h4>
                          </div>
                          
                          <div className="grid gap-3">
                            {teacherData.periods.map((period, index) => (
                              <div key={index} className={`p-3 rounded-lg border-l-4 ${
                                period.isActive 
                                  ? 'border-l-red-500 bg-red-50 dark:bg-red-950' 
                                  : 'border-l-gray-300 bg-gray-50 dark:bg-gray-800'
                              }`}>
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant={period.isActive ? "destructive" : "secondary"}
                                        className="text-xs"
                                      >
                                        {period.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                      </Badge>
                                      {period.isActive && (
                                        <Badge variant="outline" className="text-xs bg-red-100 border-red-300 text-red-700">
                                          Active
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="text-sm font-medium">
                                      {formatDateIST(period.startDate, { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric',
                                        year: 'numeric'
                                      })} - {formatDateIST(period.endDate, { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </div>
                                    
                                    {period.reason && (
                                      <div className="text-sm text-gray-600 dark:text-gray-400 italic">
                                        "{period.reason}"
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {(() => {
                                      const start = new Date(period.startDate);
                                      const end = new Date(period.endDate);
                                      const diffTime = Math.abs(end.getTime() - start.getTime());
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state when no leave records */}
              {allTeachersOnLeave.length === 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <CalendarDays className="h-12 w-12 text-gray-400 mx-auto" />
                      <h3 className="text-lg font-medium">No Leave Records</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        No teachers have any leave periods recorded yet. Start by marking teacher attendance to create leave records.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}