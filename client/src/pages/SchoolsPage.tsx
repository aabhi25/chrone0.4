import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Building, Users, Calendar, Edit, Trash2, Copy, Check } from "lucide-react";

interface School {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  adminName: string;
  adminEmail?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SchoolsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contactPhone: "",
    adminName: "",
    adminEmail: "",
    adminPassword: ""
  });

  // Fetch schools
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/schools");
      return await response.json();
    },
  });

  // Create school mutation
  const createSchoolMutation = useMutation({
    mutationFn: async (schoolData: typeof formData) => {
      const response = await apiRequest("POST", "/api/schools", schoolData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "School created successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create school",
        variant: "destructive",
      });
    },
  });

  // Update school mutation
  const updateSchoolMutation = useMutation({
    mutationFn: async ({ id, ...schoolData }: typeof formData & { id: string }) => {
      const response = await apiRequest("PUT", `/api/schools/${id}`, schoolData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      setEditingSchool(null);
      resetForm();
      toast({
        title: "Success",
        description: "School updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update school",
        variant: "destructive",
      });
    },
  });

  // Toggle school status mutation
  const toggleSchoolStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/schools/${id}/status`, { isActive });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update school status: ${response.status} - ${errorText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 200)}`);
      }
      
      return await response.json();
    },
    onMutate: async ({ id, isActive }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/schools"] });

      // Snapshot the previous value
      const previousSchools = queryClient.getQueryData(["/api/schools"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["/api/schools"], (old: School[] | undefined) => {
        if (!old) return old;
        return old.map(school => 
          school.id === id ? { ...school, isActive } : school
        );
      });

      // Return a context object with the snapshotted value
      return { previousSchools };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSchools) {
        queryClient.setQueryData(["/api/schools"], context.previousSchools);
      }
      
      toast({
        title: "Error",
        description: err.message || "Failed to update school status",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success",
        description: `School ${variables.isActive ? 'activated' : 'deactivated'} successfully!`,
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      contactPhone: "",
      adminName: "",
      adminEmail: "",
      adminPassword: ""
    });
  };

  const handleCreate = () => {
    setEditingSchool(null);
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (school: School) => {
    setEditingSchool(school);
    setFormData({
      name: school.name,
      address: school.address,
      contactPhone: school.contactPhone,
      adminName: school.adminName,
      adminEmail: school.adminEmail || "",
      adminPassword: ""
    });
    setIsCreateDialogOpen(true);
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    // Admin email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.adminEmail)) {
      errors.push("Please enter a valid admin email address");
    }
    
    // Password validation
    if (!editingSchool && formData.adminPassword.length < 6) {
      errors.push("Admin password must be at least 6 characters");
    }
    
    // Phone validation (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (formData.contactPhone && !phoneRegex.test(formData.contactPhone.replace(/\D/g, ''))) {
      errors.push("Phone number must be exactly 10 digits");
    }
    
    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors.join(", "),
        variant: "destructive",
      });
      return;
    }
    
    if (editingSchool) {
      updateSchoolMutation.mutate({ ...formData, id: editingSchool.id });
    } else {
      createSchoolMutation.mutate(formData);
    }
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingSchool(null);
    resetForm();
  };

  const handleToggleStatus = (school: School) => {
    toggleSchoolStatusMutation.mutate({
      id: school.id,
      isActive: !school.isActive
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building className="h-8 w-8" />
            Schools Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage schools and their administrators across the platform
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-add-school">
          <Plus className="mr-2 h-4 w-4" />
          Add School
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schools.length}</div>
            <p className="text-xs text-muted-foreground">
              Active educational institutions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Schools</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schools.filter((s: School) => s.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently operational
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schools.filter((s: School) => {
                const createdDate = new Date(s.createdAt);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return createdDate > weekAgo;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Schools added this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schools Table */}
      <Card>
        <CardHeader>
          <CardTitle>Schools Directory</CardTitle>
          <CardDescription>
            Complete list of all schools in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schools.length === 0 ? (
            <div className="text-center py-8">
              <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No schools yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first school to the platform
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First School
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school: School) => (
                  <TableRow key={school.id} data-testid={`row-school-${school.id}`}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-semibold text-base">{school.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{school.address}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{school.adminName}</p>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{school.adminEmail || "No admin email"}</p>
                        <p className="text-muted-foreground flex items-center">
                          {school.contactPhone ? (
                            <span>📞 {school.contactPhone}</span>
                          ) : (
                            <span className="italic">No phone number</span>
                          )}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={school.isActive}
                          onCheckedChange={() => handleToggleStatus(school)}
                          disabled={toggleSchoolStatusMutation.isPending}
                          data-testid={`switch-status-${school.id}`}
                        />
                        <Badge 
                          variant={school.isActive ? "default" : "secondary"}
                          className={school.isActive ? "bg-green-500" : "bg-red-500"}
                        >
                          {school.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(school.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(school)}
                          data-testid={`button-edit-${school.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingSchool ? "Edit School" : "Add New School"}
            </DialogTitle>
            <DialogDescription>
              {editingSchool 
                ? "Update the school information below"
                : "Fill in the details to add a new school to the platform"
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">School Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter school name"
                  required
                  data-testid="input-school-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="adminName">Admin Name *</Label>
                <Input
                  id="adminName"
                  value={formData.adminName}
                  onChange={(e) => setFormData(prev => ({ ...prev, adminName: e.target.value }))}
                  placeholder="Enter admin's name"
                  required
                  data-testid="input-admin-name"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter school address"
                required
                data-testid="input-address"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) => {
                  // Only allow numbers and limit to 10 digits
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData(prev => ({ ...prev, contactPhone: value }));
                }}
                placeholder="Enter 10-digit phone number"
                maxLength={10}
                pattern="\d{10}"
                title="Please enter exactly 10 digits"
                data-testid="input-contact-phone"
              />
            </div>
            
            {/* Admin Login Credentials Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3 text-sm text-muted-foreground">ADMIN LOGIN CREDENTIALS</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Admin Email *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
                    placeholder="admin@school.com"
                    required
                    data-testid="input-admin-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">
                    Admin Password *
                  </Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, adminPassword: e.target.value }))}
                    placeholder={editingSchool ? "Enter new password to update" : "Enter password (min 6 chars)"}
                    required={!editingSchool}
                    minLength={6}
                    data-testid="input-admin-password"
                  />
                </div>
              </div>
              
              {!editingSchool ? (
                <p className="text-xs text-muted-foreground mt-2">
                  The admin will use these credentials to login and manage their school's timetables.
                </p>
              ) : (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-2">
                    📋 Current Admin Login Credentials
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      <strong>Email:</strong> {formData.adminEmail || "No admin email set"}
                    </p>
                    {formData.adminEmail && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(formData.adminEmail);
                          setCopiedEmail(true);
                          setTimeout(() => setCopiedEmail(false), 2000);
                        }}
                        data-testid="button-copy-email"
                      >
                        {copiedEmail ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                    <strong>Password:</strong> {formData.adminPassword ? "●●●●●●●●" : "••••••••••"}
                  </p>
                  <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800 mb-2">
                    <p><strong>⚠️ Security Note:</strong> Passwords are encrypted and cannot be displayed.</p>
                    <p>If admin forgot password, enter a new password in the field above to reset it.</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share the email and new password with the school admin for login access.
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createSchoolMutation.isPending || updateSchoolMutation.isPending}
                data-testid="button-save-school"
              >
                {createSchoolMutation.isPending || updateSchoolMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingSchool ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  editingSchool ? "Update School" : "Create School"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}