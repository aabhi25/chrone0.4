import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { TimetableChanges } from "./TimetableChanges";

interface TimetableEntry {
  id: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  teacherName?: string;
  subjectName?: string;
  className?: string;
  room?: string;
}

interface TimeSlot {
  period: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

export default function TimetableGridSimple() {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [viewMode, setViewMode] = useState<"class" | "teacher">("class");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Basic queries with no complex dependencies
  const classesQuery = useQuery({
    queryKey: ["/api/classes"],
  });

  const teachersQuery = useQuery({
    queryKey: ["/api/teachers"],
  });

  // Fetch timetable structure to get the correct time slots
  const structureQuery = useQuery({
    queryKey: ["/api/timetable-structure"],
  });


  const timetableQuery = useQuery({
    queryKey: ["/api/timetable/detailed", selectedClass, viewMode, selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!selectedClass) return [];
      const params = new URLSearchParams();
      if (viewMode === "class") {
        params.append("classId", selectedClass);
      } else {
        params.append("teacherId", selectedClass);
      }
      // Add date parameter for daily view
      params.append("date", selectedDate.toISOString().split('T')[0]);
      // Add cache busting parameter to prevent HTTP 304 responses
      params.append("_t", Date.now().toString());
      const response = await apiRequest("GET", `/api/timetable/detailed?${params}`);
      return response.json();
    },
    enabled: !!selectedClass,
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    gcTime: 0, // Don't cache the data at all (updated property name)
  });

  const isLoading = classesQuery.isLoading || teachersQuery.isLoading || structureQuery.isLoading;
  const rawClasses = classesQuery.data || [];
  const teachers = teachersQuery.data || [];
  
  // Sort classes properly: Class 1, Class 2, etc.
  const classes = [...rawClasses].sort((a, b) => {
    // Extract grade number from class name (e.g., "Class 3-A" -> 3, "Class 10" -> 10)
    const gradeA = parseInt(a.grade) || 0;
    const gradeB = parseInt(b.grade) || 0;
    
    if (gradeA !== gradeB) {
      return gradeA - gradeB;
    }
    
    // If grades are the same, sort by section (A, B, C, etc.)
    const sectionA = a.section || '';
    const sectionB = b.section || '';
    return sectionA.localeCompare(sectionB);
  });
  const timetableData = timetableQuery.data || [];


  const timetableStructure = structureQuery.data;

  // Use structure data or fallback to defaults - ensure proper day ordering
  const structureWorkingDays = timetableStructure?.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  
  // Ensure days are in proper order: Monday to Saturday
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const workingDays = dayOrder.filter(day => structureWorkingDays.includes(day));
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

  const getTimetableEntry = (period: number): TimetableEntry | null => {
    if (!timetableData || !Array.isArray(timetableData)) return null;
    // For daily view, get entry for the selected day and period
    const selectedDayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return timetableData.find((entry: TimetableEntry) => 
      entry.day === selectedDayName && entry.period === period
    ) || null;
  };

