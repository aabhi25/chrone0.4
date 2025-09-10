import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import React from "react";
import { TimetableChanges } from "./TimetableChanges";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { CalendarIcon, Plus, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface TimetableEntry {
  id: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  teacher: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    color: string;
  };
  class: {
    id: string;
    grade: string;
    section: string;
  };
  room?: string;
}

interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  priority?: number;
  teachingThisClass?: boolean;
}

interface ManualAssignmentCell {
  day: string;
  period: number;
  timeSlot: TimeSlot;
  entry?: TimetableEntry;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface TimeSlot {
  period: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

interface TimetableStructure {
  id: string;
  schoolId: string;
  periodsPerDay: number;
  workingDays: string[];
  timeSlots: TimeSlot[];
  isActive: boolean;
}

// Function to sort working days in proper order
const sortWorkingDays = (days: string[]): string[] => {
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return dayOrder.filter(day => days.includes(day));
};

// Format time to 12-hour format with AM/PM
const formatTime12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
};

// Get week start date (Monday)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Get week end date (Saturday)
const getWeekEnd = (date: Date): Date => {
  const weekStart = getWeekStart(date);
  return new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
};

// Format date range for display
const formatWeekRange = (startDate: Date, endDate: Date): string => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
};

export default function TimetableGrid() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [viewMode, setViewMode] = useState<"class" | "teacher">("class");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Manual assignment state
  const [assignmentCell, setAssignmentCell] = useState<ManualAssignmentCell | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<TimetableEntry | null>(null);
  
  // Refresh confirmation dialog state
  const [isRefreshConfirmDialogOpen, setIsRefreshConfirmDialogOpen] = useState(false);
  
  // Set as Global Timetable state
  const [isSetAsGlobalDialogOpen, setIsSetAsGlobalDialogOpen] = useState(false);
  const [isSettingAsGlobal, setIsSettingAsGlobal] = useState(false);
  
  // Global timetable export states
  const [isExportingGlobal, setIsExportingGlobal] = useState<boolean>(false);

  // Handle class selection from URL query parameter
  useEffect(() => {
    if (location === "/timetable") {
      // Check for classId query parameter
      const urlParams = new URLSearchParams(window.location.search);
      const classIdFromUrl = urlParams.get('classId');
      
      if (classIdFromUrl) {
        setSelectedClass(classIdFromUrl);
        setViewMode("class"); // Ensure we're in class view mode
      } else {
        setSelectedClass("");
      }
    }
  }, [location]);

  // Also handle on component mount if we're on timetable page
  useEffect(() => {
    if (location === "/timetable") {
      const urlParams = new URLSearchParams(window.location.search);
      const classIdFromUrl = urlParams.get('classId');
      
      if (classIdFromUrl) {
        setSelectedClass(classIdFromUrl);
        setViewMode("class");
      } else {
        setSelectedClass("");
      }
    }
  }, []);

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ["/api/classes"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ["/api/teachers"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch timetable structure
  const { data: timetableStructure, isLoading: structureLoading } = useQuery<TimetableStructure>({
    queryKey: ["/api/timetable-structure"],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch timetable changes to detect absent teachers
  const { data: timetableChanges = [] } = useQuery({
    queryKey: ["/api/timetable-changes/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable-changes/active");
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch timetable freeze status
  const { data: freezeStatus } = useQuery({
    queryKey: ["timetable-freeze-status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings/timetable-freeze-status");
      return response.json();
    },
    staleTime: 60 * 1000, // 60 seconds
    refetchInterval: 60 * 1000, // Refresh every 60 seconds
  });

  // Fetch confirmed substitutions for displaying substitute teachers - now week-specific
  const { data: substitutions = [] } = useQuery({
    queryKey: ["substitutions", selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const weekStart = getWeekStart(selectedDate);
      const weekEnd = getWeekEnd(selectedDate);
      
      const params = new URLSearchParams({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0]
      });
      
      const response = await apiRequest("GET", `/api/substitutions?${params}`);
      return response.json();
    },
    enabled: !!user?.schoolId,
    refetchInterval: 5000,
  });

  // Fetch teacher attendance data for the selected date
  const { data: teacherAttendance = [] } = useQuery({
    queryKey: ["teacher-attendance", selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const params = new URLSearchParams({
        date: selectedDate.toISOString().split('T')[0]
      });
      
      const response = await apiRequest("GET", `/api/teacher-attendance?${params}`);
      return response.json();
    },
    enabled: !!user?.schoolId,
    refetchInterval: 5000,
  });

  // Query for subjects specific to the selected class
  const { data: classSubjectAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/class-subject-assignments", selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      console.log(`[SUBJECTS] Fetching subjects for class: ${selectedClass}`);
      const response = await apiRequest("GET", `/api/class-subject-assignments?classId=${selectedClass}`);
      const result = await response.json();
      console.log(`[SUBJECTS] Found ${result.length} subject assignments:`, result);
      return result;
    },
    enabled: !!selectedClass,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query for all subjects as fallback
  const { data: allSubjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract subjects from class subject assignments, fallback to all subjects if none assigned
  const classSpecificSubjects: Subject[] = classSubjectAssignments
    .filter((assignment: any) => assignment.subject) // Filter out assignments without subjects
    .map((assignment: any) => assignment.subject);
  
  const subjects: Subject[] = classSpecificSubjects.length > 0 ? classSpecificSubjects : allSubjects;
  
  // Removed debug logging - functionality working correctly

  // Query for available teachers when assignment dialog is open and subject is selected
  const { data: availableTeachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/timetable/available-teachers", assignmentCell?.day, assignmentCell?.period, selectedClass, selectedSubjectId],
    queryFn: async () => {
      if (!assignmentCell || !selectedClass || !selectedSubjectId) return [];
      
      const params = new URLSearchParams({
        classId: selectedClass,
        day: assignmentCell.day,
        period: assignmentCell.period.toString(),
        subjectId: selectedSubjectId
      });
      
      const response = await apiRequest("GET", `/api/timetable/available-teachers?${params.toString()}`);
      return response.json();
    },
    enabled: !!assignmentCell && !!selectedClass && !!selectedSubjectId && isAssignmentDialogOpen,
    staleTime: 0,
  });

  // Mutation for weekly-only teacher assignment (bypasses approval workflow)
  const weeklyEditMutation = useMutation({
    mutationFn: async (assignmentData: {
      classId: string;
      weekStart: string;
      day: string;
      period: number;
      teacherId: string | null;
      subjectId: string | null;
      startTime: string;
      endTime: string;
      room?: string;
      reason?: string;
    }) => {
      console.log('[WEEKLY EDIT] Sending data:', assignmentData);
      const response = await apiRequest("POST", "/api/timetable/weekly-edit", assignmentData);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[WEEKLY EDIT] Success response:', data);
      
      // Refresh relevant queries without invalidating timetable changes
      queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/detailed"] 
      });
      
      // Force immediate refetch
      queryClient.refetchQueries({
        queryKey: ["/api/timetable/detailed", selectedClass, viewMode]
      });
      
      // Close dialog and reset state
      setIsAssignmentDialogOpen(false);
      setAssignmentCell(null);
      setSelectedSubjectId("");
      setSelectedTeacherId("");
      
      console.log('[WEEKLY EDIT] Weekly assignment completed successfully - no approval required!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Mutation for manual teacher assignment
  const assignTeacherMutation = useMutation({
    mutationFn: async (assignmentData: {
      newTeacherId: string;
      classId: string;
      subjectId: string;
      day: string;
      period: number;
      startTime: string;
      endTime: string;
      timetableEntryId?: string;
      reason: string;
    }) => {
      console.log('[ASSIGNMENT] Sending data:', assignmentData);
      const response = await apiRequest("POST", "/api/timetable/manual-assign", assignmentData);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[ASSIGNMENT] Success response:', data);
      
      // Smooth timetable refresh without page reload
      queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/detailed"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable-changes/active"] 
      });
      
      // Force immediate refetch of current timetable
      queryClient.refetchQueries({
        queryKey: ["/api/timetable/detailed", selectedClass, viewMode]
      });
      
      // Close dialog and reset state
      setIsAssignmentDialogOpen(false);
      setAssignmentCell(null);
      setSelectedSubjectId("");
      setSelectedTeacherId("");
      
      console.log('[ASSIGNMENT] Assignment completed successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Mutation for deleting timetable entries
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      // Find the timetable entry to get its specific day
      const entryToCancel = timetableData?.find((entry: TimetableEntry) => entry.id === entryId);
      
      if (!entryToCancel) {
        throw new Error("Timetable entry not found");
      }
      
      // For admin users, use weekly edit system (bypass approval workflow)
      if (user?.role === 'admin' || user?.role === 'super_admin') {
        const weekStart = getWeekStart(selectedDate);
        const weekStartString = weekStart.toISOString().split('T')[0];
        
        // Use weekly edit with null values to delete the entry
        const response = await apiRequest("POST", "/api/timetable/weekly-edit", {
          classId: selectedClass,
          weekStart: weekStartString,
          day: entryToCancel.day,
          period: entryToCancel.period,
          teacherId: null, // null = delete
          subjectId: null, // null = delete
          startTime: entryToCancel.startTime,
          endTime: entryToCancel.endTime,
          room: undefined,
          reason: "Manual deletion via admin interface"
        });
        return response.json();
      } else {
        // For non-admin users, use the old deletion method with approval workflow
        const getDateForWeekDay = (dayName: string): Date => {
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDayIndex = days.indexOf(dayName.toLowerCase());
          
          if (targetDayIndex === -1) return selectedDate;
          
          // Get the start of the week (Monday) from selected date
          const weekStart = getWeekStart(selectedDate);
          
          // Calculate the target date
          const targetDate = new Date(weekStart);
          if (targetDayIndex === 0) { // Sunday
            targetDate.setDate(weekStart.getDate() + 6);
          } else {
            targetDate.setDate(weekStart.getDate() + (targetDayIndex - 1));
          }
          
          return targetDate;
        };
        
        const exactDate = getDateForWeekDay(entryToCancel.day);
        
        // Pass the exact date of the entry's day to create week-specific cancellation
        const params = new URLSearchParams({
          date: exactDate.toISOString().split('T')[0]
        });
        const response = await apiRequest("DELETE", `/api/timetable/entry/${entryId}?${params}`);
        return response;
      }
    },
    onSuccess: () => {
      console.log('[DELETE] Entry deleted successfully');
      
      // Invalidate ALL timetable-related queries
      queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/detailed"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/global"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/weekly"] 
      });
      
      // Only refresh timetable changes for non-admin users (who use approval workflow)
      if (!(user?.role === 'admin' || user?.role === 'super_admin')) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable-changes/active"] 
        });
      }
      
      // Force immediate refetch of ALL current timetable views
      queryClient.refetchQueries({
        queryKey: ["/api/timetable/detailed", selectedClass, viewMode]
      });
      queryClient.refetchQueries({
        queryKey: ["/api/timetable/global", selectedClass]
      });
      
      // Close dialog and reset state
      setIsDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error: Error) => {
      console.error('[DELETE] Error:', error);
      alert('Failed to delete timetable entry. Please try again.');
    },
  });

  // Handle delete confirmation
  const handleDeleteEntry = (entry: TimetableEntry, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent cell click from triggering
    setEntryToDelete(entry);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete action
  const confirmDelete = () => {
    if (entryToDelete) {
      deleteEntryMutation.mutate(entryToDelete.id);
    }
  };

  // Handle cell click for manual assignment
  const handleCellClick = (day: string, period: number, timeSlot: TimeSlot, entry?: TimetableEntry) => {
    // Only allow admins to manually assign teachers
    if (user?.role !== 'admin' && user?.role !== 'super_admin') return;
    
    // Only allow assignment in class view mode
    if (viewMode !== 'class') return;
    
    // Don't allow assignment for break periods
    if (timeSlot.isBreak) return;
    
    // Set up assignment cell data
    setAssignmentCell({ day, period, timeSlot, entry });
    
    // For existing entries, pre-select the subject
    if (entry?.subject?.id) {
      setSelectedSubjectId(entry.subject.id);
    } else {
      setSelectedSubjectId(""); // Free cell - no subject selected yet
    }
    
    setSelectedTeacherId("");
    setIsAssignmentDialogOpen(true);
  };

  // Handle teacher assignment submission
  const handleAssignTeacher = () => {
    if (!assignmentCell || !selectedClass) return;
    
    // Calculate current week start for weekly edits
    const weekStart = getWeekStart(selectedDate);
    const weekStartString = weekStart.toISOString().split('T')[0];
    
    // Use weekly edit mutation for admin direct edits (bypasses approval workflow)
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      weeklyEditMutation.mutate({
        classId: selectedClass,
        weekStart: weekStartString,
        day: assignmentCell.day,
        period: assignmentCell.period,
        teacherId: selectedTeacherId, // null for deletion
        subjectId: selectedSubjectId, // null for deletion
        startTime: assignmentCell.timeSlot.startTime,
        endTime: assignmentCell.timeSlot.endTime,
        room: undefined,
        reason: selectedTeacherId ? "Manual assignment via admin interface" : "Manual removal via admin interface"
      });
    } else {
      // Fallback to global assignment for non-admin users
      if (!selectedTeacherId || !selectedSubjectId) return;
      
      assignTeacherMutation.mutate({
        newTeacherId: selectedTeacherId,
        classId: selectedClass,
        subjectId: selectedSubjectId,
        day: assignmentCell.day,
        period: assignmentCell.period,
        startTime: assignmentCell.timeSlot.startTime,
        endTime: assignmentCell.timeSlot.endTime,
        timetableEntryId: assignmentCell.entry?.id,
        reason: "Manual assignment via interface"
      });
    }
  };

  const shouldFetchTimetable = Boolean(selectedClass);
  const { data: timetableData, isLoading: timetableLoading } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable/detailed", selectedClass, viewMode],
    queryFn: async () => {
      if (!shouldFetchTimetable) return [];
      const params = new URLSearchParams();
      if (viewMode === "class" && selectedClass) {
        params.append("classId", selectedClass);
      } else if (viewMode === "teacher" && selectedClass) {
        params.append("teacherId", selectedClass);
      }
      // Fetch all timetable entries for the selected class/teacher (not filtered by date)
      const response = await apiRequest("GET", `/api/timetable/detailed?${params.toString()}`);
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: shouldFetchTimetable,
    staleTime: 0, // Always fetch fresh data for assignments
  });

  // Global timetable data query (without weekly changes)
  const { data: globalTimetableData, isLoading: globalTimetableLoading } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable/global", selectedClass, viewMode],
    queryFn: async () => {
      try {
        if (!shouldFetchTimetable) return [];
        const params = new URLSearchParams();
        if (viewMode === "class" && selectedClass) {
          params.append("classId", selectedClass);
        } else if (viewMode === "teacher" && selectedClass) {
          params.append("teacherId", selectedClass);
        }
        
        console.log('[GLOBAL API] Fetching global timetable with params:', {
          url: `/api/timetable/global?${params.toString()}`,
          params: Object.fromEntries(params)
        });
        
        // Add aggressive cache busting for Global API
        const timestamp = Date.now();
        const cacheBustParams = new URLSearchParams(params);
        cacheBustParams.set('_t', timestamp.toString());
        cacheBustParams.set('_nocache', Math.random().toString(36));
        
        // Fetch global timetable entries (base schedule without weekly changes)
        const response = await apiRequest("GET", `/api/timetable/global?${cacheBustParams.toString()}`);
        
        // Check if response is actually JSON or HTML redirect
        const contentType = response.headers.get('content-type');
        console.log('[GLOBAL API] Response Content-Type:', contentType);
        
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('API returned non-JSON response (likely authentication redirect)');
        }
        
        const data = await response.json() as TimetableEntry[];
        
        console.log('[GLOBAL API] Response data:', data);
        console.log('[GLOBAL API] Data length:', data?.length || 0);
        console.log('[GLOBAL API] Sample entry:', data?.[0] || 'No entries');
        
        return data;
      } catch (error) {
        console.error('[GLOBAL API] Error fetching global timetable:', error);
        return [];
      }
    },
    enabled: shouldFetchTimetable,
    staleTime: 0, // Always fetch fresh data for assignments
  });

  const getTimetableEntry = (day: string, period: number): TimetableEntry | null => {
    if (!timetableData || !Array.isArray(timetableData)) return null;
    
    // Find the timetable entry for this day and period
    const entry = timetableData.find((entry: TimetableEntry) => 
      entry.day.toLowerCase() === day.toLowerCase() && entry.period === period
    );
    
    if (!entry) return null;
    
    // Check if this entry is cancelled for the current week
    const isCancelled = timetableChanges && Array.isArray(timetableChanges) && 
      timetableChanges.some((change: any) => {
        if (change.timetableEntryId !== entry.id || change.changeType !== 'cancellation') {
          return false;
        }
        
        // Check if the cancellation is for a specific date that falls within the current week
        const changeDate = new Date(change.changeDate + 'T00:00:00'); // Ensure proper date parsing
        const weekStart = getWeekStart(selectedDate);
        const weekEnd = getWeekEnd(selectedDate);
        
        // Set times to start of day for accurate comparison
        weekStart.setHours(0, 0, 0, 0);
        weekEnd.setHours(23, 59, 59, 999);
        changeDate.setHours(0, 0, 0, 0);
        
        
        return changeDate >= weekStart && changeDate <= weekEnd && change.isActive;
      });
    
    // If cancelled for this week, return null (shows as Free Period)
    if (isCancelled) return null;
    
    return entry;
  };

  const getGlobalTimetableEntry = (day: string, period: number): TimetableEntry | null => {
    
    if (!globalTimetableData || !Array.isArray(globalTimetableData)) return null;
    
    return globalTimetableData.find(entry => 
      entry.day.toLowerCase() === day.toLowerCase() && 
      entry.period === period
    ) || null;
  };

  // Handle Global Timetable export
  const handleGlobalExport = async (format: 'png' | 'excel' | 'png-students') => {
    if (isExportingGlobal) return;
    
    setIsExportingGlobal(true);
    try {
      if (format === 'png') {
        // Find the global timetable grid element
        const gridElement = document.querySelector('[data-export="global-timetable-grid"]') as HTMLElement;
        if (!gridElement) {
          console.error('Global timetable grid element not found for export');
          return;
        }

        // Use html2canvas to capture the global timetable
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(gridElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        // Get class name for filename
        const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
        const className = selectedClassData?.section 
          ? `${selectedClassData.grade}-${selectedClassData.section}` 
          : selectedClassData?.grade || selectedClass;

        // Download the image
        const link = document.createElement('a');
        link.download = `global-timetable-${className}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } else if (format === 'png-students') {
        await exportGlobalAsPNGForStudents();
      } else if (format === 'excel') {
        // Excel export for global timetable
        const { utils, writeFile } = await import('xlsx');

        // Get class name for title and filename
        const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
        const className = selectedClassData?.section 
          ? `${selectedClassData.grade}-${selectedClassData.section}` 
          : selectedClassData?.grade || selectedClass;

        // Create worksheet data for global timetable
        const worksheetData = [
          [`Global Timetable - Class ${className}`], // Title row
          [], // Empty row for spacing
          ['', ...weekDays.map(day => day.name)], // Header row
          ...timeSlots.map(timeSlot => [
            `Period ${timeSlot.period} (${formatTime12Hour(timeSlot.startTime)} - ${formatTime12Hour(timeSlot.endTime)})`,
            ...weekDays.map(day => {
              const entry = getGlobalTimetableEntry(day.name.toLowerCase(), timeSlot.period);
              if (entry) {
                return viewMode === "class" ? 
                  `${entry.subject?.name || 'Unknown'} - ${entry.teacher?.name || 'Unknown Teacher'}` :
                  `${entry.subject?.name || 'Unknown'} - ${entry.class?.grade || 'N/A'}-${entry.class?.section || 'N/A'}`;
              }
              return 'Free Period';
            })
          ])
        ];

        const ws = utils.aoa_to_sheet(worksheetData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Global Timetable');
        
        writeFile(wb, `global-timetable-${className}.xlsx`);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExportingGlobal(false);
    }
  };

  // Check if a teacher is absent for a specific day/period/class (and substitution is NOT yet approved)
  const isTeacherAbsent = (day: string, period: number, entry: TimetableEntry | null): boolean => {
    if (!entry) return false;
    
    // Calculate the actual date for this specific day of the week
    const getDateForWeekDay = (dayName: string): Date => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = days.indexOf(dayName.toLowerCase());
      
      if (targetDayIndex === -1) return selectedDate;
      
      // Get the start of the week (Monday) from selected date
      const currentDate = new Date(selectedDate);
      const currentDayIndex = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Calculate Monday of the current week
      const mondayOffset = currentDayIndex === 0 ? -6 : 1 - currentDayIndex;
      const mondayDate = new Date(currentDate);
      mondayDate.setDate(currentDate.getDate() + mondayOffset);
      
      // Calculate the target date
      const targetDate = new Date(mondayDate);
      if (targetDayIndex === 0) { // Sunday
        targetDate.setDate(mondayDate.getDate() + 6);
      } else {
        targetDate.setDate(mondayDate.getDate() + (targetDayIndex - 1));
      }
      
      return targetDate;
    };
    
    // Primary logic: Always check if teacher is marked as absent in attendance records first
    if (teacherAttendance && Array.isArray(teacherAttendance)) {
      const actualDateForThisDay = getDateForWeekDay(day);
      
      const teacherAbsentToday = teacherAttendance.some((attendance: any) => {
        if (attendance.teacherId !== entry.teacher.id || attendance.status !== 'absent') {
          return false;
        }
        
        // Safely parse and compare dates
        try {
          const attendanceDate = new Date(attendance.attendanceDate || attendance.date);
          if (isNaN(attendanceDate.getTime())) {
            return false; // Invalid date
          }
          return attendanceDate.toISOString().split('T')[0] === actualDateForThisDay.toISOString().split('T')[0];
        } catch (error) {
          console.warn('Invalid attendance date:', attendance.attendanceDate || attendance.date);
          return false;
        }
      });
      
      if (teacherAbsentToday) {
        // ONLY hide "Substitution Required" if there's a CONFIRMED substitution (never for auto_assigned)
        const hasConfirmedSubstitution = substitutions && Array.isArray(substitutions) && 
          substitutions.some((substitution: any) => {
            return substitution.timetableEntryId === entry.id && 
                   substitution.status === 'confirmed';
          });
        
        // Show "Substitution Required" if teacher is absent but no confirmed substitution exists
        return !hasConfirmedSubstitution;
      }
    }
    
    return false;
  };

  // Get substitute teacher when substitution is confirmed
  const getSubstituteTeacher = (day: string, period: number, entry: TimetableEntry | null): any | null => {
    if (!entry || !timetableChanges || !Array.isArray(timetableChanges)) return null;
    
    // Check for APPROVED timetable changes first (these take priority)
    const approvedChange = timetableChanges.find((change: any) => {
      return change.timetableEntryId === entry.id && 
             change.changeType === 'substitution' &&
             change.approvedBy; // Only show substitute if change is approved
    });
    
    if (approvedChange && approvedChange.newTeacherId) {
      // Find the substitute teacher from the teachers data
      const substituteTeacher = teachersArray.find((teacher: any) => teacher.id === approvedChange.newTeacherId);
      return substituteTeacher;
    }
    
    // Fallback to confirmed substitutions (for other scenarios)
    if (substitutions && Array.isArray(substitutions)) {
      const confirmedSubstitution = substitutions.find((substitution: any) => {
        return substitution.timetableEntryId === entry.id && 
               substitution.status === 'confirmed'; // Only confirmed, not auto_assigned
      });
      
      if (confirmedSubstitution && confirmedSubstitution.substituteTeacherId) {
        const substituteTeacher = teachersArray.find((teacher: any) => teacher.id === confirmedSubstitution.substituteTeacherId);
        return substituteTeacher;
      }
    }
    
    return null;
  };

  // Helper function to calculate teaching period number (excluding breaks)
  const getTeachingPeriodNumber = (actualPeriod: number): number => {
    if (!timetableStructure?.timeSlots) return actualPeriod;
    
    // Count only non-break periods up to the current period
    let teachingPeriodCount = 0;
    for (const slot of timetableStructure.timeSlots) {
      if (slot.period <= actualPeriod && !slot.isBreak) {
        teachingPeriodCount++;
      }
    }
    return teachingPeriodCount;
  };

  const getSubjectColor = (color: string) => {
    // Convert hex color to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    // Calculate luminance to determine if text should be dark or light
    const getLuminance = (r: number, g: number, b: number) => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    // Create light background and border colors
    const createLightColor = (r: number, g: number, b: number) => {
      // Create very light version for background (mix with white)
      const bgR = Math.round(r + (255 - r) * 0.9);
      const bgG = Math.round(g + (255 - g) * 0.9);
      const bgB = Math.round(b + (255 - b) * 0.9);
      
      // Create medium light version for border
      const borderR = Math.round(r + (255 - r) * 0.7);
      const borderG = Math.round(g + (255 - g) * 0.7);
      const borderB = Math.round(b + (255 - b) * 0.7);

      return {
        background: `rgb(${bgR}, ${bgG}, ${bgB})`,
        border: `rgb(${borderR}, ${borderG}, ${borderB})`,
        text: `rgb(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)})`
      };
    };

    const rgb = hexToRgb(color);
    if (!rgb) {
      return {
        backgroundColor: '#f9fafb',
        borderColor: '#e5e7eb',
        color: '#1f2937',
        borderWidth: '1px',
        borderStyle: 'solid'
      };
    }

    const colors = createLightColor(rgb.r, rgb.g, rgb.b);
    
    return {
      backgroundColor: colors.background,
      borderColor: colors.border,
      color: colors.text,
      borderWidth: '1px',
      borderStyle: 'solid'
    };
  };

  if (classesLoading || teachersLoading || structureLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Use structure data or fallback to defaults
  const workingDays = timetableStructure?.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const timeSlots = timetableStructure?.timeSlots || [
    { period: 1, startTime: "08:00", endTime: "08:45" },
    { period: 2, startTime: "08:45", endTime: "09:30" },
    { period: 3, startTime: "09:30", endTime: "10:15" },
    { period: 4, startTime: "10:15", endTime: "11:00" },
    { period: 5, startTime: "11:15", endTime: "12:00" },
    { period: 6, startTime: "12:00", endTime: "12:45" },
    { period: 7, startTime: "12:45", endTime: "13:30" },
    { period: 8, startTime: "13:30", endTime: "14:15" },
  ];
  
  const sortedDays = sortWorkingDays(workingDays);

  // Sort options alphabetically and prepare display format
  const classesArray = (classes || []) as any[];
  const teachersArray = (teachers || []) as any[];
  
  const sortedSelectOptions = viewMode === "class" 
    ? classesArray.slice().sort((a: any, b: any) => {
        const aDisplay = a.section ? `${a.grade}-${a.section}` : a.grade;
        const bDisplay = b.section ? `${b.grade}-${b.section}` : b.grade;
        return aDisplay.localeCompare(bDisplay, undefined, { numeric: true, sensitivity: 'base' });
      })
    : teachersArray.slice().sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  
  const selectOptions = sortedSelectOptions;
  const selectPlaceholder = viewMode === "class" ? "Select a class" : "Select a teacher";

  // Calculate week containing selected date
  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  
  // Generate days of the week with dates
  const getWeekDays = () => {
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weekDays.push({ 
        name: dayName, 
        shortName: dayName.substring(0, 3),
        date: shortDate,
        fullDate: date,
        isWorkingDay: sortedDays.includes(dayName.toLowerCase())
      });
    }
    return weekDays.filter(day => day.isWorkingDay); // Only show working days
  };
  
  const weekDays = getWeekDays();

  // Show refresh confirmation dialog
  const showRefreshConfirmation = () => {
    setIsRefreshConfirmDialogOpen(true);
  };

  // Confirm and execute refresh
  const confirmRefreshTable = () => {
    setIsRefreshConfirmDialogOpen(false);
    executeRefreshTable();
  };

  // Handle refresh table functionality
  const executeRefreshTable = async () => {
    setIsRefreshing(true);
    
    try {
      // Check for changes in class-subject assignments and regenerate if needed
      if (selectedClass && viewMode === 'class') {
        // Get current timetable data
        const currentTimetable = queryClient.getQueryData(["/api/timetable/detailed", selectedClass, viewMode]) as any[];
        
        // Get current class-subject assignments
        try {
          const assignmentsResponse = await apiRequest("GET", `/api/class-subject-assignments?classId=${selectedClass}`);
          const currentAssignments = await assignmentsResponse.json();
          
          console.log(`[REFRESH] Checking for changes in class ${selectedClass}...`);
          console.log(`[REFRESH] Current assignments:`, currentAssignments);
          console.log(`[REFRESH] Current timetable entries:`, currentTimetable?.length || 0);
          
          // Check if timetable needs regeneration
          let needsRegeneration = false;
          let regenerationReason = '';
          
          // If no timetable entries exist, automatically generate one
          if (!currentTimetable || currentTimetable.length === 0) {
            needsRegeneration = true;
            regenerationReason = 'No timetable found';
          } else {
            // Compare current assignments with timetable entries
            const timetableSubjects = new Map<string, { count: number, teachers: Set<string> }>();
            
            // Count subjects and teachers in current timetable
            currentTimetable.forEach((entry: any) => {
              const subjectId = entry.subjectId;
              if (!timetableSubjects.has(subjectId)) {
                timetableSubjects.set(subjectId, { count: 0, teachers: new Set() });
              }
              const subjectData = timetableSubjects.get(subjectId)!;
              subjectData.count++;
              subjectData.teachers.add(entry.teacherId);
            });
            
            // Check each assignment for mismatches
            for (const assignment of currentAssignments) {
              const subjectId = assignment.subjectId;
              const expectedCount = assignment.weeklyFrequency;
              const assignedTeacherId = assignment.assignedTeacherId;
              
              const timetableData = timetableSubjects.get(subjectId);
              
              // Check if subject is missing from timetable
              if (!timetableData) {
                needsRegeneration = true;
                regenerationReason = `Subject ${assignment.subject.name} missing from timetable`;
                break;
              }
              
              // Check if period count doesn't match
              if (timetableData.count !== expectedCount) {
                needsRegeneration = true;
                regenerationReason = `Subject ${assignment.subject.name} has ${timetableData.count} periods but needs ${expectedCount}`;
                break;
              }
              
              // Check if assigned teacher doesn't match
              if (assignedTeacherId && !timetableData.teachers.has(assignedTeacherId)) {
                needsRegeneration = true;
                regenerationReason = `Subject ${assignment.subject.name} assigned to wrong teacher`;
                break;
              }
            }
            
            // Check for extra subjects in timetable not in assignments
            for (const subjectId of Array.from(timetableSubjects.keys())) {
              const hasAssignment = currentAssignments.some((a: any) => a.subjectId === subjectId);
              if (!hasAssignment) {
                needsRegeneration = true;
                regenerationReason = `Timetable contains subject not in current assignments`;
                break;
              }
            }
          }
          
          // If no changes detected, still reshuffle for fresh arrangement
          if (!needsRegeneration) {
            console.log(`[REFRESH] No changes detected, but reshuffling timetable as requested`);
            needsRegeneration = true;
            regenerationReason = 'Reshuffling timetable for fresh arrangement';
          }
          
          // Always regenerate timetable (either due to changes or for reshuffling)
          console.log(`[REFRESH] ${regenerationReason}, regenerating timetable...`);
          setIsGenerating(true);
          
          try {
            const response = await apiRequest("POST", "/api/timetable/generate", { classId: selectedClass });
            const result = await response.json();
            
            if (result.success) {
              console.log(`[REFRESH] Timetable regenerated successfully: ${result.message}`);
            } else {
              console.warn(`[REFRESH] Regeneration failed: ${result.message}`);
              // Continue with normal refresh even if generation fails
            }
          } catch (genError) {
            console.error('[REFRESH] Error regenerating timetable:', genError);
            // Continue with normal refresh even if generation fails
          } finally {
            setIsGenerating(false);
          }
          
        } catch (assignmentError) {
          console.error('[REFRESH] Error fetching assignments, proceeding with normal refresh:', assignmentError);
          // Continue with normal refresh if assignment check fails
        }
      }
      
      // Invalidate and refetch all timetable-related queries
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/detailed", selectedClass, viewMode],
        exact: false 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable-structure"],
        exact: false 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable-changes/active"],
        exact: false 
      });
      
      // Force refetch to ensure data is refreshed
      await queryClient.refetchQueries({ 
        queryKey: ["/api/timetable/detailed", selectedClass, viewMode],
        exact: false 
      });
      
      // Show success feedback
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000); // Keep spinner for at least 1 second for visual feedback
      
    } catch (error) {
      console.error('Error refreshing timetable:', error);
      setIsRefreshing(false);
    }
  };

  // Set as Global Timetable functionality
  const showSetAsGlobalConfirmation = () => {
    setIsSetAsGlobalDialogOpen(true);
  };

  const confirmSetAsGlobal = () => {
    setIsSetAsGlobalDialogOpen(false);
    executeSetAsGlobal();
  };

  const executeSetAsGlobal = async () => {
    if (!selectedClass) {
      alert('Please select a class first');
      return;
    }

    setIsSettingAsGlobal(true);
    
    try {
      const response = await apiRequest("POST", "/api/timetable/set-as-global", {
        classId: selectedClass,
        date: selectedDate.toISOString().split('T')[0]
      });

      const result = await response.json();

      if (result.success) {
        // Invalidate and refetch all related queries to show updated data
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/detailed"],
          exact: false 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable-changes/active"],
          exact: false 
        });
        
        // Force refetch to ensure data is refreshed
        await queryClient.refetchQueries({ 
          queryKey: ["/api/timetable/detailed", selectedClass, viewMode],
          exact: false 
        });
        
        console.log(`[SET_AS_GLOBAL] Successfully promoted weekly changes to global timetable. ${result.entriesUpdated} entries updated.`);
        
        // Show success feedback
        setTimeout(() => {
          setIsSettingAsGlobal(false);
        }, 1000);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error setting as global timetable:', error);
      alert('Failed to promote changes to global timetable. Please try again.');
      setIsSettingAsGlobal(false);
    }
  };

  // Handle export functionality
  const handleExport = async (format: 'png' | 'excel' | 'png-students') => {
    if (!selectedClass) {
      alert('Please select a class or teacher to export their timetable');
      return;
    }

    setIsExporting(true);

    try {
      if (format === 'png') {
        await exportAsPNG();
      } else if (format === 'png-students') {
        await exportAsPNGForStudents();
      } else if (format === 'excel') {
        await exportAsExcel();
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export timetable as PNG
  const exportAsPNG = async () => {
    const timetableElement = document.querySelector('[data-export="timetable-grid"]') as HTMLElement;
    
    if (!timetableElement) {
      alert('Timetable grid not found for export');
      return;
    }

    // Add CSS for better export formatting
    const exportStyle = document.createElement('style');
    exportStyle.id = 'export-formatting-style';
    exportStyle.textContent = `
      [data-export="timetable-grid"] {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
        border-collapse: separate !important;
        border-spacing: 1px !important;
      }
      [data-export="timetable-grid"] .grid > div {
        min-height: 60px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        padding: 8px !important;
        box-sizing: border-box !important;
      }
      [data-export="timetable-grid"] .text-sm,
      [data-export="timetable-grid"] .text-xs {
        line-height: 1.2 !important;
      }
      [data-export="timetable-grid"] .font-semibold {
        font-weight: 600 !important;
      }
      [data-export="timetable-grid"] .opacity-90 {
        opacity: 0.9 !important;
      }
    `;
    document.head.appendChild(exportStyle);

    try {
      const canvas = await html2canvas(timetableElement, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 2,
        width: timetableElement.scrollWidth,
        height: timetableElement.scrollHeight,
      });

      // Get selected entity name for filename
      const selectedEntity = viewMode === 'class' 
        ? (classes as any[])?.find(c => c.id === selectedClass) 
        : (teachers as any[])?.find(t => t.id === selectedClass);
      
      const entityName = viewMode === 'class' 
        ? (selectedEntity?.section ? `${selectedEntity.grade}-${selectedEntity.section}` : selectedEntity?.grade)
        : selectedEntity?.name;

      // Create download link
      const link = document.createElement('a');
      link.download = `timetable-${viewMode}-${entityName}-${format(selectedDate, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL();
      link.click();

    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    } finally {
      // Remove the temporary style
      const styleElement = document.getElementById('export-formatting-style');
      if (styleElement) {
        styleElement.remove();
      }
    }
  };

  // Export timetable as PNG for Students (without teacher names)
  const exportAsPNGForStudents = async () => {
    const timetableElement = document.querySelector('[data-export="timetable-grid"]') as HTMLElement;
    
    if (!timetableElement) {
      alert('Timetable grid not found for export');
      return;
    }

    // Add CSS for better export formatting and hide teacher names
    const style = document.createElement('style');
    style.id = 'student-export-style';
    style.textContent = `
      [data-export="timetable-grid"] {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
        border-collapse: separate !important;
        border-spacing: 1px !important;
      }
      [data-export="timetable-grid"] .grid > div {
        min-height: 60px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        padding: 8px !important;
        box-sizing: border-box !important;
      }
      [data-export="timetable-grid"] .text-sm,
      [data-export="timetable-grid"] .text-xs {
        line-height: 1.2 !important;
      }
      [data-export="timetable-grid"] .font-semibold {
        font-weight: 600 !important;
      }
      [data-export="timetable-grid"] .opacity-90 {
        opacity: 0.9 !important;
      }
      [data-export="timetable-grid"] .text-xs.opacity-90.leading-tight,
      [data-export="timetable-grid"] .text-xs.opacity-75.leading-tight {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    try {
      const canvas = await html2canvas(timetableElement, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 2,
        width: timetableElement.scrollWidth,
        height: timetableElement.scrollHeight,
      });

      // Get selected entity name for filename
      const selectedEntity = viewMode === 'class' 
        ? (classes as any[])?.find(c => c.id === selectedClass) 
        : (teachers as any[])?.find(t => t.id === selectedClass);
      
      const entityName = viewMode === 'class' 
        ? (selectedEntity?.section ? `${selectedEntity.grade}-${selectedEntity.section}` : selectedEntity?.grade)
        : selectedEntity?.name;

      // Create download link
      const link = document.createElement('a');
      link.download = `timetable-${viewMode}-${entityName}-${format(selectedDate, 'yyyy-MM-dd')}-students.png`;
      link.href = canvas.toDataURL();
      link.click();

    } catch (error) {
      console.error('Student export failed:', error);
      throw error;
    } finally {
      // Remove the temporary style
      const styleElement = document.getElementById('student-export-style');
      if (styleElement) {
        styleElement.remove();
      }
    }
  };

  // Export Global timetable as PNG for Students (without teacher names)
  const exportGlobalAsPNGForStudents = async () => {
    const gridElement = document.querySelector('[data-export="global-timetable-grid"]') as HTMLElement;
    if (!gridElement) {
      console.error('Global timetable grid element not found for export');
      return;
    }

    // Add CSS for better export formatting and hide teacher names
    const style = document.createElement('style');
    style.id = 'student-export-style-global';
    style.textContent = `
      [data-export="global-timetable-grid"] {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
        border-collapse: separate !important;
        border-spacing: 1px !important;
      }
      [data-export="global-timetable-grid"] .grid > div {
        min-height: 60px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        padding: 8px !important;
        box-sizing: border-box !important;
      }
      [data-export="global-timetable-grid"] .text-sm,
      [data-export="global-timetable-grid"] .text-xs {
        line-height: 1.2 !important;
      }
      [data-export="global-timetable-grid"] .font-semibold {
        font-weight: 600 !important;
      }
      [data-export="global-timetable-grid"] .opacity-90 {
        opacity: 0.9 !important;
      }
      [data-export="global-timetable-grid"] .text-xs.opacity-90:not(.font-semibold) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    try {
      // Use html2canvas to capture the global timetable
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(gridElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Get class name for filename
      const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
      const className = selectedClassData?.section 
        ? `${selectedClassData.grade}-${selectedClassData.section}` 
        : selectedClassData?.grade || selectedClass;

      // Download the image
      const link = document.createElement('a');
      link.download = `global-timetable-${className}-students.png`;
      link.href = canvas.toDataURL();
      link.click();

    } catch (error) {
      console.error('Global student export failed:', error);
      throw error;
    } finally {
      // Remove the temporary style
      const styleElement = document.getElementById('student-export-style-global');
      if (styleElement) {
        styleElement.remove();
      }
    }
  };

  // Export timetable as Excel
  const exportAsExcel = async () => {
    if (!timetableData || timetableData.length === 0) {
      alert('No timetable data to export');
      return;
    }

    // Get selected entity name for filename
    const selectedEntity = viewMode === 'class' 
      ? (classes as any[])?.find(c => c.id === selectedClass) 
      : (teachers as any[])?.find(t => t.id === selectedClass);
    
    const entityName = viewMode === 'class' 
      ? (selectedEntity?.section ? `${selectedEntity.grade}-${selectedEntity.section}` : selectedEntity?.grade)
      : selectedEntity?.name;

    // Prepare data for Excel
    const workbook = XLSX.utils.book_new();
    
    // Create timetable sheet
    const timetableSheet: any[][] = [];
    
    // Add title row with class/teacher name
    const titleText = viewMode === 'class' 
      ? `Class ${entityName} - Weekly Timetable`
      : `${entityName} - Weekly Timetable`;
    timetableSheet.push([titleText]);
    timetableSheet.push([]); // Empty row for spacing
    
    // Add header row
    const headerRow = ['Time', ...weekDays.map(day => day.name)];
    timetableSheet.push(headerRow);
    
    // Add time slots and data
    if (timetableStructure?.timeSlots) {
      timetableStructure.timeSlots.forEach((timeSlot: any) => {
        const row = [timeSlot.displayTime];
        
        weekDays.forEach(day => {
          const entry = timetableData.find((entry: any) => 
            entry.day === day.name.toLowerCase() && 
            entry.period === timeSlot.period
          );
          
          let cellValue = '';
          if (entry) {
            if (viewMode === 'class') {
              cellValue = `${entry.teacher?.name || 'Unknown Teacher'}\n${entry.subject?.name || 'Unknown Subject'}`;
            } else {
              cellValue = `${entry.class?.grade || 'N/A'}-${entry.class?.section || 'N/A'}\n${entry.subject?.name || 'Unknown Subject'}`;
            }
          }
          row.push(cellValue);
        });
        
        timetableSheet.push(row);
      });
    }
    
    // Add worksheet to workbook
    const ws = XLSX.utils.aoa_to_sheet(timetableSheet);
    
    // Set column widths
    const colWidths = [{ width: 15 }, ...weekDays.map(() => ({ width: 20 }))];
    ws['!cols'] = colWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, ws, 'Timetable');
    
    // Save file
    const filename = `timetable-${viewMode}-${entityName}-${format(selectedDate, 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Component ready

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        {/* Back button - only visible when a class/teacher is selected */}
        {selectedClass && (
          <div className="mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedClass("")}
              className="flex items-center space-x-1"
              data-testid="button-back-to-home"
            >
              <i className="fas fa-arrow-left text-xs"></i>
              <span>Back</span>
            </Button>
          </div>
        )}
        
        {/* Header Section */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Weekly Timetable</h3>
            <p className="text-muted-foreground text-sm">
              {formatWeekRange(weekStart, weekEnd)}
            </p>
          </div>
          
          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-64 justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date: Date | undefined) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Controls Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Select value={viewMode} onValueChange={(value: "class" | "teacher") => {
              setViewMode(value);
              setSelectedClass("");
            }}>
              <SelectTrigger className="w-32" data-testid="select-view-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Class View</SelectItem>
                <SelectItem value="teacher">Teacher View</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-48" data-testid="select-class-teacher">
                <SelectValue placeholder={selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(selectOptions) && selectOptions.map((option: any) => (
                  <SelectItem key={option.id} value={option.id}>
                    {viewMode === "class" 
                      ? (option.section && option.section.trim() !== '' && option.section !== '-' 
                          ? `${option.grade}-${option.section}` 
                          : option.grade)
                      : option.name
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  data-testid="button-export-timetable"
                  disabled={isExporting}
                >
                  <i className={`fas fa-download mr-2 ${isExporting ? 'fa-spin' : ''}`}></i>
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('png')}>
                  <i className="fas fa-image mr-2"></i>
                  Export as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('png-students')}>
                  <i className="fas fa-user-graduate mr-2"></i>
                  Export for Students
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>
                  <i className="fas fa-file-excel mr-2"></i>
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {!freezeStatus?.timetableFrozen && (
            <div className="flex items-center space-x-3">
              <Button 
                variant="default" 
                data-testid="button-refresh-timetable"
                onClick={showRefreshConfirmation}
                disabled={isRefreshing || isGenerating || timetableLoading}
              >
                <i className={`fas fa-sync mr-2 ${isRefreshing || isGenerating || timetableLoading ? 'fa-spin' : ''}`}></i>
                {isGenerating ? 'Generating Global Timetable...' : isRefreshing ? 'Refreshing Global Timetable...' : 'Refresh Global Timetable'}
              </Button>
              
              {selectedClass && (
                <Button 
                  variant="outline" 
                  data-testid="button-set-as-global"
                  onClick={showSetAsGlobalConfirmation}
                  disabled={isSettingAsGlobal || isRefreshing || isGenerating || timetableLoading}
                >
                  <i className={`fas fa-globe mr-2 ${isSettingAsGlobal ? 'fa-spin' : ''}`}></i>
                  {isSettingAsGlobal ? 'Setting as Global...' : 'Set as Global Timetable'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-6">
        {!selectedClass ? (
          <div className="space-y-8">
            {/* Default Layout */}
            <div>
              <h4 className="text-lg font-semibold mb-4 flex items-center">
                <i className="fas fa-calendar-week mr-2"></i>
                Weekly Timetable
              </h4>
              <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                <i className="fas fa-calendar-week text-4xl mb-4"></i>
                <p className="mb-2">Select a {viewMode} to view the weekly timetable</p>
                <p className="text-sm">
                  {formatWeekRange(weekStart, weekEnd)} - {weekDays.length} working days
                </p>
              </div>
            </div>

          </div>
        ) : timetableLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4" data-export="timetable-grid">
            {/* Compact Weekly Timetable Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <h4 className="font-semibold text-blue-900 mb-1 flex items-center text-sm">
                <i className="fas fa-calendar-week mr-2"></i>
                Weekly Timetable - {formatWeekRange(weekStart, weekEnd)}
              </h4>
              <p className="text-blue-700 text-xs">
                Schedule for {viewMode === "class" ? 
                  `Class ${(selectOptions as any[])?.find(c => c.id === selectedClass)?.grade}-${(selectOptions as any[])?.find(c => c.id === selectedClass)?.section}` :
                  `${(selectOptions as any[])?.find(t => t.id === selectedClass)?.name}`
                }
              </p>
            </div>

            {/* Compact Weekly Grid Table */}
            <div className="overflow-hidden">
              <table className="w-full border-collapse text-sm" data-testid="timetable-grid">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground border-r border-border bg-gray-50 w-36">
                      <i className="fas fa-clock mr-1 text-xs"></i>
                      <span className="text-xs">Time Period</span>
                    </th>
                    {weekDays.map((day) => (
                      <th key={day.name} className="text-center py-2 px-2 font-semibold text-muted-foreground">
                        <div className="font-semibold text-xs">{day.name}</div>
                        <div className="text-xs text-muted-foreground font-normal">{day.date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((timeSlot: TimeSlot) => (
                    <tr key={timeSlot.period} className={`border-b border-border hover:bg-muted/20 transition-colors h-12 ${
                      timeSlot.isBreak ? 'bg-orange-50' : ''
                    }`}>
                      <td className="py-1 px-2 text-xs border-r border-border bg-gray-50">
                        {timeSlot.isBreak ? (
                          <div className="flex items-center text-orange-600">
                            <i className="fas fa-coffee mr-1 text-xs"></i>
                            <div>
                              <div className="font-semibold text-xs">Break Time</div>
                              <div className="text-xs text-muted-foreground">
                                {formatTime12Hour(timeSlot.startTime)} - {formatTime12Hour(timeSlot.endTime)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-xs flex items-center">
                              <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs font-bold mr-1">
                                P{getTeachingPeriodNumber(timeSlot.period)}
                              </span>
                              <span className="hidden sm:inline">Period {getTeachingPeriodNumber(timeSlot.period)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime12Hour(timeSlot.startTime)} - {formatTime12Hour(timeSlot.endTime)}
                            </div>
                          </div>
                        )}
                      </td>
                      {weekDays.map((day) => {
                        if (timeSlot.isBreak) {
                          return (
                            <td key={day.name} className="py-1 px-1 text-center bg-orange-50">
                              <div className="text-orange-600 text-xs font-medium flex items-center justify-center">
                                <i className="fas fa-coffee mr-1 text-xs"></i>
                                <span className="hidden sm:inline">Break Time</span>
                                <span className="sm:hidden">Break</span>
                              </div>
                            </td>
                          );
                        }
                        
                        const entry = getTimetableEntry(day.name, timeSlot.period);
                        const needsSubstitution = isTeacherAbsent(day.name, timeSlot.period, entry);
                        const substituteTeacher = getSubstituteTeacher(day.name, timeSlot.period, entry);
                        
                        const canEdit = (user?.role === 'admin' || user?.role === 'super_admin') && viewMode === 'class' && !timeSlot.isBreak;
                        
                        return (
                          <td 
                            key={day.name} 
                            className={`py-1 px-1 text-center relative ${canEdit ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                            onClick={() => canEdit && handleCellClick(day.name, timeSlot.period, timeSlot, entry || undefined)}
                            title={canEdit ? "Click to assign teacher" : ""}
                          >
                            {entry ? (
                              needsSubstitution ? (
                                <div className="rounded p-1.5 border text-center bg-yellow-100 border-yellow-300 text-yellow-900 hover:shadow-sm transition-shadow relative">
                                  <div className="font-semibold text-xs leading-tight flex items-center justify-center">
                                    <i className="fas fa-exclamation-triangle mr-1 text-xs"></i>
                                    Substitution Required
                                  </div>
                                  <div className="text-xs opacity-90 leading-tight">
                                    {entry.subject?.name || 'Unknown Subject'}
                                  </div>
                                  <div className="text-xs opacity-75 leading-tight">
                                    {viewMode === "class" ? `Teacher: ${entry.teacher?.name || 'Unknown'}` : `Class: ${entry.class?.grade || 'N/A'}-${entry.class?.section || 'N/A'}`}
                                  </div>
                                  {canEdit && (
                                    <div className="absolute top-1 right-1 flex space-x-1">
                                      <button
                                        onClick={(e) => handleDeleteEntry(entry, e)}
                                        className="hover:bg-red-100 rounded p-0.5 transition-colors"
                                        title="Delete assignment"
                                      >
                                        <Trash2 className="h-3 w-3 text-red-600 hover:text-red-700" />
                                      </button>
                                      {/* Edit icon removed for filled cells to prevent modification */}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div 
                                  className="rounded p-1.5 border text-center hover:shadow-sm transition-shadow relative"
                                  style={getSubjectColor(entry.subject?.color || '#3B82F6')}
                                >
                                  <div className="font-semibold text-xs leading-tight">{entry.subject?.name || 'Unknown Subject'}</div>
                                  <div className="text-xs opacity-90 leading-tight">
                                    {viewMode === "class" ? 
                                      (substituteTeacher ? 
                                        `${substituteTeacher.name} (Sub)` : 
                                        (entry.teacher?.name || 'Unknown Teacher')
                                      ) : 
                                      `${entry.class?.grade || 'N/A'}-${entry.class?.section || 'N/A'}`
                                    }
                                  </div>
                                  {entry.room && (
                                    <div className="text-xs opacity-75 leading-tight">
                                      {entry.room.startsWith('Room') ? entry.room : `Room ${entry.room}`}
                                    </div>
                                  )}
                                  {canEdit && (
                                    <div className="absolute top-1 right-1 flex space-x-1">
                                      <button
                                        onClick={(e) => handleDeleteEntry(entry, e)}
                                        className="hover:bg-red-100 rounded p-0.5 transition-colors"
                                        title="Delete assignment"
                                      >
                                        <Trash2 className="h-3 w-3 text-red-600 hover:text-red-700" />
                                      </button>
                                      {/* Edit icon removed for filled cells to prevent modification */}
                                    </div>
                                  )}
                                </div>
                              )
                            ) : (
                              <div className="text-center py-2 px-1 text-muted-foreground text-xs rounded border border-dashed border-gray-200 relative">
                                <div>Free Period</div>
                                {canEdit && (
                                  <div className="absolute top-1 right-1">
                                    <Plus className="h-3 w-3 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {selectedClass && timetableData && (
          <div className="mt-6">
            <div className="text-sm text-muted-foreground">
              <span className="flex items-center">
                <i className="fas fa-info-circle mr-2"></i>
                {timetableData.length} periods scheduled
              </span>
            </div>
          </div>
        )}
        
        {/* Timetable Changes Section - Always visible */}
        <TimetableChanges 
          classId={selectedClass} 
          selectedDate={selectedDate.toISOString().split('T')[0]}
          onClassSelect={setSelectedClass}
        />

        {/* Global Timetable Section */}
        {selectedClass && (
          <div className="mt-8 space-y-4">
            {/* Global Timetable Header */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-green-900 mb-1 flex items-center">
                    <i className="fas fa-globe mr-2"></i>
                    Global Timetable (Base Schedule)
                  </h4>
                  <p className="text-green-700 text-sm">
                    This is the standard timetable that applies to all weeks unless modified. Weekly changes shown above do not affect this base schedule.
                  </p>
                </div>
                
                {/* Global Timetable Export Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={isExportingGlobal}
                    >
                      <i className={`fas fa-download mr-2 ${isExportingGlobal ? 'fa-spin' : ''}`}></i>
                      {isExportingGlobal ? 'Exporting...' : 'Export Global'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleGlobalExport('png')}>
                      <i className="fas fa-image mr-2"></i>
                      Export as PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleGlobalExport('png-students')}>
                      <i className="fas fa-user-graduate mr-2"></i>
                      Export for Students
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleGlobalExport('excel')}>
                      <i className="fas fa-file-excel mr-2"></i>
                      Export as Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Global Timetable Grid */}
            {globalTimetableLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden" data-export="global-timetable-grid">
                {/* Global Timetable Header */}
                <div className="mb-4 text-center py-3 border-b-2 border-border">
                  <h2 className="text-lg font-bold text-foreground">
                    Global Timetable - Class {
                      selectedClass ? 
                        (() => {
                          const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
                          return selectedClassData?.section 
                            ? `${selectedClassData.grade}-${selectedClassData.section}` 
                            : selectedClassData?.grade || selectedClass;
                        })() 
                        : 'Unknown'
                    }
                  </h2>
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2 px-2 font-semibold text-muted-foreground border-r border-border bg-gray-50 w-36">
                        <i className="fas fa-clock mr-1 text-xs"></i>
                        <span className="text-xs">Time Period</span>
                      </th>
                      {weekDays.map((day) => (
                        <th key={day.name} className="text-center py-2 px-2 font-semibold text-muted-foreground">
                          <div className="font-semibold text-xs">{day.name}</div>
                          <div className="text-xs opacity-75">{day.date}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((timeSlot) => (
                      <tr key={timeSlot.period} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-2 font-medium border-r border-border bg-gray-50 text-center">
                          <div className="text-xs font-medium">Period {timeSlot.period}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime12Hour(timeSlot.startTime)} - {formatTime12Hour(timeSlot.endTime)}
                          </div>
                        </td>
                        {weekDays.map((day) => {
                          const globalEntry = getGlobalTimetableEntry(day.name.toLowerCase(), timeSlot.period);
                          
                          return (
                            <td key={`${day.name}-${timeSlot.period}`} className="py-1 px-1 text-center border-r border-border">
                              {globalEntry ? (
                                <div 
                                  className="rounded p-1.5 border text-center hover:shadow-sm transition-shadow"
                                  style={getSubjectColor(globalEntry.subject?.color || '#3B82F6')}
                                >
                                  <div className="font-semibold text-xs leading-tight">{globalEntry.subject?.name || 'Unknown Subject'}</div>
                                  <div className="text-xs opacity-90 leading-tight">
                                    {viewMode === "class" ? 
                                      (globalEntry.teacher?.name || 'Unknown Teacher') : 
                                      `${globalEntry.class?.grade || 'N/A'}-${globalEntry.class?.section || 'N/A'}`
                                    }
                                  </div>
                                  {globalEntry.room && (
                                    <div className="text-xs opacity-75 leading-tight">
                                      {globalEntry.room.startsWith('Room') ? globalEntry.room : `Room ${globalEntry.room}`}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-2 px-1 text-muted-foreground text-xs rounded border border-dashed border-gray-200">
                                  <div>Free Period</div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Manual Teacher Assignment Dialog */}
        <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="assignment-dialog-description">
            <DialogHeader>
              <DialogTitle>Assign Teacher</DialogTitle>
            </DialogHeader>
            <div id="assignment-dialog-description" className="sr-only">
              Dialog to manually assign a teacher to a specific time slot in the timetable
            </div>
            
            {assignmentCell && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-sm mb-2">Assignment Details</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>Day:</strong> {assignmentCell.day.charAt(0).toUpperCase() + assignmentCell.day.slice(1)}</div>
                    <div><strong>Period:</strong> {assignmentCell.period}</div>
                    <div><strong>Time:</strong> {formatTime12Hour(assignmentCell.timeSlot.startTime)} - {formatTime12Hour(assignmentCell.timeSlot.endTime)}</div>
                    {assignmentCell.entry && (
                      <>
                        <div><strong>Subject:</strong> {assignmentCell.entry.subject?.name || 'Unknown'}</div>
                        <div><strong>Current Teacher:</strong> {assignmentCell.entry.teacher?.name || 'None'}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 1: Select Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject-select">Select Subject</Label>
                  <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                    <SelectTrigger id="subject-select">
                      <SelectValue placeholder="Choose a subject..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!assignmentCell?.entry && (
                    <p className="text-xs text-gray-500">
                      First select the subject to teach during this period.
                    </p>
                  )}
                </div>

                {/* Step 2: Select Teacher (only after subject is selected) */}
                {selectedSubjectId && (
                  <div className="space-y-2">
                    <Label htmlFor="teacher-select">Select Teacher</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger id="teacher-select">
                        <SelectValue placeholder="Choose a teacher..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTeachers.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">
                            No teachers available who can teach this subject
                          </div>
                        ) : (
                          availableTeachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{teacher.name}</span>
                                <div className="flex items-center space-x-1 text-xs">
                                  {teacher.teachingThisClass && (
                                    <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                                      Class Teacher
                                    </span>
                                  )}
                                  {teacher.priority && teacher.priority > 0 && (
                                    <span className="bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs">
                                      Priority {teacher.priority}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {availableTeachers.length > 0 && (
                      <p className="text-xs text-gray-500">
                        Showing teachers who can teach {subjects.find(s => s.id === selectedSubjectId)?.name}.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAssignmentDialogOpen(false)}
                    disabled={assignTeacherMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAssignTeacher}
                    disabled={!selectedTeacherId || !selectedSubjectId || assignTeacherMutation.isPending || weeklyEditMutation.isPending}
                  >
                    {(assignTeacherMutation.isPending || weeklyEditMutation.isPending) 
                      ? "Assigning..." 
                      : user?.role === 'admin' || user?.role === 'super_admin' 
                        ? "Assign Teacher (Direct Edit)" 
                        : "Assign Teacher"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="delete-dialog-description">
            <DialogHeader>
              <DialogTitle>Delete Assignment</DialogTitle>
            </DialogHeader>
            <div id="delete-dialog-description" className="sr-only">
              Dialog to confirm deletion of a timetable assignment
            </div>
            
            {entryToDelete && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Are you sure you want to delete this assignment?
                </div>
                
                <div className="bg-muted/30 rounded p-3">
                  <div className="font-semibold text-sm">
                    {entryToDelete.subject?.name || 'Unknown Subject'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Teacher: {entryToDelete.teacher?.name || 'Unknown Teacher'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Day: {entryToDelete.day.charAt(0).toUpperCase() + entryToDelete.day.slice(1)}, Period: {entryToDelete.period}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Time: {formatTime12Hour(entryToDelete.startTime)} - {formatTime12Hour(entryToDelete.endTime)}
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  This will make this time slot available as a free period.
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDeleteDialogOpen(false)}
                    disabled={deleteEntryMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={confirmDelete}
                    disabled={deleteEntryMutation.isPending}
                  >
                    {deleteEntryMutation.isPending ? "Deleting..." : "Delete Assignment"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Refresh Global Timetable Confirmation Dialog */}
        <Dialog open={isRefreshConfirmDialogOpen} onOpenChange={setIsRefreshConfirmDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="refresh-dialog-description">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <i className="fas fa-sync text-blue-600"></i>
                <span>Refresh Global Timetable</span>
              </DialogTitle>
            </DialogHeader>
            <div id="refresh-dialog-description" className="sr-only">
              Dialog to confirm global timetable refresh operation
            </div>
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to refresh the <strong>Global Timetable</strong>? This will:
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <ul className="text-sm space-y-1 text-blue-800">
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-check text-blue-600"></i>
                    <span>Check for changes in class-subject assignments</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-sync text-blue-600"></i>
                    <span>Generate a new Global Timetable from scratch</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-globe text-blue-600"></i>
                    <span>Replace the existing Global Timetable for this class</span>
                  </li>
                </ul>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <strong>Note:</strong> This updates the base timetable that applies to all future weeks. Weekly changes remain separate.
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsRefreshConfirmDialogOpen(false)}
                  disabled={isRefreshing || isGenerating}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmRefreshTable}
                  disabled={isRefreshing || isGenerating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <i className="fas fa-sync mr-2"></i>
                  Refresh Global Timetable
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Set as Global Timetable Confirmation Dialog */}
        <Dialog open={isSetAsGlobalDialogOpen} onOpenChange={setIsSetAsGlobalDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="set-global-dialog-description">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <i className="fas fa-globe text-green-600"></i>
                <span>Set as Global Timetable</span>
              </DialogTitle>
            </DialogHeader>
            <div id="set-global-dialog-description" className="sr-only">
              Dialog to confirm setting current weekly changes as global timetable
            </div>
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to make the current week's timetable the new <strong>Global Timetable</strong>? This will:
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <ul className="text-sm space-y-1 text-green-800">
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-check text-green-600"></i>
                    <span>Take the current effective timetable (including weekly changes)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-globe text-green-600"></i>
                    <span>Make it the new Global Timetable for this class</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-eraser text-green-600"></i>
                    <span>Clear current weekly changes since they're now part of the global schedule</span>
                  </li>
                </ul>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <strong>Note:</strong> This will be the default timetable for all future weeks unless you make further weekly changes.
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSetAsGlobalDialogOpen(false)}
                  disabled={isSettingAsGlobal}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmSetAsGlobal}
                  disabled={isSettingAsGlobal}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <i className="fas fa-globe mr-2"></i>
                  Set as Global Timetable
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
