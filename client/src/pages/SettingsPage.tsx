import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/ThemeProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, User, Mail, Lock, Database, Globe, Upload, Download, FileSpreadsheet, Clock, Save, UserX, RefreshCw, Snowflake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [periodsData, setPeriodsData] = useState<{[key: string]: number}>({});
  const [hasPeriodsChanges, setHasPeriodsChanges] = useState(false);
  const [globalDefaultPeriods, setGlobalDefaultPeriods] = useState<number>(5);
  const [updateExistingAssignments, setUpdateExistingAssignments] = useState(false);
  
  // Freeze timetable state
  const [isFreezeConfirmDialogOpen, setIsFreezeConfirmDialogOpen] = useState(false);
  const [isUnfreezeConfirmDialogOpen, setIsUnfreezeConfirmDialogOpen] = useState(false);

  const passwordChangeMutation = useMutation({
    mutationFn: async (passwordData: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("PUT", "/api/auth/password", passwordData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsChangingPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  // Fetch subjects with default periods for admin users
  const { data: subjectsWithPeriods, isLoading: loadingSubjects } = useQuery({
    queryKey: ["subjects", "default-periods", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subjects/default-periods");
      return await response.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'super_admin'
  });

  // Fetch teacher replacement history for admin users
  const { data: teacherReplacements, isLoading: loadingReplacements, refetch: refetchReplacements } = useQuery({
    queryKey: ["teacher-replacements", user?.schoolId],
    queryFn: async () => {
      const endpoint = user?.role === 'super_admin' 
        ? "/api/teachers/replacements" 
        : `/api/teachers/replacements/school/${user?.schoolId}`;
      const response = await apiRequest("GET", endpoint);
      return await response.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'super_admin'
  });

  // Fetch timetable freeze status for admin users
  const { data: freezeStatus, isLoading: loadingFreezeStatus, refetch: refetchFreezeStatus } = useQuery({
    queryKey: ["timetable-freeze-status", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings/timetable-freeze-status");
      return await response.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'super_admin'
  });

  // Update global default periods when subjects data changes
  useEffect(() => {
    if (subjectsWithPeriods && subjectsWithPeriods.length > 0) {
      // Find the most common periods per week value
      const periodsCount: {[key: number]: number} = {};
      subjectsWithPeriods.forEach((subject: any) => {
        periodsCount[subject.periodsPerWeek] = (periodsCount[subject.periodsPerWeek] || 0) + 1;
      });
      
      // Get the most frequent value
      const mostCommonPeriods = Object.keys(periodsCount).reduce((a, b) => 
        periodsCount[Number(a)] > periodsCount[Number(b)] ? a : b
      );
      
      setGlobalDefaultPeriods(Number(mostCommonPeriods));
    }
  }, [subjectsWithPeriods]);


  // Update default periods mutation
  const updatePeriodsMutation = useMutation({
    mutationFn: async (updates: {id: string, periodsPerWeek: number}[]) => {
      const response = await apiRequest("PUT", "/api/subjects/default-periods", { updates });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Default periods updated successfully",
      });
      setHasPeriodsChanges(false);
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to update default periods",
        variant: "destructive",
      });
    },
  });

  // Global default periods mutation
  const updateGlobalDefaultMutation = useMutation({
    mutationFn: async (data: {defaultPeriods: number, updateExisting: boolean}) => {
      const response = await apiRequest("PUT", "/api/settings/global-default-periods", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Global default periods updated successfully",
      });
      // Invalidate all related queries to refresh the display
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects", "default-periods"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-assignments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to update global default periods",
        variant: "destructive",
      });
    },
  });

  // Freeze timetable mutation
  const freezeTimetableMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/settings/freeze-timetable");
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      });
      refetchFreezeStatus();
      // Invalidate cache to sync with timetable page
      queryClient.invalidateQueries({ queryKey: ["timetable-freeze-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to freeze timetable changes",
        variant: "destructive",
      });
    },
  });

  // Unfreeze timetable mutation
  const unfreezeTimetableMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/settings/unfreeze-timetable");
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      });
      refetchFreezeStatus();
      // Invalidate cache to sync with timetable page
      queryClient.invalidateQueries({ queryKey: ["timetable-freeze-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unfreeze timetable changes",
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordForm.currentPassword) {
      toast({
        title: "Error",
        description: "Current password is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!passwordForm.newPassword) {
      toast({
        title: "Error",
        description: "New password is required",
        variant: "destructive",
      });
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: "Error", 
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    passwordChangeMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const profileUpdateMutation = useMutation({
    mutationFn: async (profileData: { firstName: string; lastName: string; email: string }) => {
      const response = await apiRequest("PUT", "/api/auth/profile", profileData);
      return await response.json();
    },
    onSuccess: (updatedUser) => {
      // Update the user data in cache
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profileForm.firstName.trim()) {
      toast({
        title: "Error",
        description: "First name is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!profileForm.email.trim()) {
      toast({
        title: "Error", 
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    
    profileUpdateMutation.mutate(profileForm);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadedFile) {
      toast({
        title: "Error",
        description: "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!uploadedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: "Error",
        description: "Please upload a valid Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      // Use proper authentication token key that matches the rest of the app
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch('/api/bulk-import/excel', {
        method: 'POST',
        headers,
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: `Successfully imported ${result.classesCreated} classes, ${result.subjectsCreated} subjects, and ${result.assignmentsCreated} assignments`,
      });
      
      setUploadedFile(null);
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiRequest("GET", "/api/bulk-import/template");
      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'class_subjects_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Template downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download template",
        variant: "destructive",
      });
    }
  };

  const handlePeriodsChange = (subjectId: string, newPeriods: number) => {
    setPeriodsData(prev => ({
      ...prev,
      [subjectId]: newPeriods
    }));
    setHasPeriodsChanges(true);
  };

  const handleSavePeriods = async () => {
    const updates = Object.entries(periodsData).map(([id, periodsPerWeek]) => ({
      id,
      periodsPerWeek
    }));
    
    if (updates.length === 0) return;
    
    updatePeriodsMutation.mutate(updates);
  };

  const handleGlobalDefaultUpdate = () => {
    updateGlobalDefaultMutation.mutate({
      defaultPeriods: globalDefaultPeriods,
      updateExisting: updateExistingAssignments
    });
  };

  // Handle freeze timetable confirmation
  const handleFreezeTimetable = () => {
    setIsFreezeConfirmDialogOpen(false);
    freezeTimetableMutation.mutate();
  };

  // Handle unfreeze timetable confirmation
  const handleUnfreezeTimetable = () => {
    setIsUnfreezeConfirmDialogOpen(false);
    unfreezeTimetableMutation.mutate();
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-semibold">Settings</h2>
            <p className="text-muted-foreground">Manage your account and system preferences</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 overflow-y-auto h-full">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    data-testid="input-email"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={profileUpdateMutation.isPending}
                  data-testid="button-update-profile"
                >
                  {profileUpdateMutation.isPending ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5" />
                <span>Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isChangingPassword ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Password</h4>
                    <p className="text-sm text-muted-foreground">
                      Last changed: {user?.passwordChangedAt 
                        ? new Date(user.passwordChangedAt).toLocaleString() 
                        : "Never (use this to set a new password)"}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsChangingPassword(true)}
                    data-testid="button-change-password"
                  >
                    Change Password
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      data-testid="input-current-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      data-testid="input-new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      data-testid="input-confirm-password"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      type="submit" 
                      disabled={passwordChangeMutation.isPending}
                      data-testid="button-save-password"
                    >
                      {passwordChangeMutation.isPending ? "Changing..." : "Save Password"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsChangingPassword(false)}
                      data-testid="button-cancel-password"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>System Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Role</Label>
                    <p className="text-sm text-muted-foreground capitalize">
                      {user?.role?.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Account Created</Label>
                    <p className="text-sm text-muted-foreground">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Last Updated</Label>
                    <p className="text-sm text-muted-foreground">
                      {user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">User ID</Label>
                    <p className="text-sm text-muted-foreground font-mono">
                      {user?.id}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Application Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Theme</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Choose your preferred theme
                  </p>
                  <div className="flex space-x-2">
                    <Button 
                      variant={theme === "light" ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setTheme("light")}
                      data-testid="button-theme-light"
                    >
                      Light
                    </Button>
                    <Button 
                      variant={theme === "dark" ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setTheme("dark")}
                      data-testid="button-theme-dark"
                    >
                      Dark
                    </Button>
                    <Button 
                      variant={theme === "system" ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setTheme("system")}
                      data-testid="button-theme-system"
                    >
                      System
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium">Notifications</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Manage your notification preferences
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">Email notifications for new school registrations</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">System alerts and maintenance notifications</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Weekly activity reports</span>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Data Import - Only for Admin Users */}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  <span>Bulk Data Import</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium">Excel Import</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload an Excel file to automatically create classes and assign subjects. 
                      The file should contain grade, section, and subject names (comma-separated).
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleDownloadTemplate}
                          className="flex items-center space-x-2"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Sample Template</span>
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Get the correct format for your data
                        </span>
                      </div>

                      <form onSubmit={handleFileUpload} className="space-y-4">
                        <div>
                          <Label htmlFor="excelFile">Upload Excel File</Label>
                          <Input
                            id="excelFile"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Supported formats: .xlsx, .xls (Max 5MB)
                          </p>
                        </div>

                        <Button 
                          type="submit" 
                          disabled={!uploadedFile || isUploading}
                          className="flex items-center space-x-2"
                        >
                          <Upload className="h-4 w-4" />
                          <span>{isUploading ? "Uploading..." : "Upload & Import"}</span>
                        </Button>
                      </form>
                    </div>
                  </div>

                  <Separator />

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Important Notes:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• The Excel file should follow the sample template format exactly</li>
                      <li>• Each row represents a class with its assigned subjects</li>
                      <li>• Duplicate classes will be skipped during import</li>
                      <li>• Use subject names (e.g., "Mathematics, English, Science") - the system will auto-generate codes</li>
                      <li>• Subject codes will be consistent across all sections of the same grade</li>
                      <li>• Existing subjects with the same name will be reused automatically</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teacher Replacements History */}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserX className="h-5 w-5" />
                    <span>Teacher Replacements History</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchReplacements()}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Refresh</span>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loadingReplacements ? (
                    <div className="text-center text-muted-foreground py-4">
                      Loading replacement history...
                    </div>
                  ) : !teacherReplacements || teacherReplacements.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                      <UserX className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p>No teacher replacements found</p>
                      <p className="text-sm">Teacher replacement history will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {teacherReplacements.map((replacement: any) => (
                        <div key={replacement.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">
                                  {replacement.originalTeacher?.name || 'Unknown Teacher'}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium text-blue-600">
                                  {replacement.replacementTeacher?.name || 'Unknown Teacher'}
                                </span>
                                <Badge 
                                  variant={replacement.status === 'completed' ? 'default' : 'secondary'}
                                  className={replacement.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                                >
                                  {replacement.status}
                                </Badge>
                              </div>
                              
                              {replacement.reason && (
                                <p className="text-sm text-muted-foreground">
                                  <strong>Reason:</strong> {replacement.reason}
                                </p>
                              )}
                              
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>
                                  <strong>Date:</strong> {new Date(replacement.replacementDate).toLocaleDateString('en-IN')}
                                </p>
                                <p>
                                  <strong>Performed by:</strong> {replacement.replacedByUser?.email || 'System'}
                                </p>
                                {replacement.affectedTimetableEntries && (
                                  <p>
                                    <strong>Affected classes:</strong> {replacement.affectedTimetableEntries} assignments updated
                                  </p>
                                )}
                              </div>
                              
                              {replacement.conflictDetails && replacement.conflictDetails.length > 0 && (
                                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                  <p className="text-yellow-800 font-medium">Conflicts detected:</p>
                                  <p className="text-yellow-700">{replacement.conflictDetails}</p>
                                </div>
                              )}
                            </div>
                            
                            <div className="text-xs text-muted-foreground text-right">
                              {replacement.completedAt ? (
                                <span>Completed: {new Date(replacement.completedAt).toLocaleString('en-IN')}</span>
                              ) : (
                                <span>Created: {new Date(replacement.createdAt).toLocaleString('en-IN')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">About Teacher Replacements:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Teacher replacements automatically transfer all timetable assignments</li>
                      <li>• Conflicts are checked before replacement to prevent scheduling issues</li>
                      <li>• All replacement activities are logged for audit purposes</li>
                      <li>• Original teacher status is updated to "Left School" after replacement</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Default Periods Management */}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Default Periods Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Global Default Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-blue-900">Set Global Default</h3>
                        <p className="text-sm text-blue-700">Apply the same default periods to all subjects at once</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="globalDefault">Default periods/week:</Label>
                        <Input
                          id="globalDefault"
                          type="number"
                          min="1"
                          max="20"
                          className="w-20 text-center"
                          value={globalDefaultPeriods}
                          onChange={(e) => setGlobalDefaultPeriods(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="updateExisting"
                          checked={updateExistingAssignments}
                          onChange={(e) => setUpdateExistingAssignments(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor="updateExisting" className="text-sm">
                          Update existing class assignments
                        </Label>
                      </div>
                      
                      <Button
                        onClick={handleGlobalDefaultUpdate}
                        disabled={updateGlobalDefaultMutation.isPending}
                        className="flex items-center space-x-2"
                      >
                        {updateGlobalDefaultMutation.isPending ? "Updating..." : "Apply to All"}
                      </Button>
                    </div>
                  </div>


                  <Separator />

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">How Default Periods Work:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Default periods are used when creating new class-subject assignments</li>
                      <li>• You can override these defaults for specific classes as needed</li>
                      <li>• Periods per week should be between 1 and 20</li>
                      <li>• Changes will apply to new assignments, existing ones remain unchanged</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Freeze Timetable Changes */}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Snowflake className="h-5 w-5" />
                  <span>Freeze Timetable Changes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loadingFreezeStatus ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading freeze status...</span>
                    </div>
                  ) : (
                    <>
                      <div className={`border rounded-lg p-4 ${freezeStatus?.timetableFrozen ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className={`font-medium ${freezeStatus?.timetableFrozen ? 'text-blue-900' : 'text-gray-900'}`}>
                              Timetable Changes {freezeStatus?.timetableFrozen ? 'Frozen' : 'Active'}
                            </h3>
                            <p className={`text-sm ${freezeStatus?.timetableFrozen ? 'text-blue-700' : 'text-gray-600'}`}>
                              {freezeStatus?.timetableFrozen 
                                ? 'Timetable refresh functionality is currently disabled'
                                : 'Teachers and admins can refresh and regenerate timetables'
                              }
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {freezeStatus?.timetableFrozen ? (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                <Snowflake className="h-3 w-3 mr-1" />
                                Frozen
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                          {freezeStatus?.timetableFrozen 
                            ? 'Click "Unfreeze" to allow timetable changes again'
                            : 'Click "Freeze Changes" to prevent timetable modifications'
                          }
                        </div>
                        
                        <Button
                          onClick={() => freezeStatus?.timetableFrozen 
                            ? setIsUnfreezeConfirmDialogOpen(true) 
                            : setIsFreezeConfirmDialogOpen(true)
                          }
                          disabled={freezeTimetableMutation.isPending || unfreezeTimetableMutation.isPending}
                          variant={freezeStatus?.timetableFrozen ? "default" : "destructive"}
                          className="flex items-center space-x-2"
                        >
                          {freezeStatus?.timetableFrozen ? (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              <span>
                                {unfreezeTimetableMutation.isPending ? "Unfreezing..." : "Unfreeze Changes"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Snowflake className="h-4 w-4" />
                              <span>
                                {freezeTimetableMutation.isPending ? "Freezing..." : "Freeze Changes"}
                              </span>
                            </>
                          )}
                        </Button>
                      </div>

                      <Separator />

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-sm mb-2">About Timetable Freeze:</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• Freezing prevents all timetable refresh and regeneration operations</li>
                          <li>• The "Refresh Table" button will be hidden from the timetable page when frozen</li>
                          <li>• Manual timetable assignments can still be made using drag & drop</li>
                          <li>• Useful during exam periods or when the timetable is finalized</li>
                          <li>• Only administrators can freeze or unfreeze timetable changes</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Freeze Confirmation Dialog */}
        <Dialog open={isFreezeConfirmDialogOpen} onOpenChange={setIsFreezeConfirmDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Snowflake className="h-5 w-5 text-blue-600" />
                <span>Freeze Timetable Changes</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to freeze all timetable changes? This will:
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <ul className="text-sm space-y-1 text-blue-800">
                  <li className="flex items-center space-x-2">
                    <Snowflake className="h-4 w-4 text-blue-600" />
                    <span>Hide the "Refresh Table" button from the timetable page</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Lock className="h-4 w-4 text-blue-600" />
                    <span>Prevent automatic timetable regeneration</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span>Protect the current timetable from accidental changes</span>
                  </li>
                </ul>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <strong>Note:</strong> Manual assignments using drag & drop will still work. You can unfreeze anytime.
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsFreezeConfirmDialogOpen(false)}
                  disabled={freezeTimetableMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleFreezeTimetable}
                  disabled={freezeTimetableMutation.isPending}
                  variant="destructive"
                  className="flex items-center space-x-2"
                >
                  <Snowflake className="h-4 w-4" />
                  <span>{freezeTimetableMutation.isPending ? "Freezing..." : "Freeze Changes"}</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Unfreeze Confirmation Dialog */}
        <Dialog open={isUnfreezeConfirmDialogOpen} onOpenChange={setIsUnfreezeConfirmDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 text-green-600" />
                <span>Unfreeze Timetable Changes</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to unfreeze timetable changes? This will:
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <ul className="text-sm space-y-1 text-green-800">
                  <li className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 text-green-600" />
                    <span>Show the "Refresh Table" button on the timetable page</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-green-600" />
                    <span>Allow timetable refresh and regeneration operations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-green-600" />
                    <span>Enable all timetable management features</span>
                  </li>
                </ul>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <strong>Note:</strong> Users will be able to refresh and regenerate timetables again.
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsUnfreezeConfirmDialogOpen(false)}
                  disabled={unfreezeTimetableMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUnfreezeTimetable}
                  disabled={unfreezeTimetableMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>{unfreezeTimetableMutation.isPending ? "Unfreezing..." : "Unfreeze Changes"}</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}