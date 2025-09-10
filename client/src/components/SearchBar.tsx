import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, User, BookOpen } from "lucide-react";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

interface Teacher {
  id: string;
  name: string;
  email?: string;
}

interface ClassData {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

interface SearchResult {
  id: string;
  name: string;
  type: 'teacher' | 'class';
  subtitle?: string;
}

interface SearchBarProps {
  className?: string;
}

export default function SearchBar({ className = "w-64" }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [, setLocation] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch teachers and classes for search functionality
  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers"],
  });

  const { data: classes = [] } = useQuery<ClassData[]>({
    queryKey: ["/api/classes"],
  });

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];
    
    // Search teachers
    teachers.forEach(teacher => {
      if (teacher.name.toLowerCase().includes(query) || 
          teacher.email?.toLowerCase().includes(query)) {
        results.push({
          id: teacher.id,
          name: teacher.name,
          type: 'teacher',
          subtitle: teacher.email || 'Teacher'
        });
      }
    });
    
    // Search classes
    classes.forEach(classItem => {
      const className = `Class ${classItem.grade}${classItem.section}`;
      if (className.toLowerCase().includes(query) ||
          classItem.grade.toLowerCase().includes(query) ||
          (classItem.section && classItem.section.toLowerCase().includes(query))) {
        results.push({
          id: classItem.id,
          name: className,
          type: 'class',
          subtitle: `${classItem.studentCount} students`
        });
      }
    });
    
    return results.slice(0, 8); // Limit to 8 results
  }, [searchQuery, teachers, classes]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search result click
  const handleSearchResultClick = (result: SearchResult) => {
    if (result.type === 'teacher') {
      setLocation(`/teacher/${result.id}`);
    } else if (result.type === 'class') {
      setLocation(`/classes/${result.id}`);
    }
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSearchDropdown(value.trim().length > 0);
  };

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search teachers, classes..."
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
        className="pl-10"
      />
      
      {/* Search Results Dropdown */}
      {showSearchDropdown && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {searchResults.map((result) => (
            <div
              key={`${result.type}-${result.id}`}
              className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => handleSearchResultClick(result)}
            >
              <div className="mr-3 p-2 rounded-full bg-gray-100">
                {result.type === 'teacher' ? (
                  <User className="h-4 w-4 text-blue-600" />
                ) : (
                  <BookOpen className="h-4 w-4 text-green-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">
                  {result.name}
                </div>
                <div className="text-xs text-gray-500">
                  {result.subtitle}
                </div>
              </div>
              <div className="ml-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    result.type === 'teacher' 
                      ? 'border-blue-200 text-blue-700' 
                      : 'border-green-200 text-green-700'
                  }`}
                >
                  {result.type === 'teacher' ? 'Teacher' : 'Class'}
                </Badge>
              </div>
            </div>
          ))}
          
          {/* No results state */}
          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No teachers or classes found for "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}