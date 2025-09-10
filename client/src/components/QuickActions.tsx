import { Button } from "@/components/ui/button";
import { useState } from "react";
import UploadModal from "@/components/UploadModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function QuickActions() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateTimetableMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/timetable/generate", {
        // Don't pass classId - we want to generate for all classes in user's school
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Success",
          description: data.message,
        });
        // Invalidate all timetable-related queries to ensure auto-refresh
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            return queryKey[0] === "/api/timetable/detailed" || 
                   queryKey[0] === "/api/timetable" ||
                   queryKey[0] === "/api/stats";
          }
        });
        
        // Force refetch of the current timetable data
        queryClient.refetchQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            return queryKey[0] === "/api/timetable/detailed";
          }
        });
      } else {
        toast({
          title: "Generation Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate timetable. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <div className="bg-card p-6 rounded-lg border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <i className="fas fa-bolt mr-2 text-primary"></i>
          Quick Actions
        </h3>
        
        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => generateTimetableMutation.mutate()}
            disabled={generateTimetableMutation.isPending}
            data-testid="button-generate-timetable"
          >
            <i className="fas fa-magic mr-2"></i>
            {generateTimetableMutation.isPending ? "Generating..." : "Generate New Timetable"}
          </Button>
          
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowUploadModal(true)}
            data-testid="button-upload-data"
          >
            <i className="fas fa-upload mr-2"></i>
            Upload Data (CSV)
          </Button>
          
          <Button
            variant="outline"
            className="w-full bg-green-500 text-white hover:bg-green-600"
            data-testid="button-export-timetable"
          >
            <i className="fas fa-download mr-2"></i>
            Export Timetable
          </Button>
        </div>
      </div>

      <UploadModal 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
      />
    </>
  );
}
