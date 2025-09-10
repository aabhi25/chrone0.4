import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Clock, Save, Plus, Trash2, Settings, Grid3X3, List } from "lucide-react";
import type { TimetableStructure, InsertTimetableStructure } from "@shared/schema";

interface TimeSlot {
  period: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

const defaultWorkingDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Function to sort working days in proper order
const sortWorkingDays = (days: string[]): string[] => {
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return dayOrder.filter(day => days.includes(day));
};

const defaultTimeSlots: TimeSlot[] = [
  { period: 1, startTime: "07:30", endTime: "08:15" },
  { period: 2, startTime: "08:15", endTime: "09:00" },
  { period: 3, startTime: "09:00", endTime: "09:45" },
  { period: 4, startTime: "09:45", endTime: "10:15" },
  { period: 5, startTime: "10:15", endTime: "11:00", isBreak: true },
  { period: 6, startTime: "11:00", endTime: "11:45" },
  { period: 7, startTime: "11:45", endTime: "12:30" },
  { period: 8, startTime: "12:30", endTime: "13:15" },
];

export default function TimetableStructurePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<'settings' | 'grid'>('settings');
  const [structure, setStructure] = useState<InsertTimetableStructure>({
    schoolId: user?.schoolId || "", 
    periodsPerDay: 8,
    workingDays: defaultWorkingDays,
    timeSlots: defaultTimeSlots,
  });

  // Update structure when user context changes
  useEffect(() => {
    if (user?.schoolId) {
      setStructure(prev => ({
        ...prev,
        schoolId: user.schoolId
      }));
    }
  }, [user?.schoolId]);

  // Fetch current timetable structure
  const { data: currentStructure, isLoading } = useQuery({
    queryKey: ["/api/timetable-structure"],
    enabled: !!user?.schoolId,
  });

  // Update local structure when data is fetched
  useEffect(() => {
    if (currentStructure && typeof currentStructure === 'object' && 'id' in currentStructure && currentStructure.id) {
      const typedStructure = currentStructure as TimetableStructure;
      setStructure({
        schoolId: typedStructure.schoolId,
        periodsPerDay: typedStructure.periodsPerDay,
        workingDays: typedStructure.workingDays,
        timeSlots: typedStructure.timeSlots,
        isActive: typedStructure.isActive,
      });
    }
  }, [currentStructure]);

