import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, User, AlertTriangle, TrendingUp, Settings, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface Teacher {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  maxDailyPeriods: number;
  isActive: boolean;
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

interface WorkloadAnalytics {
  teachers: Array<{
    teacherId: string;
    teacherName: string;
    weeklyPeriods: number;
    avgDailyPeriods: number;
    maxDailyPeriods: number;
    maxAllowedDaily: number;
    isOverloaded: boolean;
    dailyBreakdown: Record<string, number>;
  }>;
  summary: {
    totalTeachers: number;
    overloadedTeachers: number;
    avgWeeklyPeriods: number;
  };
}

export default function TeacherSchedulePage() {
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'schedule' | 'analytics' | 'availability'>('schedule');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [configMaxPeriods, setConfigMaxPeriods] = useState<number>(6);
  const [applyToAll, setApplyToAll] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Fetch teachers
  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: async (): Promise<Teacher[]> => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/teachers', {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch teachers');
      return response.json();
    }
  });

  // Fetch teacher schedule
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
    queryKey: ['teacher-schedule', selectedTeacher, selectedDate],
    queryFn: async (): Promise<TimetableEntry[]> => {
      if (!selectedTeacher) return [];
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/teachers/${selectedTeacher}/schedule?date=${selectedDate}`, {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch schedule');
      const data = await response.json();
      
      return data;
    },
    enabled: !!selectedTeacher
  });

  // Fetch workload analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['teacher-workload-analytics'],
    queryFn: async (): Promise<WorkloadAnalytics> => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/analytics/teacher-workload', {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    }
  });

  // Fetch free teachers for today
  const { data: freeTeachersData, isLoading: freeTeachersLoading } = useQuery({
    queryKey: ['free-teachers-today', selectedDate],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/availability/free-teachers?date=${selectedDate}`, {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch free teachers');
      return response.json();
    },
    enabled: viewMode === 'availability'
  });

  // Fetch absent teacher alerts
  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['absent-teacher-alerts', selectedDate],
    queryFn: async (): Promise<any[]> => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/substitutions/alerts?date=${selectedDate}`, {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    }
  });

  // Fetch timetable structure
  const { data: timetableStructure, isLoading: timetableLoading } = useQuery({
    queryKey: ['timetable-structure'],
    queryFn: async (): Promise<any> => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/timetable-structure', {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch timetable structure');
      return response.json();
    }
  });

  // Fetch subjects
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async (): Promise<any[]> => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/subjects', {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch subjects');
      return response.json();
    }
  });

  // Update daily periods mutation
  const updateDailyPeriodsMutation = useMutation({
    mutationFn: async (data: { teacherId?: string; maxDailyPeriods: number; applyToAll: boolean }) => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/teachers/daily-periods', {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update daily periods');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-workload-analytics'] });
      setShowConfig(false);
      setApplyToAll(false);
    }
  });

  // Get working days from timetable structure
  const workingDays = timetableStructure?.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const days = workingDays;
  
  // Get time slots from timetable structure, fallback to default 8 periods
  const periods = timetableStructure?.timeSlots || [
    { period: 1, startTime: "07:30", endTime: "08:15" },
    { period: 2, startTime: "08:15", endTime: "09:00" },
    { period: 3, startTime: "09:00", endTime: "09:45" },
    { period: 4, startTime: "09:45", endTime: "10:15" },
    { period: 5, startTime: "10:15", endTime: "11:00", isBreak: true },
    { period: 6, startTime: "11:00", endTime: "11:45" },
    { period: 7, startTime: "11:45", endTime: "12:30" },
    { period: 8, startTime: "12:30", endTime: "13:15" }
  ];

  // Helper function to calculate teaching period number (excluding breaks)
  const getTeachingPeriodNumber = (actualPeriod: number): number => {
    if (!periods) return actualPeriod;
    
    // Count only non-break periods up to the current period
    let teachingPeriodCount = 0;
    for (const slot of periods) {
      if (slot.period <= actualPeriod && !slot.isBreak) {
        teachingPeriodCount++;
      }
    }
    return teachingPeriodCount;
  };

  // Check if selected date is a working day
  const selectedDateObj = new Date(selectedDate);
  const selectedDayOfWeek = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const isWorkingDay = workingDays.includes(selectedDayOfWeek);

  const getScheduleForDay = (day: string) => {
    return schedule.filter(entry => entry.day === day).sort((a, b) => a.period - b.period);
  };

  const getDailyPeriodCount = (day: string) => {
    // Only count actual teaching periods, not breaks
    return getScheduleForDay(day).filter(entry => !periods.find((p: any) => p.period === entry.period)?.isBreak).length;
  };

  const selectedTeacherData = teachers.find(t => t.id === selectedTeacher);
  const isOverloaded = selectedTeacherData && analytics?.teachers.find(t => t.teacherId === selectedTeacher)?.isOverloaded;

  const renderScheduleView = () => (
    <div className="space-y-6">
      {/* Teacher Selection */}
      <div className="flex gap-4 items-center">
        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a teacher" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map(teacher => (
              <SelectItem key={teacher.id} value={teacher.id}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {teacher.name}
                  {analytics?.teachers.find(t => t.teacherId === teacher.id)?.isOverloaded && (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-40"
        />
      </div>

      {selectedTeacher && selectedTeacherData && (
        <>
          {/* Teacher Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedTeacherData.name}
                {isOverloaded && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Overloaded
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{selectedTeacherData.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Max Daily Periods</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{selectedTeacherData.maxDailyPeriods}</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setConfigMaxPeriods(selectedTeacherData.maxDailyPeriods);
                        setShowConfig(true);
                      }}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTeacherData.subjects.map((subjectId, index) => {
                      const subject = subjects.find((s: any) => s.id === subjectId);
                      return (
                        <Badge key={index} variant="secondary">
                          {subject ? subject.name : subjectId}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isWorkingDay ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    School is Closed
                  </h3>
                  <p className="text-gray-600 mb-1">
                    {selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} is not a working day for the school.
                  </p>
                  <p className="text-sm text-gray-500">
                    Working days: {workingDays.map((day: string) => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-50">Period & Time</th>
                      {days.map((day: string) => (
                        <th key={day} className="border p-2 bg-gray-50 capitalize">
                          <div className="flex flex-col items-center">
                            <span>{day}</span>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs">
                                {getDailyPeriodCount(day)}/{selectedTeacherData.maxDailyPeriods}
                              </span>
                              {getDailyPeriodCount(day) > selectedTeacherData.maxDailyPeriods && (
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((periodData: any) => {
                      const periodNumber = typeof periodData === 'number' ? periodData : periodData.period;
                      const periodTime = typeof periodData === 'object' ? `${periodData.startTime}-${periodData.endTime}` : '';
                      const isBreak = typeof periodData === 'object' ? periodData.isBreak : false;
                      
                      // Format period display based on school structure
                      const periodDisplayNumber = isBreak ? '' : `P${getTeachingPeriodNumber(periodNumber)}`;
                      
                      return (
                        <tr key={periodNumber}>
                          <td className="border p-2 text-center font-medium bg-gray-50">
                            <div className="text-sm">
                              <div className="font-semibold">
                                {isBreak ? 'Break Time' : periodDisplayNumber}
                              </div>
                              {periodTime && (
                                <div className="text-xs text-gray-600">
                                  {periodTime.replace(':', ':').replace('-', ' - ')}
                                </div>
                              )}
                            </div>
                          </td>
                          {days.map((day: string) => {
                            if (isBreak) {
                              return (
                                <td key={`${day}-${periodNumber}`} className="border p-2 text-center bg-orange-50">
                                  <span className="text-orange-600 text-sm font-medium">🕘 Break Time</span>
                                </td>
                              );
                            }
                            
                            const entry = schedule.find(s => s.day === day && s.period === periodNumber);
                            return (
                              <td key={`${day}-${periodNumber}`} className="border p-2 text-center">
                                {entry ? (
                                  <div className="text-xs">
                                    <div className="font-medium">
                                      {entry.subject?.code || entry.subject?.name || `Subject ID: ${entry.subjectId}`}
                                    </div>
                                    <div className="text-gray-600">
                                      Class {entry.class?.grade || '?'}{entry.class?.section || ''}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">Free Period</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Absent Teacher Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{alert.teacher.name}</strong> is {alert.attendance.status} today.
                    {alert.affectedClasses > 0 && (
                      <span> Affects {alert.affectedClasses} scheduled classes.</span>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Max Daily Periods Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure Max Daily Periods</DialogTitle>
            <DialogDescription>
              Set the maximum number of periods a teacher can be assigned per day.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="maxPeriods" className="text-right">
                Max Periods
              </Label>
              <Input
                id="maxPeriods"
                type="number"
                min="1"
                max="10"
                value={configMaxPeriods}
                onChange={(e) => setConfigMaxPeriods(Number(e.target.value))}
                className="col-span-3"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="applyToAll"
                checked={applyToAll}
                onCheckedChange={(checked) => setApplyToAll(checked as boolean)}
              />
              <Label htmlFor="applyToAll" className="text-sm font-medium">
                Apply to all teachers in school
              </Label>
            </div>
            {applyToAll && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ This will update the max daily periods for ALL teachers in your school.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfig(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                updateDailyPeriodsMutation.mutate({
                  teacherId: applyToAll ? undefined : selectedTeacher,
                  maxDailyPeriods: configMaxPeriods,
                  applyToAll
                });
              }}
              disabled={updateDailyPeriodsMutation.isPending}
            >
              {updateDailyPeriodsMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-6">
      {analytics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Total Teachers</p>
                    <p className="text-2xl font-bold">{analytics.summary.totalTeachers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-gray-600">Overloaded Teachers</p>
                    <p className="text-2xl font-bold">{analytics.summary.overloadedTeachers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">Avg Weekly Periods</p>
                    <p className="text-2xl font-bold">{Math.round(analytics.summary.avgWeeklyPeriods * 10) / 10}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Teacher Workload Table */}
          <Card>
            <CardHeader>
              <CardTitle>Teacher Workload Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Teacher</th>
                      <th className="text-left p-2">Weekly Periods</th>
                      <th className="text-left p-2">Max Daily</th>
                      <th className="text-left p-2">Limit</th>
                      <th className="text-left p-2">Utilization</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.teachers.map(teacher => {
                      const utilizationPercent = (teacher.maxDailyPeriods / teacher.maxAllowedDaily) * 100;
                      return (
                        <tr key={teacher.teacherId} className="border-b">
                          <td className="p-2 font-medium">{teacher.teacherName}</td>
                          <td className="p-2">{teacher.weeklyPeriods}</td>
                          <td className="p-2">{teacher.maxDailyPeriods}</td>
                          <td className="p-2">{teacher.maxAllowedDaily}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Progress value={utilizationPercent} className="w-20" />
                              <span className="text-sm">{Math.round(utilizationPercent)}%</span>
                            </div>
                          </td>
                          <td className="p-2">
                            {teacher.isOverloaded ? (
                              <Badge variant="destructive">Overloaded</Badge>
                            ) : (
                              <Badge variant="secondary">Normal</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  // Render availability view showing free teachers by period
  const renderAvailabilityView = () => (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Free Teachers Today</h2>
            <p className="text-sm text-muted-foreground">
              Available teachers for {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date">Date:</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {freeTeachersData && freeTeachersData.periods ? (
        <div className="space-y-4">
          {freeTeachersData.periods.map((periodData: any) => (
            <Card key={periodData.period} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Period {periodData.period}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{periodData.startTime} - {periodData.endTime}</span>
                    <Badge variant="outline">
                      {periodData.freeTeachers.length} teacher{periodData.freeTeachers.length !== 1 ? 's' : ''} available
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {periodData.freeTeachers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {periodData.freeTeachers.map((teacher: any) => (
                      <div 
                        key={teacher.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{teacher.name}</div>
                            <div className="text-xs text-muted-foreground">{teacher.email}</div>
                          </div>
                        </div>
                        {teacher.subjects && teacher.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {teacher.subjects.slice(0, 2).map((subject: string, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {subject}
                              </Badge>
                            ))}
                            {teacher.subjects.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{teacher.subjects.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No teachers available for this period
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No availability data found for the selected date</p>
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teacher Schedule Management</h1>
        
        {/* View Mode Selector */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'schedule' ? 'default' : 'outline'}
            onClick={() => setViewMode('schedule')}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Schedule
          </Button>
          <Button
            variant={viewMode === 'analytics' ? 'default' : 'outline'}
            onClick={() => setViewMode('analytics')}
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Analytics
          </Button>
          <Button
            variant={viewMode === 'availability' ? 'default' : 'outline'}
            onClick={() => setViewMode('availability')}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Free Teachers
          </Button>
        </div>
      </div>

      {teachersLoading || scheduleLoading || analyticsLoading || timetableLoading || subjectsLoading || freeTeachersLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'schedule' && renderScheduleView()}
          {viewMode === 'analytics' && renderAnalyticsView()}
          {viewMode === 'availability' && renderAvailabilityView()}
        </>
      )}
    </div>
  );
}