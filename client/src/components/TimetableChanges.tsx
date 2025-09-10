import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, Mail, Phone, BookOpen, Users, IdCard, Info, X } from "lucide-react";

interface TimetableChange {
  id: string;
  timetableEntryId: string;
  changeType: "substitution" | "cancellation" | "room_change" | "time_change";
  changeDate: string;
  originalTeacherId?: string;
  newTeacherId?: string;
  originalRoom?: string;
  newRoom?: string;
  reason: string;
  changeSource: "manual" | "auto_absence" | "auto_substitution";
  approvedBy?: string;
  approvedAt?: string;
  isActive: boolean;
  createdAt: string;
}

interface TimetableChangesProps {
  classId?: string;
  selectedDate?: string;
  onClassSelect?: (classId: string) => void;
}

export function TimetableChanges({ classId, selectedDate, onClassSelect }: TimetableChangesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentDate = selectedDate || new Date().toISOString().split('T')[0];
  const [processingChanges, setProcessingChanges] = useState<Set<string>>(new Set());
  const [rejectedChanges, setRejectedChanges] = useState<Set<string>>(new Set());
  const [approvedChanges, setApprovedChanges] = useState<Set<string>>(new Set());
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const { data: changes = [], isLoading, error } = useQuery({
    queryKey: ["timetable-changes", user?.schoolId, currentDate],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      
      const params = new URLSearchParams({
        schoolId: user.schoolId,
        date: currentDate
      });
      
      const response = await apiRequest("GET", `/api/timetable-changes/active?${params}`);
      return response.json();
    },
    enabled: !!user?.schoolId && (user.role === 'admin' || user.role === 'super_admin'),
    refetchInterval: 5000, // Refresh every 5 seconds for faster updates
  });

  // Fetch teachers data for teacher details modal
  const { data: teachers = [] } = useQuery({
    queryKey: ["/api/teachers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teachers");
      return response.json();
    },
    enabled: !!user?.schoolId,
  });

  // Fetch classes data for teacher details modal
  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/classes");
      return response.json();
    },
  });

  // Fetch subjects data for teacher details modal
  const { data: subjects = [] } = useQuery({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subjects");
      return response.json();
    },
  });

  // Fetch timetable entries to identify affected classes
  const { data: timetableEntries = [] } = useQuery({
    queryKey: ["/api/timetable/detailed"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable/detailed");
      return response.json();
    },
  });

  // Fetch timetable structure for period numbering logic
  const { data: timetableStructure } = useQuery({
    queryKey: ["/api/timetable-structure"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable-structure");
      return response.json();
    },
    enabled: !!user?.schoolId,
  });

  // Get selected teacher details
  const selectedTeacher = teachers.find((t: any) => t.id === selectedTeacherId);

  // Helper function to get timetable entry details for a change
  const getTimetableEntryDetails = (change: TimetableChange) => {
    const entry = timetableEntries.find((entry: any) => entry.id === change.timetableEntryId);
    return entry;
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

  // Helper function to format date and period information
  const formatDateAndPeriod = (change: TimetableChange) => {
    const entry = getTimetableEntryDetails(change);
    const date = new Date(change.changeDate);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    if (entry) {
      const teachingPeriodNum = getTeachingPeriodNumber(entry.period);
      return `${formattedDate}, Period ${teachingPeriodNum} (${entry.startTime} - ${entry.endTime})`;
    }
    return `${formattedDate}`;
  };

  // Function to get affected classes for each change
  const getAffectedClasses = (change: TimetableChange) => {
    // Find timetable entries that match this change
    const affectedEntries = timetableEntries.filter((entry: any) => 
      entry.teacherId === change.originalTeacherId
    );
    
    // Get unique classes from affected entries
    const uniqueClasses = new Map();
    affectedEntries.forEach((entry: any) => {
      if (entry.classId && !uniqueClasses.has(entry.classId)) {
        const classData = classes.find((c: any) => c.id === entry.classId);
        if (classData) {
          uniqueClasses.set(entry.classId, classData);
        }
      }
    });
    
    return Array.from(uniqueClasses.values());
  };

  // Mutation for approving changes
  const approveMutation = useMutation({
    mutationFn: async (changeId: string) => {
      const response = await apiRequest("POST", `/api/timetable-changes/${changeId}/approve`);
      return response.json();
    },
    onSuccess: (data, changeId) => {
      toast({
        title: "Change Approved",
        description: "The substitution is now active and the notification has been cleared.",
        variant: "default"
      });
      setProcessingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(changeId);
        return newSet;
      });
      // Refresh the changes list to sync with backend
      queryClient.invalidateQueries({ queryKey: ["/api/timetable-changes/active"] });
    },
    onError: (error, changeId) => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve the timetable change. Please try again.",
        variant: "destructive"
      });
      setProcessingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(changeId);
        return newSet;
      });
      // Put the card back if approval failed
      setApprovedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(changeId);
        return newSet;
      });
    }
  });

  // Mutation for rejecting changes
  const rejectMutation = useMutation({
    mutationFn: async ({ changeId, reason }: { changeId: string; reason?: string }) => {
      const response = await apiRequest("POST", `/api/timetable-changes/${changeId}/reject`, { reason });
      return response.json();
    },
    onSuccess: (data, { changeId }) => {
      toast({
        title: "Change Rejected",
        description: "The substitution has been permanently removed.",
        variant: "default"
      });
      setProcessingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(changeId);
        return newSet;
      });
      // Refresh the changes list to sync with backend
      queryClient.invalidateQueries({ queryKey: ["/api/timetable-changes/active"] });
    },
    onError: (error, { changeId }) => {
      toast({
        title: "Rejection Failed",
        description: "Failed to reject the timetable change. Please try again.",
        variant: "destructive"
      });
      setProcessingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(changeId);
        return newSet;
      });
      // Put the card back if rejection failed
      setRejectedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(changeId);
        return newSet;
      });
    }
  });

  // Mutation for permanently deleting changes
  const deleteMutation = useMutation({
    mutationFn: async (changeId: string) => {
      const response = await apiRequest("DELETE", `/api/timetable-changes/${changeId}`);
      return response;
    },
    onSuccess: (data, changeId) => {
      toast({
        title: "Change Removed",
        description: "The timetable change has been permanently removed.",
        variant: "default"
      });
      // Refresh the changes list
      queryClient.invalidateQueries({ queryKey: ["timetable-changes"] });
    },
    onError: (error, changeId) => {
      toast({
        title: "Removal Failed",
        description: "Failed to remove the timetable change. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Handler for permanently dismissing/deleting changes
  const handleDismissChange = (changeId: string) => {
    deleteMutation.mutate(changeId);
  };

  const handleApprove = (changeId: string) => {
    // Immediately hide the card for instant feedback
    setApprovedChanges(prev => new Set([...Array.from(prev), changeId]));
    setProcessingChanges(prev => new Set([...Array.from(prev), changeId]));
    approveMutation.mutate(changeId);
  };

  const handleReject = (changeId: string) => {
    // Immediately hide the card for instant feedback
    setRejectedChanges(prev => new Set([...Array.from(prev), changeId]));
    setProcessingChanges(prev => new Set([...Array.from(prev), changeId]));
    rejectMutation.mutate({ changeId, reason: undefined });
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case "substitution": return "fas fa-user-friends";
      case "cancellation": return "fas fa-times-circle";
      case "room_change": return "fas fa-door-open";
      case "time_change": return "fas fa-clock";
      default: return "fas fa-edit";
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case "substitution": return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancellation": return "bg-red-100 text-red-800 border-red-200";
      case "room_change": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "time_change": return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "auto_absence": return "bg-orange-100 text-orange-800";
      case "auto_substitution": return "bg-green-100 text-green-800";
      case "manual": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Function to find teacher by name and return clickable link
  const createTeacherLink = (teacherName: string, className: string = ""): JSX.Element => {
    const teacher = teachers.find((t: any) => t.name === teacherName.trim());
    if (teacher) {
      return (
        <button
          onClick={() => setSelectedTeacherId(teacher.id)}
          className={`text-blue-600 hover:text-blue-800 underline font-medium ${className}`}
          type="button"
        >
          {teacherName}
        </button>
      );
    }
    return <span className={className}>{teacherName}</span>;
  };

  // Function to create clickable class links
  const createClassLink = (className: string, classId: string): JSX.Element => {
    return (
      <Link 
        href={`/timetable?classId=${classId}`}
        className="text-blue-600 hover:text-blue-800 underline font-medium"
      >
        {className}
      </Link>
    );
  };

  // Function to format class name with grade and section
  const formatClassName = (classData: any): string => {
    if (!classData) return 'Unknown Class';
    
    const grade = classData.grade || '';
    const section = classData.section || '';
    
    if (section) {
      return `Class ${grade}-${section}`;
    } else {
      return `Class ${grade}`;
    }
  };

  // Function to get the specific class for a timetable change
  const getSpecificClassForChange = (change: TimetableChange) => {
    // Check if the API response includes flat class fields
    const changeData = change as any;
    if (changeData.affectedClassId) {
      return {
        id: changeData.affectedClassId,
        grade: changeData.affectedClassGrade,
        section: changeData.affectedClassSection,
        studentCount: changeData.affectedClassStudentCount,
        room: changeData.affectedClassRoom
      };
    }
    
    // First try to use the affectedClass data included directly in the response (legacy)
    const affectedClass = changeData.affectedClass;
    if (affectedClass) {
      return affectedClass;
    }
    
    // Fallback to the old method for backward compatibility
    const entryId = changeData.timetableEntryId || changeData.timetable_entry_id;
    
    if (!entryId) {
      return null;
    }
    
    // Find the timetable entry that matches this change
    const timetableEntry = timetableEntries.find((entry: any) => 
      entry.id === entryId
    );
    
    if (timetableEntry) {
      // Try both camelCase and snake_case field names for class ID
      const classId = timetableEntry.classId || timetableEntry.class_id;
      
      if (classId) {
        // Find the class data
        const classData = classes.find((c: any) => c.id === classId);
        return classData;
      }
    }
    
    return null;
  };

  // Function to parse reason text and make teacher names clickable
  const parseReasonWithClickableTeachers = (reason: string): JSX.Element => {
    // Pattern to match teacher names in the reason text
    // Examples: "Auto-assigned substitute: Anil", "Teacher absence: John Smith"
    const teacherPattern = /(?:substitute:|absence:|teacher:)\s*([A-Za-z\s]+)(?:[.,]|$)/gi;
    
    let lastIndex = 0;
    const elements: JSX.Element[] = [];
    let match;
    let keyIndex = 0;

    while ((match = teacherPattern.exec(reason)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        elements.push(
          <span key={`text-${keyIndex++}`}>
            {reason.slice(lastIndex, match.index)}
          </span>
        );
      }
      
      // Add the matched text with clickable teacher name
      const fullMatch = match[0];
      const teacherName = match[1].trim();
      const prefix = fullMatch.replace(match[1], '').replace(/[.,]$/, '');
      
      elements.push(
        <span key={`teacher-${keyIndex++}`}>
          {prefix}
          {createTeacherLink(teacherName)}
          {fullMatch.endsWith(',') ? ',' : fullMatch.endsWith('.') ? '.' : ''}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after the last match
    if (lastIndex < reason.length) {
      elements.push(
        <span key={`text-${keyIndex++}`}>
          {reason.slice(lastIndex)}
        </span>
      );
    }
    
    return <>{elements}</>;
  };

  const formatChangeDescription = (change: TimetableChange): JSX.Element => {
    // Get teacher names from IDs
    const originalTeacher = teachers.find((t: any) => t.id === change.originalTeacherId);
    const newTeacher = teachers.find((t: any) => t.id === change.newTeacherId);
    
    // Get the specific class for this change
    const specificClass = getSpecificClassForChange(change);

    switch (change.changeType) {
      case "substitution":
        return (
          <span>
            {originalTeacher ? (
              <>
                {createTeacherLink(originalTeacher.name)} is absent.{" "}
              </>
            ) : (
              "Unknown teacher is absent. "
            )}
            {newTeacher && specificClass ? (
              <>
                {createTeacherLink(newTeacher.name)} has been auto-assigned as substitute for {formatClassName(specificClass)}.
              </>
            ) : newTeacher ? (
              <>
                {createTeacherLink(newTeacher.name)} has been auto-assigned as substitute.
              </>
            ) : null}
            <br />
            <span className="text-xs text-black">Date & Period: {formatDateAndPeriod(change)}</span>
          </span>
        );
      case "cancellation":
        return <span>Class cancelled - {parseReasonWithClickableTeachers(change.reason)}</span>;
      case "room_change":
        return (
          <span>
            Room changed from {change.originalRoom} to {change.newRoom} - {parseReasonWithClickableTeachers(change.reason)}
          </span>
        );
      case "time_change":
        return <span>Time slot modified - {parseReasonWithClickableTeachers(change.reason)}</span>;
      default:
        return <span>{parseReasonWithClickableTeachers(change.reason)}</span>;
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null; // Only show to admins
  }

  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <i className="fas fa-sync fa-spin mr-2"></i>
            Loading Timetable Changes...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg text-red-600 flex items-center">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            Error Loading Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load timetable changes. Please refresh the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter changes based on selected class
  const filteredChanges = (classId ? changes.filter((change: TimetableChange) => {
    const specificClass = getSpecificClassForChange(change);
    return specificClass && specificClass.id === classId;
  }) : changes).filter((change: TimetableChange) => 
    !rejectedChanges.has(change.id) && !approvedChanges.has(change.id)
  ).sort((a: TimetableChange, b: TimetableChange) => {
    // Sort changes by teaching period number (P1, P2, P3, etc.)
    const entryA = getTimetableEntryDetails(a);
    const entryB = getTimetableEntryDetails(b);
    
    if (!entryA && !entryB) return 0;
    if (!entryA) return 1;
    if (!entryB) return -1;
    
    const periodA = getTeachingPeriodNumber(entryA.period);
    const periodB = getTeachingPeriodNumber(entryB.period);
    
    return periodA - periodB;
  });

  // Don't render anything if there are no filtered changes
  if (filteredChanges.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center">
              <i className="fas fa-clipboard-list mr-2"></i>
              Timetable Changes ({filteredChanges.length})
              {classId && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Filtered by Class
                </Badge>
              )}
            </span>
            <Badge variant="secondary" className="text-xs">
              {new Date(currentDate).toLocaleDateString()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredChanges.map((change: TimetableChange) => (
              <div key={change.id} className={`relative p-4 rounded-lg border ${getChangeTypeColor(change.changeType)}`}>
                {/* Dismiss button for approved changes - removes card from UI but keeps substitution active */}
                {change.approvedBy && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                    onClick={() => handleDismissChange(change.id)}
                    title="Dismiss this notification (substitution remains active)"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <i className={`${getChangeTypeIcon(change.changeType)} mr-2`}></i>
                      <span className="font-medium text-sm capitalize">
                        {change.changeType.replace('_', ' ')}
                      </span>
                      <Badge className={`ml-2 text-xs ${getSourceBadgeColor(change.changeSource)}`}>
                        {change.changeSource === 'auto_absence' ? (
                          <div className="flex items-center gap-1">
                            Auto-detected
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Changes marked as "Auto-detected" are created when teacher absences are detected.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ) : change.changeSource === 'auto_substitution' ? 'Auto-assigned' : 'Manual'}
                      </Badge>
                    </div>
                    
                    <div className="text-sm mb-2 bg-yellow-50 border-l-4 border-yellow-300 pl-3 py-2 rounded-r-md">
                      {formatChangeDescription(change)}
                    </div>
                    
                    {/* Show affected class only when no specific class is selected */}
                    {!classId && (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Affected Class:</div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {(() => {
                            const specificClass = getSpecificClassForChange(change);
                            if (specificClass) {
                              const hasSection = specificClass.section && specificClass.section.trim() !== '' && specificClass.section !== '-';
                              const displayName = hasSection 
                                ? `Class ${specificClass.grade}-${specificClass.section}`
                                : `Class ${specificClass.grade}`;
                              
                              // Light red color for the affected class
                              const colorClass = "bg-red-100 text-red-800 hover:bg-red-200";
                              
                              return (
                                <button
                                  onClick={() => onClassSelect?.(specificClass.id)}
                                  className={`${colorClass} px-2 py-1 rounded text-xs transition-colors font-medium`}
                                >
                                  {displayName}
                                </button>
                              );
                            } else {
                              return (
                                <span className="text-xs text-muted-foreground">No class found</span>
                              );
                            }
                          })()}
                        </div>
                        {getSpecificClassForChange(change) && (
                          <div className="text-xs text-muted-foreground italic">
                            💡 Click on the class to view its timetable
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      <span>Created: {new Date(change.createdAt).toLocaleString()}</span>
                      {change.approvedBy && change.approvedAt && (
                        <span className="ml-4">
                          Approved: {new Date(change.approvedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Show approve/reject buttons only when a specific class is selected */}
                  {classId && (
                    <div className="flex flex-col space-y-1 ml-4">
                      {!change.approvedBy && (
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2 text-green-600 border-green-300 hover:bg-green-50"
                            disabled={processingChanges.has(change.id)}
                            onClick={() => handleApprove(change.id)}
                          >
                            {processingChanges.has(change.id) ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-1"></i>
                                Processing...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-check mr-1"></i>
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2 text-red-600 border-red-300 hover:bg-red-50"
                            disabled={processingChanges.has(change.id)}
                            onClick={() => handleReject(change.id)}
                          >
                            {processingChanges.has(change.id) ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-1"></i>
                                Processing...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-times mr-1"></i>
                                Reject
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {change.approvedBy && (
                        <Badge className="text-xs bg-green-100 text-green-800">
                          <i className="fas fa-check mr-1"></i>
                          Approved
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Teacher Details Modal */}
      <Dialog open={!!selectedTeacherId} onOpenChange={() => setSelectedTeacherId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Teacher Details
            </DialogTitle>
            <DialogDescription>
              Comprehensive information about {selectedTeacher?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTeacher && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                      <IdCard className="h-4 w-4" />
                      Basic Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Name:</span>
                        <span>{selectedTeacher.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Email:</span>
                        <span>{selectedTeacher.email || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Contact:</span>
                        <span>{selectedTeacher.contactNumber || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">School ID:</span>
                        <span>{selectedTeacher.schoolIdNumber || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                      <BookOpen className="h-4 w-4" />
                      Subjects Taught
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(selectedTeacher.subjects || []).map((subjectId: string) => {
                        const subject = subjects.find((s: any) => s.id === subjectId);
                        return subject ? (
                          <Badge key={subjectId} className="bg-blue-100 text-blue-800">
                            {subject.name}
                          </Badge>
                        ) : null;
                      })}
                      {(!selectedTeacher.subjects || selectedTeacher.subjects.length === 0) && (
                        <span className="text-muted-foreground text-sm">No subjects assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Classes Taught */}
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" />
                  Classes Taught
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(selectedTeacher.classes || []).map((classId: string) => {
                    const classData = classes.find((c: any) => c.id === classId);
                    if (!classData) return null;
                    
                    const hasSection = classData.section && classData.section.trim() !== '' && classData.section !== '-';
                    const displayName = hasSection 
                      ? `Class ${classData.grade}-${classData.section}`
                      : `Class ${classData.grade}`;
                    
                    return (
                      <Badge key={classId} className="bg-green-100 text-green-800">
                        {displayName}
                      </Badge>
                    );
                  })}
                  {(!selectedTeacher.classes || selectedTeacher.classes.length === 0) && (
                    <span className="text-muted-foreground text-sm">No classes assigned</span>
                  )}
                </div>
              </div>
              
              {/* Teaching Load Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-2">Teaching Load Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Max Weekly Load:</span>
                    <span className="ml-2">{selectedTeacher.maxLoad || 30} periods</span>
                  </div>
                  <div>
                    <span className="font-medium">Max Daily Periods:</span>
                    <span className="ml-2">{selectedTeacher.maxDailyPeriods || 6} periods</span>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <Badge className={selectedTeacher.isActive ? "bg-green-100 text-green-800 ml-2" : "bg-red-100 text-red-800 ml-2"}>
                      {selectedTeacher.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Classes Assigned:</span>
                    <span className="ml-2">{(selectedTeacher.classes || []).length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}