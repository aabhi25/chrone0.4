import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SearchBar from "@/components/SearchBar";

export default function SubjectsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Subjects
          </h1>
          <p className="text-muted-foreground">
            Manage subjects for your school
          </p>
        </div>
        <SearchBar className="w-64" />
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Subjects Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Subjects functionality will be available soon.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}