  // Get the day name for the selected date
  const getSelectedDayDisplay = () => {
    return selectedDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Check if the selected date is a working day
  const isWorkingDay = () => {
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return workingDays.includes(dayName);
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

  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const selectOptions = viewMode === "class" ? classes : teachers;
  const selectPlaceholder = viewMode === "class" ? "Select a class" : "Select a teacher";

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold">Daily Timetable</h3>
                <p className="text-muted-foreground text-sm">
                  {getSelectedDayDisplay()}
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
          </div>
          
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

            <Select value={selectedClass} onValueChange={(value) => {
              setSelectedClass(value);
            }}>
              <SelectTrigger className="w-48" data-testid="select-class-teacher">
                <SelectValue placeholder={selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(selectOptions) && selectOptions.map((option: any) => (
                  <SelectItem key={option.id} value={option.id}>
                    {viewMode === "class" 
                      ? `Class ${option.grade}${option.section ? `-${option.section}` : ''}`
                      : option.name
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {!selectedClass ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
            <i className="fas fa-calendar-day text-4xl mb-4"></i>
            <p className="mb-2">Select a {viewMode} to view the daily timetable</p>
            <p className="text-sm">
              {isWorkingDay() 
                ? `${timeSlots.length} periods scheduled for ${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}`
                : `${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })} is not a working day`
              }
            </p>
          </div>
        ) : timetableQuery.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !isWorkingDay() ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
            <i className="fas fa-calendar-times text-5xl mb-4 text-gray-400"></i>
            <h3 className="text-lg font-semibold mb-2">No Classes Today</h3>
            <p className="mb-4">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} is not a working day
            </p>
            <p className="text-sm">
              Working days: {workingDays.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Daily Timetable Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                <i className="fas fa-calendar-day mr-2"></i>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h4>
              <p className="text-blue-700 text-sm">
                Daily schedule for {viewMode === "class" ? 
                  `${(selectOptions as any[])?.find(c => c.id === selectedClass)?.grade}-${(selectOptions as any[])?.find(c => c.id === selectedClass)?.section}` :
                  `${(selectOptions as any[])?.find(t => t.id === selectedClass)?.name}`
                }
              </p>
            </div>

            {/* Daily Schedule Table */}
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="timetable-grid">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Period</th>
                    <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Time</th>
                    <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Subject & Teacher</th>
                    <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Room</th>
                    <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((timeSlot: TimeSlot) => {
                    const entry = getTimetableEntry(timeSlot.period);
                    return (
                      <tr key={timeSlot.period} className={`border-b border-border hover:bg-muted/20 transition-colors ${timeSlot.isBreak ? 'bg-orange-50' : ''}`}>
                        <td className="py-5 px-6 font-semibold text-lg">
                          {timeSlot.isBreak ? (
                            <i className="fas fa-coffee text-orange-600"></i>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                              {getTeachingPeriodNumber(timeSlot.period)}
                            </span>
                          )}
                        </td>
                        <td className="py-5 px-6 font-medium text-muted-foreground">
                          {formatTime12Hour(timeSlot.startTime)} - {formatTime12Hour(timeSlot.endTime)}
                        </td>
                        {timeSlot.isBreak ? (
                          <>
                            <td className="py-5 px-6 font-semibold text-orange-800">
                              <i className="fas fa-coffee mr-2"></i>
                              Break Time
                            </td>
                            <td className="py-5 px-6 text-muted-foreground">—</td>
                            <td className="py-5 px-6">
                              <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium">
                                Break
                              </span>
                            </td>
                          </>
                        ) : entry ? (
                          <>
                            <td className="py-5 px-6">
                              <div className="rounded-lg p-4 border-2 bg-blue-50 border-blue-200">
                                <div className="font-semibold text-base mb-1 text-blue-900">
                                  {entry.subject?.name || entry.subjectName || 'Subject'}
                                </div>
                                <div className="text-sm opacity-90 text-blue-700">
                                  <i className="fas fa-user mr-1"></i>
                                  {viewMode === "class" 
                                    ? (entry.teacher?.name || entry.teacherName || 'Teacher')
                                    : (entry.className || `${entry.class?.grade}-${entry.class?.section}` || 'Class')
                                  }
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6 font-medium">
                              {entry.room ? (
                                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                                  <i className="fas fa-door-open mr-1"></i>
                                  {entry.room}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-5 px-6">
                              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                                <i className="fas fa-check mr-1"></i>
                                Scheduled
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-5 px-6">
                              <div className="text-center py-4 px-6 text-muted-foreground rounded-lg border-2 border-dashed border-gray-200">
                                <i className="fas fa-calendar-times mb-2 text-2xl text-gray-300"></i>
                                <div className="font-medium">Free Period</div>
                                <div className="text-xs">No class scheduled</div>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-muted-foreground">—</td>
                            <td className="py-5 px-6">
                              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                                <i className="fas fa-clock mr-1"></i>
                                Free
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Timetable Changes Section */}
        {selectedClass && (
          <TimetableChanges classId={selectedClass} selectedDate={selectedDate.toISOString().split('T')[0]} />
        )}
      </div>
    </div>
  );
}