  // Update structure mutation
  const updateStructureMutation = useMutation({
    mutationFn: (data: InsertTimetableStructure) =>
      apiRequest("POST", "/api/timetable-structure", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Timetable structure updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/timetable-structure"] });
      setEditMode(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update timetable structure",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateStructureMutation.mutate(structure);
  };

  // Format time to 12-hour format with AM/PM
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Helper function to calculate teaching period number (excluding breaks)
  const getTeachingPeriodNumber = (actualPeriod: number): number => {
    if (!structure?.timeSlots) return actualPeriod;
    
    // Count only non-break periods up to the current period
    let teachingPeriodCount = 0;
    for (const slot of structure.timeSlots) {
      if (slot.period <= actualPeriod && !slot.isBreak) {
        teachingPeriodCount++;
      }
    }
    return teachingPeriodCount;
  };

  const addTimeSlot = () => {
    const timeSlots = structure.timeSlots || [];
    const newPeriod = timeSlots.length + 1;
    const lastSlot = timeSlots[timeSlots.length - 1];
    const newStartTime = lastSlot ? lastSlot.endTime : "09:00";
    
    setStructure(prev => ({
      ...prev,
      timeSlots: [
        ...(prev.timeSlots || []),
        { period: newPeriod, startTime: newStartTime, endTime: "09:45" }
      ],
      periodsPerDay: (prev.periodsPerDay || 0) + 1,
    }));
  };

  const removeTimeSlot = (index: number) => {
    setStructure(prev => ({
      ...prev,
      timeSlots: (prev.timeSlots || []).filter((_, i) => i !== index),
      periodsPerDay: (prev.periodsPerDay || 0) - 1,
    }));
  };

  const updateTimeSlot = (index: number, field: keyof TimeSlot, value: string | boolean) => {
    setStructure(prev => ({
      ...prev,
      timeSlots: (prev.timeSlots || []).map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const toggleWorkingDay = (day: string) => {
    const workingDays = structure.workingDays || [];
    setStructure(prev => ({
      ...prev,
      workingDays: (prev.workingDays || []).includes(day)
        ? (prev.workingDays || []).filter(d => d !== day)
        : [...(prev.workingDays || []), day],
    }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Clock className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Time Table Structure</h1>
        </div>
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="timetable-structure-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Clock className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Time Table Structure</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? "default" : "outline"}
            onClick={() => setViewMode('grid')}
            data-testid="button-grid-view"
          >
            <Grid3X3 className="h-4 w-4 mr-2" />
            Grid View
          </Button>
          
          {viewMode === 'settings' && (
            <>
              <Button
                variant={editMode ? "outline" : "default"}
                onClick={() => setEditMode(!editMode)}
                data-testid="button-edit-mode"
              >
                <Settings className="h-4 w-4 mr-2" />
                {editMode ? "Cancel" : "Edit Structure"}
              </Button>
              {editMode && (
                <Button
                  onClick={handleSave}
                  disabled={updateStructureMutation.isPending}
                  data-testid="button-save-structure"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              )}
            </>
          )}
          
          {viewMode === 'grid' && (
            <Button
              variant="outline"
              onClick={() => setViewMode('settings')}
              data-testid="button-back-to-settings"
            >
              <List className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'settings' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Working Days Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Working Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {defaultWorkingDays.map((day) => (
                <div key={day} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={day}
                    checked={(structure.workingDays || []).includes(day)}
                    onChange={() => editMode && toggleWorkingDay(day)}
                    disabled={!editMode}
                    className="rounded"
                    data-testid={`checkbox-${day}`}
                  />
                  <Label htmlFor={day} className="capitalize">
                    {day}
                  </Label>
                  {(structure.workingDays || []).includes(day) && (
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Total Working Days: <span className="font-medium">{(structure.workingDays || []).length}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Periods per Day</span>
                <Badge variant="outline">{structure.periodsPerDay || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Working Days</span>
                <Badge variant="outline">{(structure.workingDays || []).length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Periods/Week</span>
                <Badge variant="default">{(structure.periodsPerDay || 0) * (structure.workingDays || []).length}</Badge>
              </div>
              {(structure.timeSlots || []).length > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">School Starts</span>
                    <span className="font-medium">{formatTime12Hour((structure.timeSlots || [])[0]?.startTime || '07:30')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">School Ends</span>
                    <span className="font-medium">{formatTime12Hour((structure.timeSlots || [])[(structure.timeSlots || []).length - 1]?.endTime || '15:30')}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Period Structure */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Period Structure
              {editMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addTimeSlot}
                  data-testid="button-add-period"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Period
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(structure.timeSlots || []).map((slot, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded-lg ${slot.isBreak ? 'bg-orange-50 border-orange-200' : 'bg-gray-50'}`}
                  data-testid={`period-slot-${index}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {slot.isBreak ? 'Break' : `Period ${getTeachingPeriodNumber(slot.period)}`}
                    </span>
                    {editMode && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTimeSlot(index)}
                        data-testid={`button-remove-period-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`start-${index}`} className="text-xs">Start Time</Label>
                      <Input
                        id={`start-${index}`}
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(index, 'startTime', e.target.value)}
                        disabled={!editMode}
                        className="text-sm"
                        data-testid={`input-start-time-${index}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`end-${index}`} className="text-xs">End Time</Label>
                      <Input
                        id={`end-${index}`}
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(index, 'endTime', e.target.value)}
                        disabled={!editMode}
                        className="text-sm"
                        data-testid={`input-end-time-${index}`}
                      />
                    </div>
                  </div>
                  
                  {editMode && (
                    <div className="mt-2">
                      <label className="flex items-center space-x-2 text-xs">
                        <input
                          type="checkbox"
                          checked={slot.isBreak || false}
                          onChange={(e) => updateTimeSlot(index, 'isBreak', e.target.checked)}
                          data-testid={`checkbox-break-${index}`}
                        />
                        <span>Mark as Break</span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </div>
      ) : (
        // Grid View
        <div className="w-full">
          <Card>
            <CardHeader>
              <CardTitle>Timetable Structure Grid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="border border-gray-300 p-2 text-left font-semibold">Period</th>
                      <th className="border border-gray-300 p-2 text-left font-semibold">Time</th>
                      {sortWorkingDays(structure.workingDays || []).map((day) => (
                        <th key={day} className="border border-gray-300 p-2 text-center font-semibold capitalize bg-blue-500 text-white">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(structure.timeSlots || []).map((slot, index) => (
                      <tr key={index} className={slot.isBreak ? 'bg-orange-50' : 'bg-gray-50'}>
                        <td className="border border-gray-300 p-2 font-medium">
                          {slot.isBreak ? 'Break' : getTeachingPeriodNumber(slot.period)}
                        </td>
                        <td className="border border-gray-300 p-2 text-sm">
                          {formatTime12Hour(slot.startTime)} - {formatTime12Hour(slot.endTime)}
                        </td>
                        {sortWorkingDays(structure.workingDays || []).map((day) => (
                          <td key={day} className="border border-gray-300 p-2 text-center">
                            {slot.isBreak ? (
                              <div className="text-orange-600 font-medium">BREAK</div>
                            ) : (
                              <div className="h-8 bg-blue-100 rounded flex items-center justify-center text-xs">
                                Period {getTeachingPeriodNumber(slot.period)}
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Grid Summary */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Structure Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Periods per Day:</span>
                    <span className="font-medium ml-1">{structure.periodsPerDay || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Working Days:</span>
                    <span className="font-medium ml-1">{(structure.workingDays || []).length}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Periods/Week:</span>
                    <span className="font-medium ml-1">{(structure.periodsPerDay || 0) * (structure.workingDays || []).length}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium ml-1">
                      {(structure.timeSlots || []).length > 0 && 
                        `${formatTime12Hour((structure.timeSlots || [])[0]?.startTime || '07:30')} - ${formatTime12Hour((structure.timeSlots || [])[(structure.timeSlots || []).length - 1]?.endTime || '15:30')}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}