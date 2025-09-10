import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadState {
  teachers: File | null;
  classes: File | null;
  subjects: File | null;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [files, setFiles] = useState<UploadState>({
    teachers: null,
    classes: null,
    subjects: null,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ type, file }: { type: keyof UploadState; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/upload/${type}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Upload Successful",
        description: data.message,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/${variables.type}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Clear the uploaded file
      setFiles(prev => ({ ...prev, [variables.type]: null }));
    },
    onError: (error, variables) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (type: keyof UploadState, file: File | null) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const handleUpload = (type: keyof UploadState) => {
    const file = files[type];
    if (!file) {
      toast({
        title: "No File Selected",
        description: `Please select a ${type} CSV file first.`,
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ type, file });
  };

  const handleClose = () => {
    setFiles({ teachers: null, classes: null, subjects: null });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload School Data</DialogTitle>
          <DialogDescription>
            Upload CSV files containing teachers, classes, and subjects data to populate your school's timetable system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Teachers Upload */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              <i className="fas fa-chalkboard-teacher text-3xl text-primary mb-3"></i>
              <h4 className="font-medium mb-2">Teachers</h4>
              <p className="text-sm text-muted-foreground mb-3">Upload teacher information and availability</p>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileChange('teachers', e.target.files?.[0] || null)}
                className="mb-2"
                data-testid="file-input-teachers"
              />
              <Button
                onClick={() => handleUpload('teachers')}
                disabled={!files.teachers || uploadMutation.isPending}
                size="sm"
                data-testid="button-upload-teachers"
              >
                <i className="fas fa-upload mr-2"></i>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
            
            {/* Classes Upload */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              <i className="fas fa-users text-3xl text-blue-600 mb-3"></i>
              <h4 className="font-medium mb-2">Classes</h4>
              <p className="text-sm text-muted-foreground mb-3">Upload class and student information</p>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileChange('classes', e.target.files?.[0] || null)}
                className="mb-2"
                data-testid="file-input-classes"
              />
              <Button
                onClick={() => handleUpload('classes')}
                disabled={!files.classes || uploadMutation.isPending}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-upload-classes"
              >
                <i className="fas fa-upload mr-2"></i>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
            
            {/* Subjects Upload */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              <i className="fas fa-book text-3xl text-green-600 mb-3"></i>
              <h4 className="font-medium mb-2">Subjects</h4>
              <p className="text-sm text-muted-foreground mb-3">Upload subject requirements</p>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileChange('subjects', e.target.files?.[0] || null)}
                className="mb-2"
                data-testid="file-input-subjects"
              />
              <Button
                onClick={() => handleUpload('subjects')}
                disabled={!files.subjects || uploadMutation.isPending}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-upload-subjects"
              >
                <i className="fas fa-upload mr-2"></i>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-2">CSV Format Requirements</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Teachers: name, email, subjects, max_load, availability</li>
              <li>• Classes: grade, section, student_count, required_subjects, room</li>
              <li>• Subjects: name, code, periods_per_week, color</li>
            </ul>
            <Button
              variant="link"
              className="mt-2 text-blue-600 hover:underline text-sm p-0"
              data-testid="button-download-template"
            >
              Download sample templates
            </Button>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-upload">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
