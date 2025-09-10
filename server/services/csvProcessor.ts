import type { InsertTeacher, InsertSubject, InsertClass } from "@shared/schema";

interface CSVProcessingResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
}

export class CSVProcessor {
  static parseCSV(csvContent: string): string[][] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      values.push(current.trim());
      return values;
    });
  }

  static processTeachersCSV(csvContent: string): CSVProcessingResult<InsertTeacher> {
    const errors: string[] = [];
    const teachers: InsertTeacher[] = [];

    try {
      const rows = this.parseCSV(csvContent);
      
      if (rows.length === 0) {
        return { success: false, data: [], errors: ["CSV file is empty"] };
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const expectedHeaders = ['name', 'email', 'subjects', 'max_load', 'availability'];
      
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
        return { success: false, data: [], errors };
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < expectedHeaders.length) {
          errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }

        try {
          const name = row[headers.indexOf('name')]?.trim();
          const email = row[headers.indexOf('email')]?.trim();
          const subjectsStr = row[headers.indexOf('subjects')]?.trim();
          const maxLoadStr = row[headers.indexOf('max_load')]?.trim();
          const availabilityStr = row[headers.indexOf('availability')]?.trim();

          if (!name || !email) {
            errors.push(`Row ${i + 1}: Name and email are required`);
            continue;
          }

          const subjects = subjectsStr ? subjectsStr.split(';').map(s => s.trim()).filter(Boolean) : [];
          const maxLoad = maxLoadStr ? parseInt(maxLoadStr) : 30;

          let availability: {
            monday: string[];
            tuesday: string[];
            wednesday: string[];
            thursday: string[];
            friday: string[];
          } = {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: []
          };

          if (availabilityStr) {
            try {
              availability = JSON.parse(availabilityStr);
            } catch {
              // Default availability if parsing fails
              availability = {
                monday: ['09:00-09:45', '09:45-10:30', '11:00-11:45', '11:45-12:30', '13:30-14:15', '14:15-15:00'],
                tuesday: ['09:00-09:45', '09:45-10:30', '11:00-11:45', '11:45-12:30', '13:30-14:15', '14:15-15:00'],
                wednesday: ['09:00-09:45', '09:45-10:30', '11:00-11:45', '11:45-12:30', '13:30-14:15', '14:15-15:00'],
                thursday: ['09:00-09:45', '09:45-10:30', '11:00-11:45', '11:45-12:30', '13:30-14:15', '14:15-15:00'],
                friday: ['09:00-09:45', '09:45-10:30', '11:00-11:45', '11:45-12:30', '13:30-14:15', '14:15-15:00']
              };
            }
          }

          teachers.push({
            name,
            email,
            subjects,
            maxLoad,
            availability,
            isActive: true,
          });

        } catch (error) {
          errors.push(`Row ${i + 1}: Error processing data - ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        data: teachers,
        errors
      };

    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Failed to process CSV: ${error}`]
      };
    }
  }

  static processSubjectsCSV(csvContent: string): CSVProcessingResult<InsertSubject> {
    const errors: string[] = [];
    const subjects: InsertSubject[] = [];

    try {
      const rows = this.parseCSV(csvContent);
      
      if (rows.length === 0) {
        return { success: false, data: [], errors: ["CSV file is empty"] };
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const expectedHeaders = ['name', 'code', 'periods_per_week', 'color'];
      
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
        return { success: false, data: [], errors };
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < expectedHeaders.length) {
          errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }

        try {
          const name = row[headers.indexOf('name')]?.trim();
          const code = row[headers.indexOf('code')]?.trim();
          const periodsPerWeekStr = row[headers.indexOf('periods_per_week')]?.trim();
          const color = row[headers.indexOf('color')]?.trim() || '#3B82F6';

          if (!name || !code || !periodsPerWeekStr) {
            errors.push(`Row ${i + 1}: Name, code, and periods_per_week are required`);
            continue;
          }

          const periodsPerWeek = parseInt(periodsPerWeekStr);
          if (isNaN(periodsPerWeek) || periodsPerWeek <= 0) {
            errors.push(`Row ${i + 1}: periods_per_week must be a positive number`);
            continue;
          }

          subjects.push({
            name,
            code,
            periodsPerWeek,
            color: color.startsWith('#') ? color : `#${color}`,
          });

        } catch (error) {
          errors.push(`Row ${i + 1}: Error processing data - ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        data: subjects,
        errors
      };

    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Failed to process CSV: ${error}`]
      };
    }
  }

  static processClassesCSV(csvContent: string): CSVProcessingResult<InsertClass> {
    const errors: string[] = [];
    const classes: InsertClass[] = [];

    try {
      const rows = this.parseCSV(csvContent);
      
      if (rows.length === 0) {
        return { success: false, data: [], errors: ["CSV file is empty"] };
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const expectedHeaders = ['grade', 'section', 'student_count', 'required_subjects', 'room'];
      
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
        return { success: false, data: [], errors };
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < expectedHeaders.length) {
          errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }

        try {
          const grade = row[headers.indexOf('grade')]?.trim();
          const section = row[headers.indexOf('section')]?.trim();
          const studentCountStr = row[headers.indexOf('student_count')]?.trim();
          const requiredSubjectsStr = row[headers.indexOf('required_subjects')]?.trim();
          const room = row[headers.indexOf('room')]?.trim();

          if (!grade) {
            errors.push(`Row ${i + 1}: Grade is required`);
            continue;
          }

          // Allow blank sections - use empty string if section is not provided
          const finalSection = section || "";

          const studentCount = studentCountStr ? parseInt(studentCountStr) : 0;
          const requiredSubjects = requiredSubjectsStr ? 
            requiredSubjectsStr.split(';').map(s => s.trim()).filter(Boolean) : [];

          classes.push({
            grade,
            section: finalSection,
            studentCount,
            requiredSubjects,
            room,
          });

        } catch (error) {
          errors.push(`Row ${i + 1}: Error processing data - ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        data: classes,
        errors
      };

    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Failed to process CSV: ${error}`]
      };
    }
  }
}
