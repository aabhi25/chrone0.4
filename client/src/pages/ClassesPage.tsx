import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Users, BookOpen, MapPin } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

interface Class {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
  requiredSubjects: string[];
  schoolId: string;
  room?: string;
  createdAt: string;
  updatedAt: string;
}

const classFormSchema = z.object({
  grade: z.string().min(1, "Class is required"),
  section: z.string().optional().refine(
    (val) => !val || !val.includes(","),
    "Section cannot contain commas. Use 'Add Sections to Class' for multiple sections."
  ),
  studentCount: z.coerce.number().min(0, "Student count must be 0 or greater"),
  room: z.string().optional(),
});

type ClassFormData = z.infer<typeof classFormSchema>;

export default function ClassesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [sectionsToAdd, setSectionsToAdd] = useState<string>("A,B,C");
  const { toast } = useToast();

  const {
    data: classes = [],
    isLoading,
    error,
  } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
  });

  const addForm = useForm<ClassFormData>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      grade: "",
      section: "",
      studentCount: 0,
      room: "",
    },
  });

  const editForm = useForm<ClassFormData>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      grade: "",
      section: "",
      studentCount: 0,
      room: "",
    },
  });

  const createClassMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const response = await apiRequest("POST", "/api/classes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setIsAddDialogOpen(false);
      addForm.reset();
      toast({
        title: "Success",
        description: "Class created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create class",
        variant: "destructive",
      });
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClassFormData }) => {
      const response = await apiRequest("PUT", `/api/classes/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setEditingClass(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Class updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update class",
        variant: "destructive",
      });
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/classes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({
        title: "Success",
        description: "Class and section deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete class",
        variant: "destructive",
      });
    },
  });

  const generateInstantClassesMutation = useMutation({
    mutationFn: async () => {
      const classesToCreate = [];
      
      // Generate classes from 1 to 12 without sections
      for (let grade = 1; grade <= 12; grade++) {
        classesToCreate.push({
          grade: grade.toString(),
          section: "",
          studentCount: 30, // Default student count
          room: ""
        });
      }
      
      // Create all classes in parallel
      const promises = classesToCreate.map(classData => 
        apiRequest("POST", "/api/classes", classData).then(res => res.json())
      );
      
      return Promise.all(promises);
    },
    onSuccess: (createdClasses) => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setIsGenerateDialogOpen(false);
      toast({
        title: "Success",
        description: `Successfully generated ${createdClasses.length} classes (Classes 1-12)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate classes",
        variant: "destructive",
      });
    },
  });

  const createSectionsMutation = useMutation({
    mutationFn: async ({ grade, sections }: { grade: string; sections: string[] }) => {
      // Check if there's an existing class for this grade without a section
      const existingClass = classes.find(c => c.grade === grade && !c.section);
      
      const promises = [];
      
      if (existingClass && sections.length > 0) {
        // Update the existing class to have the first section
        const firstSection = sections[0];
        promises.push(
          apiRequest("PUT", `/api/classes/${existingClass.id}`, {
            grade,
            section: firstSection,
            studentCount: existingClass.studentCount,
            room: existingClass.room || ""
          }).then(res => res.json())
        );
        
        // Create new classes for the remaining sections
        sections.slice(1).forEach(section => {
          promises.push(
            apiRequest("POST", "/api/classes", {
              grade,
              section,
              studentCount: 30, // Default student count
              room: ""
            }).then(res => res.json())
          );
        });
      } else {
        // No existing class found, create all sections as new classes
        sections.forEach(section => {
          promises.push(
            apiRequest("POST", "/api/classes", {
              grade,
              section,
              studentCount: 30, // Default student count
              room: ""
            }).then(res => res.json())
          );
        });
      }
      
      return Promise.all(promises);
    },
    onSuccess: (createdClasses) => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setIsSectionDialogOpen(false);
      setSectionsToAdd("A,B,C");
      setSelectedClass("");
      toast({
        title: "Success",
        description: `Successfully created ${createdClasses.length} sections for Class ${selectedClass}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sections",
        variant: "destructive",
      });
    },
  });

  const handleCreateSections = () => {
    if (!selectedClass.trim()) {
      toast({
        title: "Error",
        description: "Please enter a grade",
        variant: "destructive",
      });
      return;
    }
    
    const sections = sectionsToAdd
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    if (sections.length === 0) {
      toast({
        title: "Error", 
        description: "Please enter at least one section",
        variant: "destructive",
      });
      return;
    }
    
    createSectionsMutation.mutate({ grade: selectedClass, sections });
  };

  const handleAddClass = (data: ClassFormData) => {
    createClassMutation.mutate(data);
  };

  const handleEditClass = (data: ClassFormData) => {
    if (editingClass) {
      updateClassMutation.mutate({ id: editingClass.id, data });
    }
  };

  const handleDeleteClass = (id: string) => {
    deleteClassMutation.mutate(id);
  };

  const openEditDialog = (classItem: Class) => {
    setEditingClass(classItem);
    editForm.reset({
      grade: classItem.grade,
      section: classItem.section,
      studentCount: classItem.studentCount,
      room: classItem.room || "",
    });
  };

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading classes: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground">
            Manage your school's classes and sections
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-class">
                <Plus className="h-4 w-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(handleAddClass)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Class</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 9, 10, 11, 12" 
                            {...field} 
                            data-testid="input-grade"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="section"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Section (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., A (single section only, or leave empty)" 
                            {...field} 
                            data-testid="input-section"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="studentCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student Count</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field} 
                            data-testid="input-student-count"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="room"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Room (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Room 101" 
                            {...field} 
                            data-testid="input-room"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    data-testid="button-cancel-add"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createClassMutation.isPending}
                    data-testid="button-submit-add"
                  >
                    {createClassMutation.isPending ? "Creating..." : "Create Class"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
          <Button 
            variant="outline" 
            onClick={() => setIsSectionDialogOpen(true)}
            data-testid="button-add-sections"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Sections to Class
          </Button>
          <SearchBar className="w-64" />
        </div>
      </div>

      {/* Quick Class Navigation */}
      {classes.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 mb-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Quick Navigation</h4>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(classes.map(c => c.grade)))
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map((grade) => (
                <Button
                  key={grade}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const element = document.getElementById(`grade-${grade}`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  Class {grade}
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Classes List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Classes Found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first class
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-class">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Class
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(
            classes
              .sort((a, b) => parseInt(a.grade) - parseInt(b.grade))
              .reduce((groups, classItem) => {
                const grade = classItem.grade;
                if (!groups[grade]) groups[grade] = [];
                groups[grade].push(classItem);
                return groups;
              }, {} as Record<string, Class[]>)
          ).map(([grade, gradeClasses]) => (
            <div key={grade} id={`grade-${grade}`}>
              <h3 className="text-xl font-semibold mb-3 text-primary">Class {grade}</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {gradeClasses
                  .sort((a, b) => {
                    // Sort by section, with empty sections first
                    if (!a.section && !b.section) return 0;
                    if (!a.section) return -1;
                    if (!b.section) return 1;
                    return a.section.localeCompare(b.section);
                  })
                  .map((classItem) => (
                    <Card key={classItem.id} className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary group relative">
                      <CardHeader className="pb-2 pt-3">
                        <div className="flex items-center justify-between">
                          <Link href={`/classes/${classItem.id}`} className="flex-1 cursor-pointer">
                            <CardTitle className="text-lg group-hover:text-primary transition-colors">
                              {classItem.section ? 
                                `Class ${classItem.grade}${classItem.section}` : 
                                `Class ${classItem.grade}`
                              }
                            </CardTitle>
                          </Link>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openEditDialog(classItem);
                              }}
                              data-testid={`button-edit-class-${classItem.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-delete-class-${classItem.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Class and Section</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {classItem.section ? 
                                      `Class ${classItem.grade}${classItem.section}` : 
                                      `Class ${classItem.grade}`
                                    }? 
                                    This action cannot be undone and will also remove all associated timetable entries.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteClass(classItem.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid="button-confirm-delete"
                                  >
                                    Yes, Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 cursor-pointer pt-2 pb-3" onClick={() => window.location.href = `/classes/${classItem.id}`}>
                        {classItem.section && (
                          <div className="flex items-center justify-center">
                            <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary">
                              Section {classItem.section}
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {classItem.studentCount} student{classItem.studentCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {classItem.room && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{classItem.room}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingClass} onOpenChange={() => setEditingClass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
          </DialogHeader>
          {editingClass && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditClass)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Class</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 9, 10, 11, 12" 
                            {...field} 
                            data-testid="input-edit-grade"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="studentCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student Count</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field} 
                            data-testid="input-edit-student-count"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingClass(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateClassMutation.isPending}
                    data-testid="button-submit-edit"
                  >
                    {updateClassMutation.isPending ? "Updating..." : "Update Class"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Generate Classes Confirmation Dialog */}
      <AlertDialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Instant Classes</AlertDialogTitle>
            <AlertDialogDescription>
              This action will automatically generate classes from Class 1 to Class 12 for this school. 
              Each class will have a default student count of 30. You can add sections to each class later.
              <br /><br />
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-generate">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => generateInstantClassesMutation.mutate()}
              disabled={generateInstantClassesMutation.isPending}
              data-testid="button-confirm-generate"
            >
              {generateInstantClassesMutation.isPending ? "Generating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Sections Dialog */}
      <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sections to Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="grade-select">Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger data-testid="select-sections-grade">
                  <SelectValue placeholder="Select a class..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(classes.map(c => c.grade)))
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        Class {grade}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sections-input">Sections (comma separated)</Label>
              <Input
                id="sections-input"
                placeholder="e.g., A,B,C or A,B,C,D"
                value={sectionsToAdd}
                onChange={(e) => setSectionsToAdd(e.target.value)}
                data-testid="input-sections-list"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter sections separated by commas. Each will become a separate class (e.g., 1A, 1B, 1C)
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSectionDialogOpen(false)}
              data-testid="button-cancel-sections"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSections}
              disabled={createSectionsMutation.isPending}
              data-testid="button-create-sections"
            >
              {createSectionsMutation.isPending ? "Creating..." : "Create Sections"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fixed position button at bottom right - Only show if 7 or fewer classes exist */}
      {classes.length <= 7 && (
        <Button 
          size="sm"
          variant="outline" 
          className="fixed bottom-4 right-4 bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600 hover:border-yellow-700 shadow-lg"
          onClick={() => setIsGenerateDialogOpen(true)}
          data-testid="button-generate-instant-classes"
        >
          Generate Instant Classes (till 12)
        </Button>
      )}
    </div>
  );
}