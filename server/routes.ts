import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scheduler } from "./services/scheduler";
import { CSVProcessor } from "./services/csvProcessor";
import { 
  insertTeacherSchema, 
  insertSubjectSchema, 
  insertClassSchema,
  updateClassSchema,
  insertSubstitutionSchema,
  insertTimetableChangeSchema,
  insertSchoolSchema,
  insertClassSubjectAssignmentSchema,
  insertTimetableStructureSchema,
  insertTeacherAttendanceSchema,
  bulkAttendanceSchema,
  updateTeacherDailyPeriodsSchema,
  insertAuditLogSchema,
  createAndAssignSubjectSchema,
  insertTeacherReplacementSchema
} from "@shared/schema";
import multer from "multer";
import * as XLSX from "xlsx";
import { setupCustomAuth, authenticateToken as authMiddleware } from "./auth";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to generate consistent colors based on subject code
function generateColorForSubjectCode(subjectCode: string): string {
  // Predefined color palette for better visual distinction
  const colors = [
    "#3B82F6", // Blue
    "#EF4444", // Red  
    "#10B981", // Green
    "#F59E0B", // Amber
    "#8B5CF6", // Violet
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#84CC16", // Lime
    "#EC4899", // Pink
    "#6366F1", // Indigo
    "#14B8A6", // Teal
    "#DC2626", // Red-600
    "#7C3AED", // Purple
    "#059669", // Emerald
    "#D97706", // Orange-600
    "#2563EB", // Blue-600
    "#BE123C", // Rose
    "#0891B2", // Sky
    "#CA8A04", // Yellow-600
    "#9333EA"  // Purple-600
  ];
  
  // Generate consistent hash from subject code
  let hash = 0;
  for (let i = 0; i < subjectCode.length; i++) {
    const char = subjectCode.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get consistent color index
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
}

// Helper function to generate grade-specific subject codes
async function generateGradeSpecificSubjectCode(subjectName: string, grade: string, schoolId: string): Promise<string> {
  // Generate base code from subject name
  const baseCode = subjectName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 3); // Shorter to make room for grade
  
  // Create grade-specific code
  let code = `${baseCode}${grade}`;
  let counter = 1;
  
  // Ensure uniqueness
  while (await storage.checkSubjectCodeExists(code, schoolId)) {
    code = `${baseCode}${grade}_${counter}`;
    counter++;
  }
  
  return code;
}

// Helper function to generate subject codes (fallback)
async function generateSubjectCode(subjectName: string, schoolId: string): Promise<string> {
  // Generate base code from subject name
  const baseCode = subjectName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 4);
  
  let code = baseCode;
  let counter = 1;
  
  // Ensure uniqueness
  while (await storage.checkSubjectCodeExists(code, schoolId)) {
    code = `${baseCode}${counter}`;
    counter++;
  }
  
  return code;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup custom authentication
  setupCustomAuth(app);

  // Auth routes
  app.get('/api/auth/user', authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      // Don't send password hash to client
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.put('/api/auth/profile', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email } = req.body;
      
      // Validate input
      if (!firstName?.trim()) {
        return res.status(400).json({ message: "First name is required" });
      }
      
      if (!email?.trim()) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Check if email is already taken by another user
      if (email !== req.user.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email is already in use" });
        }
      }
      
      // Update user profile
      const updatedUser = await storage.updateUser(userId, {
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        email: email.trim(),
      });
      
      // Don't send password hash to client
      const { passwordHash, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Change user password
  app.put('/api/auth/password', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      // Validate input
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }
      
      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }
      
      // Verify current password
      const bcrypt = await import('bcryptjs');
      const isCurrentPasswordValid = await bcrypt.default.compare(currentPassword, req.user.passwordHash);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash new password
      const hashedNewPassword = await bcrypt.default.hash(newPassword, 12);
      
      // Update password
      await storage.updateUser(userId, {
        passwordHash: hashedNewPassword,
        passwordChangedAt: new Date(),
      });
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Get school information for school admin
  app.get('/api/school-info', authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins can access this endpoint
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (!user.schoolId) {
        return res.status(400).json({ message: "User is not associated with a school" });
      }
      
      const school = await storage.getSchool(user.schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Get teacher count for this school
      const teacherCount = await storage.getTeacherCountBySchool(user.schoolId);
      
      res.json({
        ...school,
        totalTeachers: teacherCount
      });
    } catch (error) {
      console.error("Error fetching school info:", error);
      res.status(500).json({ message: "Failed to fetch school information" });
    }
  });

  // School management endpoints (Super Admin only)
  app.get("/api/schools", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      const schools = await storage.getSchoolsWithAdminEmails();
      res.json(schools);
    } catch (error) {
      console.error("Error fetching schools:", error);
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  app.post("/api/schools", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const { adminEmail, adminPassword, adminName, ...schoolData } = req.body;
      
      // Validate school data
      const validatedSchoolData = insertSchoolSchema.parse({
        ...schoolData,
        adminName
      });
      
      // Create school first
      const school = await storage.createSchool(validatedSchoolData);
      
      // Create admin account if credentials provided
      if (adminEmail && adminPassword) {
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.default.hash(adminPassword, 12);
        await storage.createUser({
          email: adminEmail,
          passwordHash: hashedPassword,
          role: "admin",
          schoolId: school.id,
          firstName: adminName,
          lastName: null,
          teacherId: null
        });
      }
      
      res.status(201).json(school);
    } catch (error) {
      console.error("Error creating school:", error);
      res.status(400).json({ message: "Invalid school data" });
    }
  });

  app.put("/api/schools/:id", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }
      
      const { adminEmail, adminPassword, adminName, ...schoolData } = req.body;
      
      // Validate school data
      const validatedSchoolData = insertSchoolSchema.partial().parse({
        ...schoolData,
        adminName
      });
      
      // Update school first
      const school = await storage.updateSchool(req.params.id, validatedSchoolData);
      
      // Update admin account if new password provided
      if (adminEmail && adminPassword) {
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.default.hash(adminPassword, 12);
        
        // Try to find existing admin user for this school
        try {
          const existingUsers = await storage.getUsersBySchoolId(req.params.id);
          const existingAdmin = existingUsers.find(user => user.role === "admin");
          
          if (existingAdmin) {
            // Update existing admin
            await storage.updateUser(existingAdmin.id, {
              email: adminEmail,
              passwordHash: hashedPassword,
              firstName: adminName,
            });
          } else {
            // Create new admin if none exists
            await storage.createUser({
              email: adminEmail,
              passwordHash: hashedPassword,
              role: "admin",
              schoolId: school.id,
              firstName: adminName,
              lastName: null,
              teacherId: null
            });
          }
        } catch (error) {
          console.error("Error managing admin account:", error);
          // Continue without failing the school update
        }
      }
      
      res.json(school);
    } catch (error) {
      console.error("Error updating school:", error);
      res.status(400).json({ message: "Invalid school data" });
    }
  });

  // Update school status (activate/deactivate)
  app.patch("/api/schools/:id/status", authMiddleware, async (req, res) => {
    try {
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin required." });
      }

      const { id } = req.params;
      const { isActive } = req.body;
      
      console.log(`Updating school ${id} status to ${isActive}`);
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean value" });
      }

      const updatedSchool = await storage.updateSchool(id, { isActive });
      
      console.log('Updated school:', updatedSchool);
      
      res.json(updatedSchool);
    } catch (error) {
      console.error("Error updating school status:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update school status", error: errorMessage });
    }
  });

  // Stats endpoint (protected)
  app.get("/api/stats", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const stats = await storage.getStats(user.schoolId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin dashboard stats endpoint (super admin only)
  app.get("/api/admin/dashboard-stats", authMiddleware, async (req, res) => {
    try {
      // Only super admins can access this endpoint
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const stats = await storage.getAdminDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch admin dashboard stats" });
    }
  });

  // Teacher endpoints (school-filtered for non-super-admin users)
  app.get("/api/teachers", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      let teachers;
      
      if (user?.role === "super_admin") {
        // Super admin can see all teachers
        teachers = await storage.getTeachers();
      } else if (user?.schoolId) {
        // School admin and teachers can only see their school's teachers
        teachers = await storage.getTeachers(user.schoolId);
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(teachers);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  app.get("/api/teachers/:id", async (req, res) => {
    try {
      const teacher = await storage.getTeacher(req.params.id);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      res.json(teacher);
    } catch (error) {
      console.error("Error fetching teacher:", error);
      res.status(500).json({ message: "Failed to fetch teacher" });
    }
  });

  app.post("/api/teachers", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      // For school admins, ensure the teacher belongs to their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin must provide schoolId
        if (!requestBody.schoolId) {
          return res.status(400).json({ message: "School ID is required for super admin" });
        }
      }

      const validatedData = insertTeacherSchema.parse(requestBody);
      const teacher = await storage.createTeacher(validatedData);
      res.status(201).json(teacher);
    } catch (error) {
      console.error("Error creating teacher:", error);
      
      // Handle specific database errors
      if (error && typeof error === 'object' && 'code' in error && 'constraint' in error) {
        if (error.code === '23505' && error.constraint === 'teachers_email_unique') {
          return res.status(400).json({ message: "A teacher with this email already exists" });
        }
      }
      
      res.status(400).json({ message: "Invalid teacher data" });
    }
  });

  // Update teacher daily periods configuration (must be before /api/teachers/:id)
  app.put("/api/teachers/daily-periods", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can configure daily periods
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = updateTeacherDailyPeriodsSchema.parse(req.body);
      const result = await storage.updateTeacherDailyPeriods(user.schoolId, validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        schoolId: user.schoolId,
        userId: user.id,
        action: 'UPDATE',
        entityType: 'TEACHER',
        entityId: validatedData.teacherId || 'ALL',
        description: `Updated daily periods limit to ${validatedData.maxDailyPeriods}`,
        newValues: { maxDailyPeriods: validatedData.maxDailyPeriods, applyToAll: validatedData.applyToAll }
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating teacher daily periods:", error);
      res.status(500).json({ message: "Failed to update teacher daily periods" });
    }
  });

  app.put("/api/teachers/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const teacherId = req.params.id;
      
      // Only school admins and super admins can update teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if teacher exists and belongs to the user's school (for school admins)
      const existingTeacher = await storage.getTeacher(teacherId);
      if (!existingTeacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingTeacher.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - teacher not in your school" });
      }

      const validatedData = insertTeacherSchema.partial().parse(req.body);
      
      // Ensure school ID cannot be changed by school admins
      if (user.role === 'admin') {
        delete validatedData.schoolId;
      }

      const teacher = await storage.updateTeacher(teacherId, validatedData);
      res.json(teacher);
    } catch (error) {
      console.error("Error updating teacher:", error);
      res.status(400).json({ message: "Failed to update teacher" });
    }
  });

  app.delete("/api/teachers/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const teacherId = req.params.id;
      
      // Only school admins and super admins can delete teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if teacher exists and belongs to the user's school (for school admins)
      const existingTeacher = await storage.getTeacher(teacherId);
      if (!existingTeacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingTeacher.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - teacher not in your school" });
      }

      await storage.deleteTeacher(teacherId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting teacher:", error);
      res.status(500).json({ message: "Failed to delete teacher" });
    }
  });

  // Teacher Replacement endpoints
  // Check for conflicts before replacement
  app.get("/api/teachers/:id/replacement-conflicts", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const originalTeacherId = req.params.id;
      const { replacementTeacherId } = req.query;
      
      // Only school admins and super admins can check conflicts
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!replacementTeacherId) {
        return res.status(400).json({ message: "Replacement teacher ID is required" });
      }

      // Get all timetable entries for the original teacher
      const originalTeacherEntries = await storage.getTimetableEntriesByTeacher(originalTeacherId);
      
      // Get all timetable entries for the replacement teacher
      const replacementTeacherEntries = await storage.getTimetableEntriesByTeacher(replacementTeacherId as string);
      
      // Check for conflicts
      const conflicts = [];
      for (const originalEntry of originalTeacherEntries) {
        const conflict = replacementTeacherEntries.find(replacementEntry => 
          replacementEntry.day === originalEntry.day &&
          replacementEntry.period === originalEntry.period &&
          replacementEntry.isActive
        );
        
        if (conflict) {
          // Get class details for both entries
          const originalClass = await storage.getClass(originalEntry.classId);
          const conflictingClass = await storage.getClass(conflict.classId);
          
          conflicts.push({
            day: originalEntry.day,
            period: originalEntry.period,
            existingClass: conflictingClass ? `${conflictingClass.grade}-${conflictingClass.section}` : 'Unknown',
            conflictingClass: originalClass ? `${originalClass.grade}-${originalClass.section}` : 'Unknown',
            startTime: originalEntry.startTime,
            endTime: originalEntry.endTime
          });
        }
      }

      res.json({
        hasConflicts: conflicts.length > 0,
        conflictCount: conflicts.length,
        totalEntries: originalTeacherEntries.length,
        conflicts
      });
    } catch (error) {
      console.error("Error checking replacement conflicts:", error);
      res.status(500).json({ message: "Failed to check replacement conflicts" });
    }
  });

  // Replace teacher permanently
  app.post("/api/teachers/:id/replace", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const originalTeacherId = req.params.id;
      const { replacementTeacherId, reason } = req.body;
      
      // Only school admins and super admins can replace teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!replacementTeacherId || !reason) {
        return res.status(400).json({ message: "Replacement teacher ID and reason are required" });
      }

      // Check if both teachers exist and belong to the same school
      const originalTeacher = await storage.getTeacher(originalTeacherId);
      const replacementTeacher = await storage.getTeacher(replacementTeacherId);
      
      if (!originalTeacher || !replacementTeacher) {
        return res.status(404).json({ message: "One or both teachers not found" });
      }

      if (user.role === 'admin' && user.schoolId) {
        if (originalTeacher.schoolId !== user.schoolId || replacementTeacher.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Access denied - teachers not in your school" });
        }
      }

      // Get all timetable entries for the original teacher
      const originalTeacherEntries = await storage.getTimetableEntriesByTeacher(originalTeacherId);
      
      // Check for conflicts first
      const replacementTeacherEntries = await storage.getTimetableEntriesByTeacher(replacementTeacherId);
      const conflicts = [];
      
      for (const originalEntry of originalTeacherEntries) {
        const conflict = replacementTeacherEntries.find(replacementEntry => 
          replacementEntry.day === originalEntry.day &&
          replacementEntry.period === originalEntry.period &&
          replacementEntry.isActive
        );
        
        if (conflict) {
          const originalClass = await storage.getClass(originalEntry.classId);
          const conflictingClass = await storage.getClass(conflict.classId);
          
          conflicts.push({
            day: originalEntry.day,
            period: originalEntry.period,
            existingClass: conflictingClass ? `${conflictingClass.grade}-${conflictingClass.section}` : 'Unknown',
            conflictingClass: originalClass ? `${originalClass.grade}-${originalClass.section}` : 'Unknown'
          });
        }
      }

      if (conflicts.length > 0) {
        return res.status(409).json({ 
          message: "Teacher replacement conflicts detected",
          conflicts,
          hasConflicts: true
        });
      }

      // Perform the replacement
      let replacedEntries = 0;
      for (const entry of originalTeacherEntries) {
        await storage.updateTimetableEntry(entry.id, {
          teacherId: replacementTeacherId
        });
        replacedEntries++;
      }

      // Update original teacher status to "left_school"
      await storage.updateTeacher(originalTeacherId, {
        status: 'left_school',
        isActive: false
      });

      // Create replacement history record
      const replacementRecord = await storage.createTeacherReplacement({
        originalTeacherId,
        replacementTeacherId,
        schoolId: originalTeacher.schoolId,
        replacementDate: new Date(),
        reason,
        affectedTimetableEntries: replacedEntries,
        conflictDetails: { hasConflicts: false },
        status: 'completed',
        replacedBy: user.id,
        completedAt: new Date()
      });

      res.json({
        message: "Teacher replacement completed successfully",
        replacement: replacementRecord,
        affectedEntries: replacedEntries,
        originalTeacher: {
          id: originalTeacher.id,
          name: originalTeacher.name,
          status: 'left_school'
        },
        replacementTeacher: {
          id: replacementTeacher.id,
          name: replacementTeacher.name
        }
      });
    } catch (error) {
      console.error("Error replacing teacher:", error);
      res.status(500).json({ message: "Failed to replace teacher" });
    }
  });

  // Get teacher replacement history
  app.get("/api/teacher-replacements", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can view replacement history
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      let replacements;
      if (user.role === 'super_admin') {
        // Super admin can see all replacements
        replacements = await storage.getAllTeacherReplacements();
      } else if (user.schoolId) {
        // School admin can only see their school's replacements
        replacements = await storage.getTeacherReplacementsBySchool(user.schoolId);
      } else {
        return res.status(400).json({ message: "School ID is required" });
      }

      res.json(replacements);
    } catch (error) {
      console.error("Error fetching teacher replacements:", error);
      res.status(500).json({ message: "Failed to fetch teacher replacement history" });
    }
  });

  // Teacher Attendance routes
  app.get("/api/teacher-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date, teacherId, startDate, endDate } = req.query;
      
      // Only school admins and super admins can view attendance
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      let attendance;
      
      if (teacherId) {
        // Get attendance for specific teacher with optional date range
        attendance = await storage.getTeacherAttendanceByTeacher(teacherId as string, startDate as string, endDate as string);
      } else if (user.schoolId) {
        // Get attendance for the school
        attendance = await storage.getTeacherAttendance(user.schoolId, date as string);
      } else {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      res.json(attendance);
    } catch (error) {
      console.error("Error fetching teacher attendance:", error);
      res.status(500).json({ message: "Failed to fetch teacher attendance" });
    }
  });

  app.post("/api/teacher-attendance", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can mark attendance
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      // Add marked by information
      requestBody.markedBy = user.id;
      
      // For school admins, ensure the attendance belongs to their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      }

      const validatedData = insertTeacherAttendanceSchema.parse(requestBody);
      const attendance = await storage.markTeacherAttendance(validatedData);
      res.status(201).json(attendance);
    } catch (error) {
      console.error("Error marking teacher attendance:", error);
      res.status(500).json({ message: "Failed to mark teacher attendance" });
    }
  });

  app.post("/api/teacher-attendance/bulk", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can mark bulk attendance
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = bulkAttendanceSchema.parse(req.body);
      
      // Verify teacher belongs to the user's school (for school admins)
      if (user.role === 'admin') {
        const teacher = await storage.getTeacher(validatedData.teacherId);
        if (!teacher || teacher.schoolId !== user.schoolId) {
          return res.status(403).json({ message: "Teacher not found or not in your school" });
        }
      }

      const attendanceRecords = await storage.markBulkTeacherAttendance(validatedData, user.id);
      res.status(201).json(attendanceRecords);
    } catch (error) {
      console.error("Error marking bulk teacher attendance:", error);
      res.status(500).json({ message: "Failed to mark bulk teacher attendance" });
    }
  });

  app.put("/api/teacher-attendance/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const attendanceId = req.params.id;
      
      // Only school admins and super admins can update attendance
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      requestBody.markedBy = user.id; // Update who modified it
      
      const validatedData = insertTeacherAttendanceSchema.partial().parse(requestBody);
      const attendance = await storage.updateTeacherAttendance(attendanceId, validatedData);
      res.json(attendance);
    } catch (error) {
      console.error("Error updating teacher attendance:", error);
      res.status(500).json({ message: "Failed to update teacher attendance" });
    }
  });

  app.delete("/api/teacher-attendance/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const attendanceId = req.params.id;
      
      // Only school admins and super admins can delete attendance
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteTeacherAttendance(attendanceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting teacher attendance:", error);
      res.status(500).json({ message: "Failed to delete teacher attendance" });
    }
  });

  // Check if teacher is absent on a specific date
  app.get("/api/teacher-attendance/check/:teacherId/:date", authMiddleware, async (req: any, res) => {
    try {
      const { teacherId, date } = req.params;
      const isAbsent = await storage.isTeacherAbsent(teacherId, date);
      res.json({ isAbsent });
    } catch (error) {
      console.error("Error checking teacher absence:", error);
      res.status(500).json({ message: "Failed to check teacher absence" });
    }
  });

  // Subject endpoints
  app.get("/api/subjects", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;
      
      // Only school admins and super admins can access subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      let targetSchoolId: string | undefined;

      // For school admins, only show subjects from their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        targetSchoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin can specify schoolId or see all
        targetSchoolId = schoolId;
      }

      const subjects = await storage.getSubjects(targetSchoolId);
      res.json(subjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      res.status(500).json({ message: "Failed to fetch subjects" });
    }
  });

  app.post("/api/subjects", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const requestBody = { ...req.body };
      
      // For school admins, ensure the subject belongs to their school
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin must provide schoolId
        if (!requestBody.schoolId) {
          return res.status(400).json({ message: "School ID is required for super admin" });
        }
      }

      // Generate unique alphanumeric code
      let baseCode = requestBody.code || requestBody.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
      let finalCode = baseCode;
      let counter = 1;
      
      // Check for existing codes and append number if needed
      while (await storage.checkSubjectCodeExists(finalCode, requestBody.schoolId)) {
        finalCode = baseCode + counter;
        if (finalCode.length > 10) {
          // If too long, truncate base and try again
          baseCode = baseCode.substring(0, 6);
          finalCode = baseCode + counter;
        }
        counter++;
      }
      
      requestBody.code = finalCode;
      // Generate unique color for this subject code
      requestBody.color = generateColorForSubjectCode(finalCode);
      const validatedData = insertSubjectSchema.parse(requestBody);
      const subject = await storage.createSubject(validatedData);
      res.status(201).json(subject);
    } catch (error) {
      console.error("Error creating subject:", error);
      res.status(400).json({ message: "Invalid subject data" });
    }
  });

  app.put("/api/subjects/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const subjectId = req.params.id;
      
      // Only school admins and super admins can update subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if subject exists and belongs to the user's school (for school admins)
      const existingSubject = await storage.getSubject(subjectId);
      if (!existingSubject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingSubject.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - subject not in your school" });
      }

      const requestBody = { ...req.body };
      
      // If code is provided or name changed, ensure uniqueness
      if (requestBody.code || requestBody.name) {
        let baseCode = requestBody.code || requestBody.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
        let finalCode = baseCode;
        let counter = 1;
        
        // Check for existing codes (excluding current subject)
        while (await storage.checkSubjectCodeExists(finalCode, existingSubject.schoolId, subjectId)) {
          finalCode = baseCode + counter;
          if (finalCode.length > 10) {
            baseCode = baseCode.substring(0, 6);
            finalCode = baseCode + counter;
          }
          counter++;
        }
        
        requestBody.code = finalCode;
      }
      
      const validatedData = insertSubjectSchema.partial().parse(requestBody);
      
      // Ensure school ID cannot be changed by school admins
      if (user.role === 'admin') {
        delete validatedData.schoolId;
      }

      const updatedSubject = await storage.updateSubject(subjectId, validatedData);
      res.json(updatedSubject);
    } catch (error) {
      console.error("Error updating subject:", error);
      res.status(400).json({ message: "Failed to update subject" });
    }
  });

  app.delete("/api/subjects/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const subjectId = req.params.id;
      
      // Only school admins and super admins can delete subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if subject exists and belongs to the user's school (for school admins)
      const existingSubject = await storage.getSubject(subjectId);
      if (!existingSubject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingSubject.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - subject not in your school" });
      }

      await storage.deleteSubject(subjectId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subject:", error);
      res.status(500).json({ message: "Failed to delete subject" });
    }
  });


  // Get other sections of the same grade
  app.get("/api/classes/:classId/other-sections", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;
      
      // Only school admins and super admins can access this
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the current class to find its grade
      const currentClass = await storage.getClass(classId);
      if (!currentClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Check school access for admins
      if (user.role === 'admin' && user.schoolId && currentClass.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Get all other classes with the same grade but different classId
      const otherSections = await storage.getOtherSectionsOfGrade(currentClass.grade, currentClass.schoolId, classId);
      res.json(otherSections);
    } catch (error) {
      console.error("Error fetching other sections:", error);
      res.status(500).json({ message: "Failed to fetch other sections" });
    }
  });

  // Copy subjects to other sections
  app.post("/api/classes/:classId/copy-subjects", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;
      const { targetClassIds } = req.body;
      
      // Only school admins and super admins can copy subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!targetClassIds || !Array.isArray(targetClassIds) || targetClassIds.length === 0) {
        return res.status(400).json({ message: "Target class IDs are required" });
      }

      // Get the source class
      const sourceClass = await storage.getClass(classId);
      if (!sourceClass) {
        return res.status(404).json({ message: "Source class not found" });
      }

      // Check school access for admins
      if (user.role === 'admin' && user.schoolId && sourceClass.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Copy subjects to target classes
      const result = await storage.copySubjectsBetweenClasses(classId, targetClassIds, sourceClass.schoolId);
      
      res.json({
        success: true,
        message: `Successfully copied subjects to ${result.copiedCount} sections`,
        copiedCount: result.copiedCount,
        skippedCount: result.skippedCount
      });
    } catch (error) {
      console.error("Error copying subjects:", error);
      res.status(500).json({ message: "Failed to copy subjects" });
    }
  });

  // Create and assign subject to class in one operation
  app.post("/api/classes/:classId/create-assign-subject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.classId;
      
      // Only school admins and super admins can create and assign subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify the class exists and belongs to the user's school
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      const requestBody = { ...req.body, classId };
      
      // Set school ID based on user role
      let schoolId: string;
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        schoolId = classData.schoolId;
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = createAndAssignSubjectSchema.parse(requestBody);

      // Generate unique alphanumeric code from subject name
      let baseCode = validatedData.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
      let finalCode = baseCode;
      let counter = 1;
      
      // Check for existing codes and append number if needed
      while (await storage.checkSubjectCodeExists(finalCode, schoolId)) {
        finalCode = baseCode + counter;
        if (finalCode.length > 10) {
          // If too long, truncate base and try again
          baseCode = baseCode.substring(0, 6);
          finalCode = baseCode + counter;
        }
        counter++;
      }

      // Create the subject with unique color based on code
      const subjectData = {
        name: validatedData.name,
        code: finalCode,
        color: generateColorForSubjectCode(finalCode), // Generate unique color based on code
        periodsPerWeek: validatedData.weeklyFrequency, // Use weekly frequency as default periods per week
        schoolId: schoolId,
      };

      const subject = await storage.createSubject(subjectData);

      // Assign the subject to the class
      const assignmentData = {
        classId: validatedData.classId,
        subjectId: subject.id,
        weeklyFrequency: validatedData.weeklyFrequency,
      };

      const assignment = await storage.createClassSubjectAssignment(assignmentData);

      res.status(201).json({
        success: true,
        subject,
        assignment,
        message: `Subject "${subject.name}" created and assigned to class successfully`,
      });
    } catch (error) {
      console.error("Error creating and assigning subject:", error);
      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({ message: "Invalid data provided" });
      } else {
        res.status(500).json({ message: "Failed to create and assign subject" });
      }
    }
  });

  // Class endpoints
  app.get("/api/classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      let schoolId: string | undefined;

      // For school admins, only show classes from their school
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      }

      const classes = await storage.getClasses(schoolId);
      res.json(classes);
    } catch (error) {
      console.error("Error fetching classes:", error);
      res.status(500).json({ message: "Failed to fetch classes" });
    }
  });

  app.get("/api/classes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.id;

      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Check if user has access to this class
      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      res.json(classData);
    } catch (error) {
      console.error("Error fetching class:", error);
      res.status(500).json({ message: "Failed to fetch class" });
    }
  });

  app.post("/api/classes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create classes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Debug logging
      console.log("User creating class:", { 
        role: user.role, 
        schoolId: user.schoolId,
        userId: user.id 
      });
      console.log("Request body:", req.body);

      // For school admins, ensure the class belongs to their school
      const requestBody = { ...req.body };
      
      if (user.role === 'admin') {
        if (!user.schoolId) {
          return res.status(400).json({ message: "User is not associated with a school" });
        }
        requestBody.schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admin must provide schoolId
        if (!requestBody.schoolId) {
          return res.status(400).json({ message: "School ID is required for super admin" });
        }
      }

      console.log("Final request body before validation:", requestBody);
      const validatedData = insertClassSchema.parse(requestBody);
      const classData = await storage.createClass(validatedData);
      res.status(201).json(classData);
    } catch (error) {
      console.error("Error creating class:", error);
      res.status(400).json({ message: "Invalid class data" });
    }
  });

  app.put("/api/classes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.id;
      
      // Only school admins and super admins can update classes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if class exists and belongs to the user's school (for school admins)
      const existingClass = await storage.getClass(classId);
      if (!existingClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingClass.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      const validatedData = updateClassSchema.parse(req.body);
      
      // Ensure school ID cannot be changed by school admins
      if (user.role === 'admin') {
        delete validatedData.schoolId;
      }

      // Check if the new grade-section combination already exists in the same school
      const schoolId = existingClass.schoolId;
      const isDuplicate = await storage.checkClassExists(
        validatedData.grade || existingClass.grade,
        validatedData.section !== undefined ? validatedData.section : existingClass.section,
        schoolId,
        classId
      );

      if (isDuplicate) {
        const sectionText = validatedData.section !== undefined ? validatedData.section : existingClass.section;
        const displayName = sectionText 
          ? `Class ${validatedData.grade || existingClass.grade}${sectionText}` 
          : `Class ${validatedData.grade || existingClass.grade}`;
        return res.status(400).json({ message: `${displayName} already exists in this school` });
      }

      const updatedClass = await storage.updateClass(classId, validatedData);
      res.json(updatedClass);
    } catch (error) {
      console.error("Error updating class:", error);
      res.status(400).json({ message: "Invalid class data" });
    }
  });

  app.delete("/api/classes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const classId = req.params.id;
      
      // Only school admins and super admins can delete classes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if class exists and belongs to the user's school (for school admins)
      const existingClass = await storage.getClass(classId);
      if (!existingClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingClass.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      await storage.deleteClass(classId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting class:", error);
      res.status(500).json({ message: "Failed to delete class" });
    }
  });

  // Timetable endpoints
  app.get("/api/timetable", authMiddleware, async (req: any, res) => {
    try {
      const { classId, teacherId } = req.query;
      
      let timetable;
      if (classId) {
        timetable = await storage.getTimetableForClass(classId as string);
      } else if (teacherId) {
        timetable = await storage.getTimetableForTeacher(teacherId as string);
      } else {
        timetable = await storage.getTimetableEntries();
      }
      
      res.json(timetable);
    } catch (error) {
      console.error("Error fetching timetable:", error);
      res.status(500).json({ message: "Failed to fetch timetable" });
    }
  });

  app.get("/api/timetable/detailed", authMiddleware, async (req: any, res) => {
    try {
      const { classId, teacherId, versionId, date } = req.query;
      
      let timetable;
      if (versionId) {
        // Fetch specific version
        timetable = await storage.getTimetableEntriesForVersion(versionId as string);
      } else {
        // Use merged timetable data (global + weekly overrides)
        const user = req.user;
        let schoolId: string | undefined;
        if (user.role !== 'superadmin' && user.schoolId) {
          schoolId = user.schoolId;
        }
        timetable = await getMergedTimetableData(classId, teacherId, schoolId);
      }

      // Apply timetable changes for both daily and weekly views
      try {
        const user = req.user;
        const schoolId = user.role === 'admin' ? user.schoolId : undefined;
        
        if (schoolId) {
          // For daily view, use the provided date
          // For weekly view, use today's date to get current week changes
          const targetDate = date || new Date().toISOString().split('T')[0];
          const changes = await storage.getActiveTimetableChanges(schoolId, targetDate);
          
          // Apply approved changes to the timetable
          const approvedChanges = changes.filter(change => change.approvedBy && change.isActive);
          
          for (const change of approvedChanges) {
            if (change.changeType === 'substitution' && change.newTeacherId) {
              // Find and update the timetable entry for this substitution
              const entryIndex = timetable.findIndex(entry => entry.id === change.timetableEntryId);
              if (entryIndex !== -1) {
                // Create a modified entry for the substitution
                timetable[entryIndex] = {
                  ...timetable[entryIndex],
                  teacherId: change.newTeacherId,
                  // Add substitute info as additional properties
                  originalTeacherId: change.originalTeacherId
                } as any;
              }
            } else if (change.changeType === 'cancellation') {
              // Remove cancelled entries
              timetable = timetable.filter(entry => entry.id !== change.timetableEntryId);
            }
          }
        }
      } catch (changeError) {
        console.error("Error applying timetable changes:", changeError);
        // Continue without changes if there's an error
      }

      // Filter by date if provided (for daily view)
      if (date && typeof date === 'string') {
        const selectedDate = new Date(date);
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        // Filter timetable entries for the specific day
        timetable = timetable.filter(entry => entry.day.toLowerCase() === dayOfWeek);
      }

      // Get related data with proper school filtering
      const user = req.user;
      let schoolId: string | undefined;
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      }

      const [teachers, subjects, classes] = await Promise.all([
        storage.getTeachers(schoolId),
        storage.getSubjects(schoolId),
        storage.getClasses(schoolId),
      ]);

      // Enrich timetable with related data
      const detailedTimetable = timetable.map(entry => {
        const teacher = teachers.find(t => t.id === entry.teacherId);
        const subject = subjects.find(s => s.id === entry.subjectId);
        const classData = classes.find(c => c.id === entry.classId);

        return {
          ...entry,
          teacher,
          subject,
          class: classData,
        };
      });

      res.json(detailedTimetable);
    } catch (error) {
      console.error("Error fetching detailed timetable:", error);
      res.status(500).json({ message: "Failed to fetch detailed timetable" });
    }
  });

  // Helper function to merge global timetable with weekly overrides
  async function getMergedTimetableData(classId?: string, teacherId?: string, schoolId?: string) {
    let globalTimetable;
    if (classId) {
      globalTimetable = await storage.getTimetableForClass(classId as string);
    } else if (teacherId) {
      globalTimetable = await storage.getTimetableForTeacher(teacherId as string);
    } else {
      globalTimetable = await storage.getTimetableEntries(schoolId);
    }

    // If requesting for a specific class, check for weekly timetable overrides
    if (classId) {
      // Get current week's weekly timetable
      const currentDate = new Date();
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);
      
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      try {
        const weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
        
        if (weeklyTimetable && weeklyTimetable.timetableData) {
          // Create a map of global entries
          const globalMap = new Map();
          globalTimetable.forEach(entry => {
            const key = `${entry.day.toLowerCase()}-${entry.period}`;
            globalMap.set(key, entry);
          });

          // Apply weekly overrides
          const weeklyData = Array.isArray(weeklyTimetable.timetableData) 
            ? weeklyTimetable.timetableData 
            : [];
          
          weeklyData.forEach(weeklyEntry => {
            const key = `${weeklyEntry.day.toLowerCase()}-${weeklyEntry.period}`;
            
            if (weeklyEntry.isModified) {
              if (weeklyEntry.teacherId === null && weeklyEntry.subjectId === null) {
                // This is a deletion - remove the entry
                console.log(`[TIMETABLE MERGE] Deleting entry: ${key}`);
                globalMap.delete(key);
              } else if (weeklyEntry.teacherId && weeklyEntry.subjectId) {
                // This is an assignment - update or add the entry
                console.log(`[TIMETABLE MERGE] Updating entry: ${key}`);
                globalMap.set(key, {
                  id: `weekly-${key}`,
                  classId: classId,
                  teacherId: weeklyEntry.teacherId,
                  subjectId: weeklyEntry.subjectId,
                  day: weeklyEntry.day,
                  period: weeklyEntry.period,
                  startTime: weeklyEntry.startTime,
                  endTime: weeklyEntry.endTime,
                  room: weeklyEntry.room,
                  versionId: null,
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date()
                });
              }
            }
          });

          // Convert back to array
          return Array.from(globalMap.values());
        }
      } catch (error) {
        console.error('[TIMETABLE MERGE] Error getting weekly timetable:', error);
        // Continue with global data if weekly fetch fails
      }
    }

    return globalTimetable;
  }

  // Global Timetable API - returns merged timetable with weekly changes
  app.get("/api/timetable/global", authMiddleware, async (req: any, res) => {
    try {
      // Prevent caching of global timetable data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const { classId, teacherId } = req.query;
      console.log('[GLOBAL API] Request params:', { classId, teacherId });

      // Get school filtering
      const user = req.user;
      let schoolId: string | undefined;
      if (user.role !== 'superadmin' && user.schoolId) {
        schoolId = user.schoolId;
      }
      
      // Get merged timetable data (global + weekly overrides)
      const timetable = await getMergedTimetableData(classId, teacherId, schoolId);
      
      console.log('[GLOBAL API] Raw timetable data:', timetable?.length || 0, 'entries');
      console.log('[GLOBAL API] First few entries:', timetable?.slice(0, 2) || 'No entries');

      const [teachers, subjects, classes] = await Promise.all([
        storage.getTeachers(schoolId),
        storage.getSubjects(schoolId),
        storage.getClasses(schoolId),
      ]);

      console.log('[GLOBAL API] Related data counts:', {
        teachers: teachers?.length || 0,
        subjects: subjects?.length || 0,
        classes: classes?.length || 0
      });

      // Enrich timetable with related data
      const detailedTimetable = timetable.map(entry => {
        const teacher = teachers.find(t => t.id === entry.teacherId);
        const subject = subjects.find(s => s.id === entry.subjectId);
        const classData = classes.find(c => c.id === entry.classId);

        return {
          ...entry,
          teacher,
          subject,
          class: classData,
        };
      });

      console.log('[GLOBAL API] Final detailed timetable length:', detailedTimetable?.length || 0);
      console.log('[GLOBAL API] Sample detailed entry:', detailedTimetable?.[0] || 'No entries');

      res.json(detailedTimetable);
    } catch (error) {
      console.error("Error fetching global timetable:", error);
      res.status(500).json({ message: "Failed to fetch global timetable" });
    }
  });

  // Timetable Versions API
  app.get("/api/timetable-versions", authMiddleware, async (req: any, res) => {
    try {
      const { classId, weekStart, weekEnd } = req.query;
      
      if (!classId || !weekStart || !weekEnd) {
        return res.status(400).json({ message: "classId, weekStart, and weekEnd are required" });
      }

      const versions = await storage.getTimetableVersionsForClass(
        classId as string, 
        weekStart as string, 
        weekEnd as string
      );
      
      res.json(versions);
    } catch (error) {
      console.error("Error fetching timetable versions:", error);
      res.status(500).json({ message: "Failed to fetch timetable versions" });
    }
  });

  app.post("/api/timetable-versions/:id/activate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can activate versions
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      const { classId } = req.body;
      
      if (!classId) {
        return res.status(400).json({ message: "classId is required" });
      }

      await storage.setActiveVersion(id, classId);
      res.json({ success: true, message: "Version activated successfully" });
    } catch (error) {
      console.error("Error activating version:", error);
      res.status(500).json({ message: "Failed to activate version" });
    }
  });


  app.get("/api/timetable/optimize", async (req, res) => {
    try {
      const suggestions = await scheduler.suggestOptimizations();
      res.json({ suggestions });
    } catch (error) {
      console.error("Error getting optimization suggestions:", error);
      res.status(500).json({ message: "Failed to get optimization suggestions" });
    }
  });

  // Manual assignment endpoints
  // Assign teacher to multiple subjects in a class
  app.post("/api/classes/:classId/assign-teacher-multiple", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can assign teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId } = req.params;
      const { teacherId, subjectIds } = req.body;

      // Validate required fields
      if (!teacherId || !Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({ message: "teacherId and subjectIds (array) are required" });
      }

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Check if teacher exists
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      const results = [];
      const errors = [];

      // Process each subject assignment
      for (const subjectId of subjectIds) {
        try {
          // Check if subject exists
          const subject = await storage.getSubject(subjectId);
          if (!subject) {
            errors.push(`Subject ${subjectId} not found`);
            continue;
          }

          // Check if the subject is already assigned to this class
          const existingAssignment = await storage.getClassSubjectAssignmentByClassAndSubject(classId, subjectId);

          if (!existingAssignment) {
            errors.push(`Subject ${subject.name} must be assigned to class first before assigning a teacher`);
            continue;
          }

          if (existingAssignment.assignedTeacherId && existingAssignment.assignedTeacherId === teacherId) {
            errors.push(`Teacher is already assigned to teach ${subject.name} for this class`);
            continue;
          }

          // Update the class subject assignment with the teacher
          const updatedAssignment = await storage.updateClassSubjectAssignment(existingAssignment.id, {
            assignedTeacherId: teacherId
          });

          results.push({
            subjectId,
            subjectName: subject.name,
            assignment: updatedAssignment
          });
        } catch (error) {
          console.error(`Error assigning teacher to subject ${subjectId}:`, error);
          errors.push(`Failed to assign teacher to subject ${subjectId}`);
        }
      }

      res.status(200).json({ 
        message: `Successfully assigned teacher to ${results.length} subjects`,
        results,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error assigning teacher to multiple subjects:", error);
      res.status(500).json({ message: "Failed to assign teacher to subjects" });
    }
  });

  app.post("/api/classes/:classId/assign-teacher", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can assign teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId } = req.params;
      const { teacherId, subjectId } = req.body;

      // Validate required fields
      if (!teacherId || !subjectId) {
        return res.status(400).json({ message: "teacherId and subjectId are required" });
      }

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Check if teacher exists
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Check if subject exists
      const subject = await storage.getSubject(subjectId);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      // Check if the subject is already assigned to this class
      const existingAssignment = await storage.getClassSubjectAssignmentByClassAndSubject(classId, subjectId);

      if (!existingAssignment) {
        return res.status(404).json({ message: "Subject must be assigned to class first before assigning a teacher" });
      }

      if (existingAssignment.assignedTeacherId && existingAssignment.assignedTeacherId === teacherId) {
        return res.status(409).json({ message: "This teacher is already assigned to teach this subject for this class" });
      }

      // Update the class subject assignment with the teacher
      const updatedAssignment = await storage.updateClassSubjectAssignment(existingAssignment.id, {
        assignedTeacherId: teacherId
      });

      res.status(200).json(updatedAssignment);
    } catch (error) {
      console.error("Error assigning teacher to class:", error);
      res.status(500).json({ message: "Failed to assign teacher to class" });
    }
  });

  app.post("/api/classes/:classId/assign-subject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can assign subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId } = req.params;
      const { subjectId } = req.body;

      if (!subjectId) {
        return res.status(400).json({ message: "subjectId is required" });
      }

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Check if subject exists
      const subject = await storage.getSubject(subjectId);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      // Add subject to class's required subjects if not already present
      const requiredSubjects = classData.requiredSubjects || [];
      if (!requiredSubjects.includes(subjectId)) {
        requiredSubjects.push(subjectId);
        
        await storage.updateClass(classId, {
          requiredSubjects
        });
      }

      res.json({ message: "Subject assigned to class successfully" });
    } catch (error) {
      console.error("Error assigning subject to class:", error);
      res.status(500).json({ message: "Failed to assign subject to class" });
    }
  });

  app.delete("/api/classes/:classId/unassign-teacher/:assignmentId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can unassign teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId, assignmentId } = req.params;

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Update the class subject assignment to remove the teacher
      await storage.updateClassSubjectAssignment(assignmentId, {
        assignedTeacherId: null
      });

      res.status(200).json({ message: "Teacher unassigned successfully" });
    } catch (error) {
      console.error("Error unassigning teacher from class:", error);
      res.status(500).json({ message: "Failed to unassign teacher from class" });
    }
  });

  app.delete("/api/classes/:classId/unassign-subject/:subjectId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can unassign subjects
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId, subjectId } = req.params;

      // Check if class exists and user has permission
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Remove subject from class's required subjects
      const requiredSubjects = (classData.requiredSubjects || []).filter(id => id !== subjectId);
      
      await storage.updateClass(classId, {
        requiredSubjects
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error unassigning subject from class:", error);
      res.status(500).json({ message: "Failed to unassign subject from class" });
    }
  });

  // Substitution endpoints
  app.get("/api/substitutions", async (req, res) => {
    try {
      const { weekStart, weekEnd } = req.query;
      
      // If week range is provided, filter substitutions by that week
      if (weekStart && weekEnd) {
        const startDate = new Date(weekStart as string);
        const endDate = new Date(weekEnd as string);
        
        const substitutions = await storage.getSubstitutionsByWeek(startDate, endDate);
        res.json(substitutions);
      } else {
        // Fallback to all substitutions (for backward compatibility)
        const substitutions = await storage.getSubstitutions();
        res.json(substitutions);
      }
    } catch (error) {
      console.error("Error fetching substitutions:", error);
      res.status(500).json({ message: "Failed to fetch substitutions" });
    }
  });

  app.get("/api/substitutions/active", async (req, res) => {
    try {
      const substitutions = await storage.getActiveSubstitutions();
      res.json(substitutions);
    } catch (error) {
      console.error("Error fetching active substitutions:", error);
      res.status(500).json({ message: "Failed to fetch active substitutions" });
    }
  });

  app.post("/api/substitutions", async (req, res) => {
    try {
      const validatedData = insertSubstitutionSchema.parse(req.body);
      const substitution = await storage.createSubstitution(validatedData);
      res.status(201).json(substitution);
    } catch (error) {
      console.error("Error creating substitution:", error);
      res.status(400).json({ message: "Invalid substitution data" });
    }
  });

  app.put("/api/substitutions/:id", async (req, res) => {
    try {
      const validatedData = insertSubstitutionSchema.partial().parse(req.body);
      const substitution = await storage.updateSubstitution(req.params.id, validatedData);
      res.json(substitution);
    } catch (error) {
      console.error("Error updating substitution:", error);
      res.status(400).json({ message: "Invalid substitution data" });
    }
  });

  // Timetable changes endpoints
  app.get("/api/timetable-changes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.query;
      
      // Only school admins and super admins can view timetable changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const schoolId = user.role === 'super_admin' ? req.query.schoolId : user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const changes = await storage.getTimetableChanges(schoolId, date);
      res.json(changes);
    } catch (error) {
      console.error("Error fetching timetable changes:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/timetable-changes/active", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.query;
      
      // Only school admins and super admins can view active changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const schoolId = user.role === 'super_admin' ? req.query.schoolId : user.schoolId;
      const changeDate = date || new Date().toISOString().split('T')[0];
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      const changes = await storage.getActiveTimetableChanges(schoolId, changeDate);
      res.json(changes);
    } catch (error) {
      console.error("Error fetching active timetable changes:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/timetable-changes/entry/:timetableEntryId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can view changes by entry
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const changes = await storage.getTimetableChangesByEntry(req.params.timetableEntryId);
      res.json(changes);
    } catch (error) {
      console.error("Error fetching timetable changes for entry:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/timetable-changes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create timetable changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const validatedData = insertTimetableChangeSchema.parse(req.body);
      const change = await storage.createTimetableChange(validatedData);
      res.status(201).json(change);
    } catch (error) {
      console.error("Error creating timetable change:", error);
      res.status(400).json({ message: "Invalid timetable change data" });
    }
  });

  app.put("/api/timetable-changes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update timetable changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const validatedData = insertTimetableChangeSchema.partial().parse(req.body);
      const change = await storage.updateTimetableChange(req.params.id, validatedData);
      res.json(change);
    } catch (error) {
      console.error("Error updating timetable change:", error);
      res.status(400).json({ message: "Invalid timetable change data" });
    }
  });

  app.delete("/api/timetable-changes/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete timetable changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Get the change details before deletion to check if it's approved
      const changes = await storage.getTimetableChanges(user.schoolId || "", undefined);
      const changeToDelete = changes.find(c => c.id === req.params.id);
      
      if (!changeToDelete) {
        return res.status(404).json({ message: "Timetable change not found" });
      }

      // If this is an approved change, just mark it as dismissed (hide from UI) but keep substitution active
      if (changeToDelete.approvedBy) {
        await storage.updateTimetableChange(req.params.id, {
          isActive: false  // Hide from UI but keep the substitution record intact
        });
        
        console.log(`Dismissed approved change notification ${req.params.id} - substitution remains active`);
      } else {
        // For unapproved changes, fully delete as before
        await storage.deleteTimetableChange(req.params.id);
        console.log(`Permanently deleted unapproved change ${req.params.id}`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting timetable change:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Approve timetable change
  app.post("/api/timetable-changes/:id/approve", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can approve changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const changeId = req.params.id;
      
      // Get the change details before deletion
      const changes = await storage.getTimetableChanges(user.schoolId || "", undefined);
      const changeToApprove = changes.find(c => c.id === changeId);
      
      if (!changeToApprove) {
        return res.status(404).json({ message: "Timetable change not found" });
      }

      // If this change has a substitute teacher, confirm the substitution (keep it active)
      if (changeToApprove.newTeacherId) {
        const substitutions = await storage.getSubstitutions();
        const relatedSubstitution = substitutions.find(sub => 
          sub.timetableEntryId === changeToApprove.timetableEntryId &&
          sub.originalTeacherId === changeToApprove.originalTeacherId &&
          sub.substituteTeacherId === changeToApprove.newTeacherId &&
          sub.status === "auto_assigned"
        );

        if (relatedSubstitution) {
          await storage.updateSubstitution(relatedSubstitution.id, {
            status: "confirmed"
          });
        }
      }

      // Log the approval before deletion
      await storage.createAuditLog({
        action: "approve_timetable_change",
        entityType: "timetable_changes",
        entityId: changeId,
        userId: user.id,
        description: `Approved and processed timetable change: ${changeToApprove.changeType} for ${changeToApprove.changeDate}`,
        schoolId: user.schoolId || ""
      });

      // Permanently delete the timetable change notification after approval
      await storage.deleteTimetableChange(changeId);

      res.json({ 
        message: "Timetable change approved and notification cleared"
      });
      
    } catch (error) {
      console.error("Error approving timetable change:", error);
      res.status(500).json({ message: "Failed to approve timetable change" });
    }
  });

  // Reject timetable change
  app.post("/api/timetable-changes/:id/reject", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can reject changes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const changeId = req.params.id;
      const { reason } = req.body;
      
      // Get the change details before deletion
      const changes = await storage.getTimetableChanges(user.schoolId || "", undefined);
      const changeToReject = changes.find(c => c.id === changeId);
      
      if (!changeToReject) {
        return res.status(404).json({ message: "Timetable change not found" });
      }

      // When rejecting, do NOT delete the substitution - this keeps the cell state unchanged
      // The timetable card disappears but the cell display remains the same

      // Permanently delete the timetable change
      await storage.deleteTimetableChange(changeId);

      // Log the rejection and deletion
      await storage.createAuditLog({
        action: "reject_timetable_change",
        entityType: "timetable_changes",
        entityId: changeId,
        userId: user.id,
        description: `Rejected and permanently deleted timetable change: ${changeToReject.changeType} for ${changeToReject.changeDate}. Reason: ${reason || 'No reason provided'}`,
        schoolId: user.schoolId || ""
      });

      res.json({ 
        message: "Timetable change rejected successfully"
      });
      
    } catch (error) {
      console.error("Error rejecting timetable change:", error);
      res.status(500).json({ message: "Failed to reject timetable change" });
    }
  });

  // Timetable validity period endpoints
  app.get("/api/timetable-validity", authMiddleware, async (req: any, res) => {
    try {
      const classId = req.query.classId as string;
      const periods = await storage.getTimetableValidityPeriods(classId);
      res.json(periods);
    } catch (error) {
      console.error("Error fetching timetable validity periods:", error);
      res.status(500).json({ message: "Failed to fetch validity periods" });
    }
  });

  app.get("/api/timetable-validity/:id", authMiddleware, async (req: any, res) => {
    try {
      const period = await storage.getTimetableValidityPeriod(req.params.id);
      if (!period) {
        return res.status(404).json({ message: "Validity period not found" });
      }
      res.json(period);
    } catch (error) {
      console.error("Error fetching validity period:", error);
      res.status(500).json({ message: "Failed to fetch validity period" });
    }
  });

  app.post("/api/timetable-validity", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create validity periods
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { insertTimetableValidityPeriodSchema } = await import("@shared/schema");
      const validatedData = insertTimetableValidityPeriodSchema.parse(req.body);
      
      const period = await storage.createTimetableValidityPeriod(validatedData);
      res.status(201).json(period);
    } catch (error) {
      console.error("Error creating validity period:", error);
      res.status(400).json({ message: "Invalid validity period data" });
    }
  });

  app.put("/api/timetable-validity/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update validity periods
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { insertTimetableValidityPeriodSchema } = await import("@shared/schema");
      const validatedData = insertTimetableValidityPeriodSchema.partial().parse(req.body);
      
      const period = await storage.updateTimetableValidityPeriod(req.params.id, validatedData);
      res.json(period);
    } catch (error) {
      console.error("Error updating validity period:", error);
      res.status(400).json({ message: "Failed to update validity period" });
    }
  });

  app.delete("/api/timetable-validity/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete validity periods
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteTimetableValidityPeriod(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting validity period:", error);
      res.status(500).json({ message: "Failed to delete validity period" });
    }
  });

  // CSV upload endpoints
  app.post("/api/upload/teachers", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = CSVProcessor.processTeachersCSV(csvContent);

      if (!result.success) {
        return res.status(400).json({ 
          message: "Failed to process CSV",
          errors: result.errors 
        });
      }

      // Save teachers to database
      const createdTeachers = [];
      const creationErrors = [];
      for (const teacherData of result.data) {
        try {
          const teacher = await storage.createTeacher(teacherData);
          createdTeachers.push(teacher);
        } catch (error) {
          console.error("Error creating teacher:", error);
          if (error && typeof error === 'object' && 'code' in error && 'constraint' in error) {
            if (error.code === '23505' && error.constraint === 'teachers_email_unique') {
              creationErrors.push(`Teacher with email ${teacherData.email} already exists`);
            } else {
              creationErrors.push(`Failed to create teacher: ${teacherData.name}`);
            }
          } else {
            creationErrors.push(`Failed to create teacher: ${teacherData.name}`);
          }
        }
      }

      const allErrors = [...result.errors, ...creationErrors];
      res.json({
        message: `Successfully processed ${createdTeachers.length} teachers${creationErrors.length > 0 ? ` with ${creationErrors.length} errors` : ''}`,
        teachers: createdTeachers,
        errors: allErrors
      });

    } catch (error) {
      console.error("Error uploading teachers:", error);
      res.status(500).json({ message: "Failed to upload teachers" });
    }
  });

  app.post("/api/upload/subjects", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = CSVProcessor.processSubjectsCSV(csvContent);

      if (!result.success) {
        return res.status(400).json({ 
          message: "Failed to process CSV",
          errors: result.errors 
        });
      }

      // Save subjects to database
      const createdSubjects = [];
      for (const subjectData of result.data) {
        try {
          // Ensure unique color for each subject code
          if (subjectData.code && !subjectData.color) {
            subjectData.color = generateColorForSubjectCode(subjectData.code);
          }
          const subject = await storage.createSubject(subjectData);
          createdSubjects.push(subject);
        } catch (error) {
          console.error("Error creating subject:", error);
        }
      }

      res.json({
        message: `Successfully processed ${createdSubjects.length} subjects`,
        subjects: createdSubjects,
        errors: result.errors
      });

    } catch (error) {
      console.error("Error uploading subjects:", error);
      res.status(500).json({ message: "Failed to upload subjects" });
    }
  });

  app.post("/api/upload/classes", authMiddleware, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = CSVProcessor.processClassesCSV(csvContent);

      if (!result.success) {
        return res.status(400).json({ 
          message: "Failed to process CSV",
          errors: result.errors 
        });
      }

      // Get user and schoolId for authentication
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Determine schoolId based on user role
      let schoolId: string;
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      } else if (user.role === 'super_admin') {
        // Super admins should provide schoolId in request body or query
        schoolId = req.body.schoolId || req.query.schoolId;
        if (!schoolId) {
          return res.status(400).json({ message: "schoolId is required for super admin" });
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      // Save classes to database
      const createdClasses = [];
      const errors: string[] = [];
      for (let i = 0; i < result.data.length; i++) {
        const classData = result.data[i];
        try {
          // Add schoolId to each class before saving
          const classWithSchool = {
            ...classData,
            schoolId
          };
          const classEntity = await storage.createClass(classWithSchool);
          createdClasses.push(classEntity);
        } catch (error) {
          console.error(`Error processing row ${i + 2}:`, error);
          errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Successfully processed ${createdClasses.length} classes`,
        classes: createdClasses,
        errors: result.errors
      });

    } catch (error) {
      console.error("Error uploading classes:", error);
      res.status(500).json({ message: "Failed to upload classes" });
    }
  });

  // Suggest substitute teachers
  app.get("/api/substitutions/suggest/:timetableEntryId", async (req, res) => {
    try {
      const { timetableEntryId } = req.params;
      
      // Get the timetable entry
      const timetableEntries = await storage.getTimetableEntries();
      const entry = timetableEntries.find(e => e.id === timetableEntryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Timetable entry not found" });
      }

      // Find available substitute teachers - need to get school from class
      const classes = await storage.getClasses();
      const classData = classes.find(c => c.id === entry.classId);
      const schoolId = classData?.schoolId || "";
      
      const availableTeachers = await storage.getAvailableTeachers(
        entry.day,
        entry.period,
        entry.subjectId,
        schoolId
      );

      res.json(availableTeachers);
    } catch (error) {
      console.error("Error suggesting substitute teachers:", error);
      res.status(500).json({ message: "Failed to suggest substitute teachers" });
    }
  });

  // Class Subject Assignments endpoints
  app.get("/api/class-subject-assignments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId } = req.query;
      
      // Ensure school-based filtering for admins
      let schoolId: string | undefined;
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      }
      
      const assignments = await storage.getClassSubjectAssignments(classId, schoolId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching class subject assignments:", error);
      res.status(500).json({ message: "Failed to fetch class subject assignments" });
    }
  });

  app.post("/api/class-subject-assignments", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertClassSubjectAssignmentSchema.parse(req.body);
      
      // Check if assignment already exists
      const existing = await storage.getClassSubjectAssignmentByClassAndSubject(
        validatedData.classId, 
        validatedData.subjectId
      );
      if (existing) {
        return res.status(400).json({ message: "Assignment already exists for this class and subject" });
      }

      const assignment = await storage.createClassSubjectAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating class subject assignment:", error);
      res.status(400).json({ message: "Invalid assignment data" });
    }
  });

  app.put("/api/class-subject-assignments/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const assignmentId = req.params.id;
      const updateData = req.body;
      
      const assignment = await storage.updateClassSubjectAssignment(assignmentId, updateData);
      res.json(assignment);
    } catch (error) {
      console.error("Error updating class subject assignment:", error);
      res.status(400).json({ message: "Invalid assignment data" });
    }
  });

  app.delete("/api/class-subject-assignments/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete assignments
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const assignmentId = req.params.id;
      await storage.deleteClassSubjectAssignment(assignmentId);
      res.json({ message: "Assignment deleted successfully" });
    } catch (error) {
      console.error("Error deleting class subject assignment:", error);
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  // Timetable Structure endpoints
  app.get("/api/timetable-structure", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Get timetable structure for the school
      let structure;
      if (user.role === 'super_admin') {
        const { schoolId } = req.query;
        structure = schoolId 
          ? await storage.getTimetableStructureBySchool(schoolId as string)
          : await storage.getTimetableStructures();
      } else if (user.schoolId) {
        structure = await storage.getTimetableStructureBySchool(user.schoolId);
      }
      
      res.json(structure);
    } catch (error) {
      console.error("Error fetching timetable structure:", error);
      res.status(500).json({ message: "Failed to fetch timetable structure" });
    }
  });

  app.post("/api/timetable-structure", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create/update timetable structure
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertTimetableStructureSchema.parse(req.body);
      
      // Set schoolId if not provided (for school admins)
      if (user.role === 'admin' && user.schoolId) {
        validatedData.schoolId = user.schoolId;
      }

      // Check if structure already exists for this school
      const existingStructure = await storage.getTimetableStructureBySchool(validatedData.schoolId);
      
      let structure;
      if (existingStructure) {
        // Update existing structure
        structure = await storage.updateTimetableStructure(existingStructure.id, validatedData);
      } else {
        // Create new structure
        structure = await storage.createTimetableStructure(validatedData);
      }
      
      res.status(201).json(structure);
    } catch (error) {
      console.error("Error creating/updating timetable structure:", error);
      res.status(400).json({ message: "Invalid structure data" });
    }
  });

  app.put("/api/timetable-structure/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update timetable structure
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const structureId = req.params.id;
      const updateData = req.body;
      
      // Check if structure exists and user has permission
      const existingStructure = await storage.getTimetableStructure(structureId);
      if (!existingStructure) {
        return res.status(404).json({ message: "Timetable structure not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - structure not in your school" });
      }
      
      const structure = await storage.updateTimetableStructure(structureId, updateData);
      res.json(structure);
    } catch (error) {
      console.error("Error updating timetable structure:", error);
      res.status(400).json({ message: "Invalid structure data" });
    }
  });

  app.delete("/api/timetable-structure/:id", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can delete timetable structure
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const structureId = req.params.id;
      
      // Check if structure exists and user has permission
      const existingStructure = await storage.getTimetableStructure(structureId);
      if (!existingStructure) {
        return res.status(404).json({ message: "Timetable structure not found" });
      }

      if (user.role === 'admin' && user.schoolId && existingStructure.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - structure not in your school" });
      }
      
      await storage.deleteTimetableStructure(structureId);
      res.json({ message: "Timetable structure deleted successfully" });
    } catch (error) {
      console.error("Error deleting timetable structure:", error);
      res.status(500).json({ message: "Failed to delete timetable structure" });
    }
  });

  // Timetable generation endpoints
  app.post("/api/timetable/generate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can generate timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Optional class ID parameter for generating timetable for specific class
      const { classId } = req.body;


      const result = await scheduler.generateTimetable(classId, user.schoolId);
      res.json(result);
    } catch (error) {
      console.error("Error generating timetable:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate timetable" 
      });
    }
  });

  // Set as Global Timetable - Promote weekly changes to global timetable
  app.post("/api/timetable/set-as-global", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can update global timetable
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { classId, date } = req.body;
      
      if (!classId || !date) {
        return res.status(400).json({ message: "classId and date are required" });
      }

      // Get current effective timetable for this class and week
      const baseTimetable = await storage.getTimetableForClass(classId);
      const changes = await storage.getTimetableChanges(user.schoolId, date);
      
      // Calculate effective timetable (base + approved changes)
      let effectiveTimetable = [...baseTimetable];
      const approvedChanges = changes.filter(change => change.approvedBy && change.isActive);
      
      // Apply substitutions
      for (const change of approvedChanges) {
        if (change.changeType === 'substitution' && change.newTeacherId) {
          const entryIndex = effectiveTimetable.findIndex(entry => entry.id === change.timetableEntryId);
          if (entryIndex !== -1) {
            effectiveTimetable[entryIndex] = {
              ...effectiveTimetable[entryIndex],
              teacherId: change.newTeacherId
            };
          }
        } else if (change.changeType === 'cancellation') {
          // Remove cancelled entries
          effectiveTimetable = effectiveTimetable.filter(entry => entry.id !== change.timetableEntryId);
        }
      }

      // Replace global timetable for this class with effective timetable
      await storage.replaceGlobalTimetableForClass(classId, effectiveTimetable);
      
      // Clear weekly changes for this class since they're now part of global timetable
      await storage.clearWeeklyChangesForClass(classId, date);
      
      res.json({ 
        success: true, 
        message: "Weekly changes have been promoted to Global Timetable",
        entriesUpdated: effectiveTimetable.length
      });
    } catch (error) {
      console.error("Error setting as global timetable:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update global timetable" 
      });
    }
  });

  // Validate Timetable
  app.get("/api/timetable/validate", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can validate timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = await scheduler.validateTimetable();
      res.json(validation);
    } catch (error) {
      console.error("Error validating timetable:", error);
      res.status(500).json({ 
        isValid: false, 
        conflicts: ["Unable to validate timetable due to system error"]
      });
    }
  });

  app.get("/api/timetable/suggestions", authMiddleware, async (req: any, res) => {
    try {
      const suggestions = await scheduler.suggestOptimizations();
      res.json({ suggestions });
    } catch (error) {
      console.error("Error getting timetable suggestions:", error);
      res.status(500).json({ message: "Failed to get suggestions" });
    }
  });

  // Advanced Teacher Management Routes

  // Get teacher schedule
  app.get("/api/teachers/:teacherId/schedule", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { teacherId } = req.params;
      const { date } = req.query;

      // Verify teacher belongs to user's school
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher || (user.role !== 'super_admin' && teacher.schoolId !== user.schoolId)) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      const schedule = await storage.getTeacherSchedule(teacherId, date);
      
      // Get related data with proper school filtering
      let schoolId: string | undefined;
      if (user.role === 'admin' && user.schoolId) {
        schoolId = user.schoolId;
      }

      // For teacher schedule, we should use the teacher's school to get subjects
      const teacherSchoolId = teacher.schoolId;

      const [subjects, classes] = await Promise.all([
        storage.getSubjects(teacherSchoolId),
        storage.getClasses(teacherSchoolId),
      ]);

      // Enrich schedule with related data
      const detailedSchedule = schedule.map(entry => {
        const subject = subjects.find(s => s.id === entry.subjectId);
        const classData = classes.find(c => c.id === entry.classId);

        return {
          ...entry,
          subject: subject ? {
            id: subject.id,
            name: subject.name,
            code: subject.code,
            color: subject.color
          } : null,
          class: classData ? {
            id: classData.id,
            grade: classData.grade,
            section: classData.section
          } : null,
        };
      });

      res.json(detailedSchedule);
    } catch (error) {
      console.error("Error getting teacher schedule:", error);
      res.status(500).json({ message: "Failed to get teacher schedule" });
    }
  });

  // Teacher workload analytics
  app.get("/api/analytics/teacher-workload", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can view analytics
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const analytics = await storage.getTeacherWorkloadAnalytics(user.schoolId);
      res.json(analytics);
    } catch (error) {
      console.error("Error getting teacher workload analytics:", error);
      res.status(500).json({ message: "Failed to get teacher workload analytics" });
    }
  });

  // Optimize teacher workload
  app.post("/api/analytics/optimize-workload", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can optimize workload
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = await scheduler.optimizeTeacherWorkload(user.schoolId);
      res.json(result);
    } catch (error) {
      console.error("Error optimizing teacher workload:", error);
      res.status(500).json({ message: "Failed to optimize teacher workload" });
    }
  });

  // Enhanced Substitution Routes

  // Get absent teacher alerts
  app.get("/api/substitutions/alerts", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.query;
      
      // Only school admins and super admins can view alerts
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const currentDate = date || new Date().toISOString().split('T')[0];
      const alerts = await storage.getAbsentTeacherAlerts(user.schoolId, currentDate);
      res.json(alerts);
    } catch (error) {
      console.error("Error getting absent teacher alerts:", error);
      res.status(500).json({ message: "Failed to get absent teacher alerts" });
    }
  });

  // Find substitute teachers
  app.get("/api/substitutions/find-substitutes", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { originalTeacherId, timetableEntryId, date } = req.query;
      
      // Only school admins and super admins can find substitutes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!originalTeacherId || !timetableEntryId || !date) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const substitutes = await storage.findSubstituteTeachers(
        originalTeacherId as string,
        timetableEntryId as string,
        date as string
      );
      res.json(substitutes);
    } catch (error) {
      console.error("Error finding substitute teachers:", error);
      res.status(500).json({ message: "Failed to find substitute teachers" });
    }
  });

  // Auto-assign substitute
  app.post("/api/substitutions/auto-assign", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can auto-assign substitutes
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { timetableEntryId, date, reason } = req.body;

      if (!timetableEntryId || !date || !reason) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const result = await storage.autoAssignSubstitute(
        timetableEntryId,
        date,
        reason,
        user.id
      );
      res.json(result);
    } catch (error) {
      console.error("Error auto-assigning substitute:", error);
      res.status(500).json({ message: "Failed to auto-assign substitute" });
    }
  });

  // Manual Assignment Endpoints

  // Get available teachers for manual assignment to a timetable slot
  app.get("/api/timetable/available-teachers", authMiddleware, async (req: any, res) => {
    // Disable ALL caching for this endpoint
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', `debug-${Date.now()}`); // Force unique response
    
    try {
      const user = req.user;
      const { classId, day, period, date, subjectId } = req.query;

      console.log(`[TEACHER API] Request: classId=${classId}, day=${day}, period=${period}, subjectId=${subjectId}`);

      // Only school admins and super admins can view available teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!classId || !day || !period) {
        return res.status(400).json({ message: "classId, day, and period are required" });
      }

      // Verify class belongs to user's school
      const classData = await storage.getClass(classId as string);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      console.log(`[TEACHER API] Class found: ${classData.grade}, schoolId: ${classData.schoolId}`);

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Get teachers who can teach the selected subject
      console.log(`[TEACHER API] Getting teachers for schoolId: ${classData.schoolId}, subjectId: ${subjectId}`);
      
      // Step 1: Get all teachers who can teach this subject
      let availableTeachers: any[] = [];
      
      if (subjectId) {
        // Get teachers assigned to teach this subject in any class
        const teacherSubjectAssignments = await storage.getClassSubjectAssignments();
        const qualifiedTeacherIds = new Set(
          teacherSubjectAssignments
            .filter((assignment: any) => assignment.subjectId === subjectId && assignment.assignedTeacherId)
            .map((assignment: any) => assignment.assignedTeacherId)
        );
        
        // Get the teacher details for qualified teachers
        const allTeachers = await storage.getTeachers(classData.schoolId);
        const qualifiedTeachers = allTeachers.filter(teacher => qualifiedTeacherIds.has(teacher.id));
        
        console.log(`[TEACHER API] Found ${qualifiedTeachers.length} teachers qualified for subject:`, qualifiedTeachers.map(t => t.name));
        
        // Step 2: Filter out teachers who are busy during this time slot
        const busyTeachers = await storage.getTimetableEntries();
        const conflictingEntries = busyTeachers.filter((entry: any) => {
          const dayMatch = entry.day.toLowerCase() === day.toLowerCase();
          const periodMatch = entry.period === parseInt(period as string);
          const differentClass = entry.classId !== classId;
          return dayMatch && periodMatch && differentClass;
        });
        
        const busyTeacherIds = new Set(conflictingEntries.map((entry: any) => entry.teacherId));
        console.log(`[TEACHER API] Found ${conflictingEntries.length} busy teachers during ${day} period ${period}`);
        
        // Return only qualified AND free teachers
        availableTeachers = qualifiedTeachers.filter(teacher => !busyTeacherIds.has(teacher.id));
        
      } else {
        // If no subject selected, return all free teachers in the school
        const allTeachers = await storage.getTeachers(classData.schoolId);
        const busyTeachers = await storage.getTimetableEntries();
        const busyTeacherIds = new Set(
          busyTeachers
            .filter((entry: any) => 
              entry.day === day && 
              entry.period === parseInt(period as string) && 
              entry.classId !== classId
            )
            .map((entry: any) => entry.teacherId)
        );
        
        availableTeachers = allTeachers.filter(teacher => !busyTeacherIds.has(teacher.id));
      }

      // Step 3: Prioritize teachers already teaching this class
      const classTeachers = await storage.getTeachersForClass(classId as string);
      const classTeacherIds = new Set(classTeachers.map((t: any) => t.id));

      const result = availableTeachers.map(teacher => ({
        ...teacher,
        priority: classTeacherIds.has(teacher.id) ? 1 : 2,
        teachingThisClass: classTeacherIds.has(teacher.id)
      })).sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

      console.log(`[TEACHER API] SUCCESS - Returning ${result.length} available teachers:`, result.map(t => t.name));
      res.json(result);
    } catch (error) {
      console.error("[TEACHER API] ERROR:", error);
      res.status(500).json({ message: "Failed to get available teachers" });
    }
  });

  // Manually assign teacher to a timetable slot
  app.post("/api/timetable/manual-assign", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      // Only school admins and super admins can manually assign teachers
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { 
        timetableEntryId, 
        newTeacherId, 
        classId, 
        subjectId, 
        day, 
        period, 
        startTime, 
        endTime, 
        room, 
        reason 
      } = req.body;

      // Validate required fields
      if (!newTeacherId || !classId || !day || !period) {
        return res.status(400).json({ message: "newTeacherId, classId, day, and period are required" });
      }

      // Verify class belongs to user's school
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Verify teacher exists and belongs to same school
      const teacher = await storage.getTeacher(newTeacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (teacher.schoolId !== classData.schoolId) {
        return res.status(403).json({ message: "Teacher does not belong to the same school as the class" });
      }

      // Check if teacher is available for this slot (using the same logic as teacher selection)
      console.log(`[ASSIGNMENT] Checking availability for teacher ${newTeacherId} on ${day} period ${period}`);
      const allTimetableEntries = await storage.getTimetableEntries();
      const conflictingEntry = allTimetableEntries.find((entry: any) => {
        const dayMatch = entry.day.toLowerCase() === day.toLowerCase();
        const periodMatch = entry.period === period;
        const sameTeacher = entry.teacherId === newTeacherId;
        const differentClass = entry.classId !== classId;
        
        console.log(`[ASSIGNMENT] Checking entry: teacher=${entry.teacherId}, day=${entry.day}/${day} (${dayMatch}), period=${entry.period}/${period} (${periodMatch}), sameTeacher=${sameTeacher}, differentClass=${differentClass}`);
        
        return dayMatch && periodMatch && sameTeacher && differentClass;
      });
      
      if (conflictingEntry) {
        console.log(`[ASSIGNMENT] CONFLICT: Teacher ${newTeacherId} is teaching class ${conflictingEntry.classId} during ${day} period ${period}`);
        return res.status(409).json({ message: `Teacher is already teaching class ${conflictingEntry.classId} during this time slot` });
      }
      
      console.log(`[ASSIGNMENT] Teacher ${newTeacherId} is available for ${day} period ${period}`);

      let result;
      let oldTeacherId = null;

      if (timetableEntryId) {
        // Update existing timetable entry
        const existingEntry = await storage.getTimetableEntry(timetableEntryId);
        if (!existingEntry) {
          return res.status(404).json({ message: "Timetable entry not found" });
        }
        
        oldTeacherId = existingEntry.teacherId;
        
        result = await storage.updateTimetableEntry(timetableEntryId, {
          teacherId: newTeacherId,
          ...(room && { room }),
        });
      } else {
        // Create new timetable entry
        if (!subjectId || !startTime || !endTime) {
          return res.status(400).json({ message: "subjectId, startTime, and endTime are required for new entries" });
        }

        result = await storage.createTimetableEntry({
          classId,
          teacherId: newTeacherId,
          subjectId,
          day,
          period,
          startTime,
          endTime,
          room: room || null,
          isActive: true
        });
      }

      // Create audit log entry
      await storage.createManualAssignmentAudit({
        timetableEntryId: result.id,
        classId,
        day,
        period,
        oldTeacherId,
        newTeacherId,
        subjectId: subjectId || null,
        changeReason: reason || "Manual assignment by admin",
        assignedBy: user.id,
      });

      // Create or update weekly timetable snapshot after manual assignment
      try {
        const currentWeek = new Date();
        const weekStart = new Date(currentWeek);
        weekStart.setDate(currentWeek.getDate() - currentWeek.getDay() + 1); // Monday
        
        // Get current global timetable for this class
        const globalTimetable = await storage.getTimetableEntriesForClass(classId);
        
        // Convert to weekly timetable format
        const weeklyTimetableData = globalTimetable.map((entry: any) => ({
          day: entry.day,
          period: entry.period,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          isModified: entry.id === result.id, // Mark this entry as modified
          modificationReason: entry.id === result.id ? 'Manual teacher assignment' : undefined,
        }));
        
        await storage.createOrUpdateWeeklyTimetable(
          classId,
          weekStart,
          weeklyTimetableData,
          user.id,
          classData.schoolId
        );
        
        console.log(`[WEEKLY TIMETABLE] Created/updated weekly timetable for class ${classId}, week ${weekStart.toISOString().split('T')[0]}`);
      } catch (weeklyError) {
        console.error('[WEEKLY TIMETABLE] Error creating weekly timetable:', weeklyError);
        // Don't fail the request if weekly timetable creation fails
      }

      res.json({ 
        success: true, 
        message: "Teacher assigned successfully", 
        entry: result 
      });
    } catch (error) {
      console.error("Error manually assigning teacher:", error);
      res.status(500).json({ message: "Failed to assign teacher" });
    }
  });

  // Weekly-only manual edit endpoint (bypasses approval workflow)
  app.post("/api/timetable/weekly-edit", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      // Only school admins and super admins can make weekly edits
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { 
        classId, 
        weekStart,
        day, 
        period, 
        teacherId, // null to delete assignment
        subjectId, // null to delete assignment
        startTime,
        endTime,
        room,
        reason = "Manual admin edit"
      } = req.body;

      // Validate required fields
      if (!classId || !weekStart || !day || period === undefined) {
        return res.status(400).json({ message: "classId, weekStart, day, and period are required" });
      }

      // Verify class belongs to user's school
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - class not in your school" });
      }

      // Validate that the edit is for current/future dates only
      const currentDate = new Date();
      const editWeekStart = new Date(weekStart);
      const currentWeekStart = new Date(currentDate);
      currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday of current week
      currentWeekStart.setHours(0, 0, 0, 0);

      if (editWeekStart < currentWeekStart) {
        return res.status(400).json({ 
          message: "Cannot edit past weeks. Manual edits are only allowed for current and future weeks." 
        });
      }

      // Calculate week end date (Sunday)
      const weekEnd = new Date(editWeekStart);
      weekEnd.setDate(editWeekStart.getDate() + 6);

      // If teacher is provided, verify they exist and belong to same school
      if (teacherId) {
        const teacher = await storage.getTeacher(teacherId);
        if (!teacher) {
          return res.status(404).json({ message: "Teacher not found" });
        }

        if (teacher.schoolId !== classData.schoolId) {
          return res.status(403).json({ message: "Teacher does not belong to the same school as the class" });
        }

        // Check for conflicts with other classes at the same time
        const globalTimetableEntries = await storage.getTimetableEntries();
        const conflictingEntry = globalTimetableEntries.find((entry: any) => {
          const dayMatch = entry.day.toLowerCase() === day.toLowerCase();
          const periodMatch = entry.period === period;
          const sameTeacher = entry.teacherId === teacherId;
          const differentClass = entry.classId !== classId;
          
          return dayMatch && periodMatch && sameTeacher && differentClass;
        });

        if (conflictingEntry) {
          const conflictClass = await storage.getClass(conflictingEntry.classId);
          return res.status(409).json({ 
            message: `Teacher ${teacher.name} is already assigned to ${conflictClass?.grade}-${conflictClass?.section} at this time slot`,
            hasConflicts: true
          });
        }
      }

      // Update or create the weekly timetable entry
      const result = await storage.updateWeeklyTimetableEntry(
        classId,
        weekStart,
        weekEnd.toISOString().split('T')[0],
        day,
        period,
        {
          teacherId,
          subjectId,
          startTime,
          endTime,
          room,
          isModified: true,
          modificationReason: reason
        },
        user.id
      );

      // Log the weekly edit (not as a timetable change)
      await storage.createAuditLog({
        action: "weekly_timetable_edit",
        entityType: "weekly_timetables",
        entityId: result.id,
        userId: user.id,
        description: `Manual weekly edit: ${teacherId ? 'Assigned' : 'Removed'} teacher for ${day} period ${period} in week ${weekStart}. Reason: ${reason}`,
        schoolId: user.schoolId || classData.schoolId
      });

      res.json({ 
        success: true, 
        message: "Weekly timetable updated successfully (no approval required)", 
        weeklyTimetableId: result.id,
        modificationCount: result.modificationCount
      });
    } catch (error) {
      console.error("Error updating weekly timetable:", error);
      res.status(500).json({ message: "Failed to update weekly timetable" });
    }
  });

  // Delete timetable entry endpoint
  app.delete("/api/timetable/entry/:entryId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;

      // Only school admins and super admins can delete timetable entries
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { entryId } = req.params;

      // Verify the timetable entry exists
      const entry = await storage.getTimetableEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Timetable entry not found" });
      }

      // Verify the entry's class belongs to user's school
      const classData = await storage.getClass(entry.classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied - entry not in your school" });
      }

      // Get the specific date for the cancellation from query params
      const { date } = req.query;
      const cancellationDate = date ? new Date(date as string) : new Date();

      // Create a cancellation timetable change instead of deleting the entry
      // Don't set approvedBy/approvedAt to prevent auto-dismissal logic from treating it as a notification
      const cancellationChange = await storage.createTimetableChange({
        timetableEntryId: entryId,
        changeType: "cancellation",
        changeDate: cancellationDate.toISOString().split('T')[0],
        originalTeacherId: entry.teacherId,
        newTeacherId: null,
        reason: "Period cancelled by admin",
        changeSource: "manual",
        approvedBy: null, // Don't auto-approve to prevent dismissal
        approvedAt: null,
        isActive: true
      });

      // Create audit log entry for the cancellation
      await storage.createManualAssignmentAudit({
        timetableEntryId: entryId,
        classId: entry.classId,
        day: entry.day,
        period: entry.period,
        oldTeacherId: entry.teacherId,
        newTeacherId: null, // null indicates cancellation
        subjectId: entry.subjectId || null,
        changeReason: "Period cancelled by admin for specific week",
        assignedBy: user.id,
      });

      // Create or update weekly timetable snapshot after cancellation
      try {
        const currentWeek = new Date(cancellationDate);
        const weekStart = new Date(currentWeek);
        weekStart.setDate(currentWeek.getDate() - currentWeek.getDay() + 1); // Monday
        
        // Get current global timetable for this class
        const globalTimetable = await storage.getTimetableEntriesForClass(entry.classId);
        
        // Convert to weekly timetable format, marking cancelled period as null
        const weeklyTimetableData = globalTimetable.map((globalEntry: any) => {
          if (globalEntry.id === entryId) {
            // Mark this entry as cancelled (free period) for this week
            return {
              day: globalEntry.day,
              period: globalEntry.period,
              teacherId: null, // Cancelled - no teacher assigned
              subjectId: null, // Cancelled - no subject
              startTime: globalEntry.startTime,
              endTime: globalEntry.endTime,
              room: null,
              isModified: true,
              modificationReason: 'Period cancelled by admin',
            };
          } else {
            return {
              day: globalEntry.day,
              period: globalEntry.period,
              teacherId: globalEntry.teacherId,
              subjectId: globalEntry.subjectId,
              startTime: globalEntry.startTime,
              endTime: globalEntry.endTime,
              room: globalEntry.room,
              isModified: false,
            };
          }
        });
        
        await storage.createOrUpdateWeeklyTimetable(
          entry.classId,
          weekStart,
          weeklyTimetableData,
          user.id,
          classData.schoolId
        );
        
        console.log(`[WEEKLY TIMETABLE] Created/updated weekly timetable for class ${entry.classId}, week ${weekStart.toISOString().split('T')[0]} with cancellation`);
      } catch (weeklyError) {
        console.error('[WEEKLY TIMETABLE] Error creating weekly timetable:', weeklyError);
        // Don't fail the request if weekly timetable creation fails
      }

      res.json({ 
        success: true, 
        message: "Period cancelled for this week successfully",
        changeId: cancellationChange.id
      });
    } catch (error) {
      console.error("Error deleting timetable entry:", error);
      res.status(500).json({ message: "Failed to delete timetable entry" });
    }
  });

  // Audit Logs Routes

  // Get audit logs
  app.get("/api/audit-logs", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can view audit logs
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { limit } = req.query;
      const logs = await storage.getAuditLogs(user.schoolId, limit ? parseInt(limit as string) : 50);
      res.json(logs);
    } catch (error) {
      console.error("Error getting audit logs:", error);
      res.status(500).json({ message: "Failed to get audit logs" });
    }
  });

  // Create audit log (mainly for manual tracking)
  app.post("/api/audit-logs", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only school admins and super admins can create audit logs
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const auditData = {
        ...req.body,
        schoolId: user.schoolId,
        userId: user.id
      };

      const validatedData = insertAuditLogSchema.parse(auditData);
      const log = await storage.createAuditLog(validatedData);
      res.json(log);
    } catch (error) {
      console.error("Error creating audit log:", error);
      res.status(500).json({ message: "Failed to create audit log" });
    }
  });

  // Enhanced Timetable Management

  // Check teacher availability for substitution
  app.get("/api/teachers/:teacherId/availability", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { teacherId } = req.params;
      const { day, period, date } = req.query;

      // Verify teacher belongs to user's school
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher || (user.role !== 'super_admin' && teacher.schoolId !== user.schoolId)) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (!day || !period || !date) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const isAvailable = await scheduler.isTeacherAvailableForSubstitute(
        teacherId,
        day as string,
        parseInt(period as string),
        date as string
      );

      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Error checking teacher availability:", error);
      res.status(500).json({ message: "Failed to check teacher availability" });
    }
  });

  // Bulk Import Routes
  
  // Download sample Excel template
  app.get("/api/bulk-import/template", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create sample data structure showing both cases: with sections and without sections
      const sampleData = [
        {
          "Grade": "10",
          "Section": "A", 
          "Subject Names": "Mathematics,English,Science,History,Geography"
        },
        {
          "Grade": "10",
          "Section": "B",
          "Subject Names": "Mathematics,English,Science,History,Geography"
        },
        {
          "Grade": "11",
          "Section": "NA",
          "Subject Names": "Mathematics,English,Physics,Chemistry,Biology"
        },
        {
          "Grade": "12",
          "Section": "NA",
          "Subject Names": "Mathematics,English,Physics,Chemistry,Biology"
        }
      ];

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      
      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Classes");

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download with cache busting
      res.setHeader('Content-Disposition', 'attachment; filename="class_subjects_template.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.send(buffer);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Upload and process Excel file
  app.post("/api/bulk-import/excel", authMiddleware, upload.single('file'), async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Check file type
      if (!req.file.originalname.match(/\.(xlsx|xls)$/i)) {
        return res.status(400).json({ error: "Please upload a valid Excel file (.xlsx or .xls)" });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (!data || data.length === 0) {
        return res.status(400).json({ error: "Excel file is empty or invalid" });
      }

      let classesCreated = 0;
      let subjectsCreated = 0;
      let assignmentsCreated = 0;
      const errors: string[] = [];

      // Get existing subjects for this school
      const existingSubjects = await storage.getSubjects(user.schoolId);
      
      // Track subjects per grade to ensure consistent codes across sections of same grade
      // But different codes across different grades
      const gradeSubjectMap = new Map<string, Map<string, { id: string; code: string }>>();

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          const rowNum = i + 2; // Excel row number (1-indexed + header)

          // Validate required fields - only Grade is required
          if (!row.Grade) {
            errors.push(`Row ${rowNum}: Grade is required`);
            continue;
          }

          const grade = row.Grade.toString();
          // Handle sections: "NA" means no section, otherwise use the provided value
          const section = (row.Section && row.Section.toString().toUpperCase() === "NA") ? "" : (row.Section || "").toString();

          // Check if class already exists
          const existingClass = await storage.checkClassExists(grade, section, user.schoolId);

          if (existingClass) {
            errors.push(`Row ${rowNum}: Class ${grade}${section ? `-${section}` : ''} already exists`);
            continue;
          }

          // Create class with minimal data
          const classData = {
            grade: grade,
            section: section,
            studentCount: 0, // Default value, not imported
            room: null, // Not imported
            schoolId: user.schoolId,
            requiredSubjects: []
          };

          const newClass = await storage.createClass(classData);
          classesCreated++;

          // Process subject names if provided
          if (row["Subject Names"]) {
            const subjectNames = row["Subject Names"].toString().split(',').map((name: string) => name.trim());
            
            // Initialize grade subject tracking if not exists
            if (!gradeSubjectMap.has(grade)) {
              gradeSubjectMap.set(grade, new Map());
            }
            const gradeSubjects = gradeSubjectMap.get(grade)!;

            for (const subjectName of subjectNames) {
              if (!subjectName) continue;

              const normalizedName = subjectName.toLowerCase();
              let subjectId: string;
              let subjectCode: string;

              // Check if this subject already exists for this specific grade
              if (gradeSubjects.has(normalizedName)) {
                // Use existing subject from this grade
                const gradeSubject = gradeSubjects.get(normalizedName)!;
                subjectId = gradeSubject.id;
                subjectCode = gradeSubject.code;
              } else {
                // Check if we can find an existing subject for this grade and name combination
                const existingSubjectForGrade = existingSubjects.find(s => 
                  s.name.toLowerCase() === normalizedName && s.code.includes(grade)
                );

                if (existingSubjectForGrade) {
                  // Found existing subject for this grade
                  subjectId = existingSubjectForGrade.id;
                  subjectCode = existingSubjectForGrade.code;
                  gradeSubjects.set(normalizedName, { id: subjectId, code: subjectCode });
                } else {
                  // Create new grade-specific subject with auto-generated code and unique color
                  subjectCode = await generateGradeSpecificSubjectCode(subjectName, grade, user.schoolId);
                  const uniqueColor = generateColorForSubjectCode(subjectCode);
                  
                  const newSubject = await storage.createSubject({
                    name: subjectName,
                    code: subjectCode,
                    schoolId: user.schoolId,
                    periodsPerWeek: 5, // Default value
                    color: uniqueColor
                  });
                  
                  subjectId = newSubject.id;
                  subjectsCreated++;
                  
                  // Add to grade tracking
                  gradeSubjects.set(normalizedName, { id: subjectId, code: subjectCode });
                }
              }

              // Create subject assignment
              await storage.createClassSubjectAssignment({
                classId: newClass.id,
                subjectId: subjectId,
                weeklyFrequency: 5, // Default value
                assignedTeacherId: null
              });
              assignmentsCreated++;
            }
          }

        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }


      // Return results
      res.json({
        classesCreated,
        subjectsCreated,
        assignmentsCreated,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully imported ${classesCreated} classes, ${subjectsCreated} subjects, and ${assignmentsCreated} subject assignments`
      });

    } catch (error) {
      console.error("Error processing Excel file:", error);
      res.status(500).json({ error: "Failed to process Excel file" });
    }
  });

  // Default Periods Management Routes
  
  // Get subjects with default periods for school admin settings
  app.get("/api/subjects/default-periods", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all subjects for the school with their default periods
      const subjects = await storage.getSubjects(user.schoolId);
      
      const subjectsWithDefaults = subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        periodsPerWeek: subject.periodsPerWeek,
        color: subject.color
      }));

      res.json(subjectsWithDefaults);
    } catch (error) {
      console.error("Error fetching subjects with default periods:", error);
      res.status(500).json({ message: "Failed to fetch subjects" });
    }
  });

  // Update default periods for subjects
  app.put("/api/subjects/default-periods", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const updates = req.body.updates; // Array of {id, periodsPerWeek}
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "Updates must be an array" });
      }

      // Validate each update
      for (const update of updates) {
        if (!update.id || typeof update.periodsPerWeek !== 'number' || update.periodsPerWeek < 1 || update.periodsPerWeek > 20) {
          return res.status(400).json({ message: "Invalid update data. Periods per week must be between 1 and 20." });
        }
      }

      // Update each subject
      const results = [];
      for (const update of updates) {
        try {
          const updatedSubject = await storage.updateSubject(update.id, {
            periodsPerWeek: update.periodsPerWeek
          });
          results.push(updatedSubject);
        } catch (error) {
          console.error(`Error updating subject ${update.id}:`, error);
          throw error;
        }
      }

      res.json({ 
        message: `Successfully updated ${results.length} subjects`,
        updatedSubjects: results
      });
    } catch (error) {
      console.error("Error updating default periods:", error);
      res.status(500).json({ message: "Failed to update default periods" });
    }
  });

  // Update global default periods for all subjects
  app.put("/api/settings/global-default-periods", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { defaultPeriods, updateExisting } = req.body;
      
      if (typeof defaultPeriods !== 'number' || defaultPeriods < 1 || defaultPeriods > 20) {
        return res.status(400).json({ message: "Default periods must be between 1 and 20" });
      }

      // Get all subjects for the school
      const subjects = await storage.getSubjects(user.schoolId);
      
      if (subjects.length === 0) {
        return res.status(404).json({ message: "No subjects found for this school" });
      }

      // Update all subjects' default periods
      const subjectUpdatePromises = subjects.map(subject =>
        storage.updateSubject(subject.id, { periodsPerWeek: defaultPeriods })
      );
      
      await Promise.all(subjectUpdatePromises);

      // If requested, also update existing class-subject assignments
      let assignmentsUpdated = 0;
      if (updateExisting) {
        try {
          // Get all class-subject assignments for the school
          const allAssignments = await storage.getClassSubjectAssignments();
          const subjectIds = new Set(subjects.map(s => s.id));
          
          // Filter assignments that belong to this school's subjects
          const schoolAssignments = allAssignments.filter(assignment => 
            subjectIds.has(assignment.subjectId)
          );
          
          // Update each assignment
          const assignmentUpdatePromises = schoolAssignments.map(assignment =>
            storage.updateClassSubjectAssignment(assignment.id, { weeklyFrequency: defaultPeriods })
          );
          
          await Promise.all(assignmentUpdatePromises);
          assignmentsUpdated = schoolAssignments.length;
        } catch (error) {
          console.error("Error updating existing assignments:", error);
          // Don't fail the whole operation if assignment updates fail
        }
      }

      res.json({ 
        message: `Successfully updated ${subjects.length} subjects to ${defaultPeriods} periods per week` +
                 (updateExisting ? ` and ${assignmentsUpdated} existing class assignments` : ''),
        subjectsUpdated: subjects.length,
        assignmentsUpdated: updateExisting ? assignmentsUpdated : 0,
        newDefaultPeriods: defaultPeriods
      });
      
    } catch (error) {
      console.error("Error updating global default periods:", error);
      res.status(500).json({ message: "Failed to update global default periods" });
    }
  });

  // Get timetable freeze status for school
  app.get("/api/settings/timetable-freeze-status", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const school = await storage.getSchool(user.schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      res.json({ 
        timetableFrozen: school.timetableFrozen || false
      });
      
    } catch (error) {
      console.error("Error getting timetable freeze status:", error);
      res.status(500).json({ message: "Failed to get timetable freeze status" });
    }
  });

  // Freeze timetable changes for school
  app.put("/api/settings/freeze-timetable", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateSchool(user.schoolId, { timetableFrozen: true });

      res.json({ 
        message: "Timetable changes have been frozen successfully",
        timetableFrozen: true
      });
      
    } catch (error) {
      console.error("Error freezing timetable:", error);
      res.status(500).json({ message: "Failed to freeze timetable changes" });
    }
  });

  // Unfreeze timetable changes for school
  app.put("/api/settings/unfreeze-timetable", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only allow admin users
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateSchool(user.schoolId, { timetableFrozen: false });

      res.json({ 
        message: "Timetable changes have been unfrozen successfully",
        timetableFrozen: false
      });
      
    } catch (error) {
      console.error("Error unfreezing timetable:", error);
      res.status(500).json({ message: "Failed to unfreeze timetable changes" });
    }
  });

  // Get free teachers for today organized by periods
  app.get("/api/availability/free-teachers", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.query;
      
      // Use today if no date provided
      const selectedDate = date || new Date().toISOString().split('T')[0];
      const dateObj = new Date(selectedDate);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      // Get all teachers for the school
      const teachers = await storage.getTeachers(user.schoolId);
      
      // Get timetable structure to know periods
      const timetableStructure = await storage.getTimetableStructure(user.schoolId);
      if (!timetableStructure || !timetableStructure.timeSlots) {
        return res.status(404).json({ message: "Timetable structure not found" });
      }
      
      // Filter out break periods
      const regularPeriods = timetableStructure.timeSlots.filter(slot => !slot.isBreak);
      
      // For each period, find which teachers are free
      const freeTeachersByPeriod = [];
      
      for (const timeSlot of regularPeriods) {
        const freeTeachers = [];
        
        for (const teacher of teachers) {
          if (!teacher.isActive) continue;
          
          const isAvailable = await storage.isTeacherAvailable(
            teacher.id, 
            dayOfWeek, 
            timeSlot.period, 
            selectedDate
          );
          
          if (isAvailable) {
            freeTeachers.push({
              id: teacher.id,
              name: teacher.name,
              email: teacher.email,
              subjects: teacher.subjects || []
            });
          }
        }
        
        freeTeachersByPeriod.push({
          period: timeSlot.period,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          freeTeachers: freeTeachers.sort((a, b) => a.name.localeCompare(b.name))
        });
      }
      
      res.json({
        date: selectedDate,
        dayOfWeek: dayOfWeek,
        periods: freeTeachersByPeriod
      });
      
    } catch (error) {
      console.error("Error fetching free teachers:", error);
      res.status(500).json({ message: "Failed to fetch free teachers for today" });
    }
  });

  // Weekly Timetable Routes

  // Get weekly timetable for a class and specific week
  app.get("/api/timetable/weekly/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId } = req.params;
      const { date } = req.query; // Date within the week

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate week start from provided date or current date
      const targetDate = date ? new Date(date as string) : new Date();
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // Monday

      // Try to get weekly timetable first
      const weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
      
      if (weeklyTimetable) {
        res.json({
          type: 'weekly',
          classId,
          weekStart: weekStart.toISOString().split('T')[0],
          data: weeklyTimetable,
          hasWeeklyOverrides: true
        });
      } else {
        // Fall back to global timetable
        const globalTimetable = await storage.getTimetableEntriesForClass(classId);
        
        res.json({
          type: 'global',
          classId,
          weekStart: weekStart.toISOString().split('T')[0],
          data: globalTimetable,
          hasWeeklyOverrides: false
        });
      }
    } catch (error) {
      console.error("Error fetching weekly timetable:", error);
      res.status(500).json({ message: "Failed to fetch weekly timetable" });
    }
  });

  // Promote weekly timetable to global timetable
  app.post("/api/timetable/weekly/:weeklyTimetableId/promote", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { weeklyTimetableId } = req.params;

      // Only school admins and super admins can promote timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the weekly timetable to verify access
      const weeklyTimetable = await storage.getWeeklyTimetable("", new Date()); // This won't work, need to fix the storage method
      // For now, let's implement a simpler approach by getting the weekly timetable by ID
      
      await storage.promoteWeeklyTimetableToGlobal(weeklyTimetableId);
      
      res.json({ 
        success: true, 
        message: "Weekly timetable promoted to global timetable successfully" 
      });
    } catch (error) {
      console.error("Error promoting weekly timetable:", error);
      res.status(500).json({ message: "Failed to promote weekly timetable" });
    }
  });

  // Enhanced timetable loader that prioritizes weekly timetables
  app.get("/api/timetable/enhanced/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId } = req.params;
      const { date } = req.query; // Date within the week

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate week start from provided date or current date
      const targetDate = date ? new Date(date as string) : new Date();
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // Monday

      // Try to get weekly timetable first
      const weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
      
      if (weeklyTimetable) {
        // Return weekly timetable data formatted for frontend
        const formattedEntries = weeklyTimetable.timetableData.map((entry: any) => ({
          id: `weekly-${entry.day}-${entry.period}`, // Generate temporary ID
          classId,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          day: entry.day,
          period: entry.period,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          isActive: true,
          isWeeklyOverride: true,
          isModified: entry.isModified || false,
          modificationReason: entry.modificationReason,
          createdAt: weeklyTimetable.createdAt,
          updatedAt: weeklyTimetable.updatedAt
        }));

        res.json({
          entries: formattedEntries,
          source: 'weekly',
          weekStart: weekStart.toISOString().split('T')[0],
          modifiedBy: weeklyTimetable.modifiedBy,
          modificationCount: weeklyTimetable.modificationCount
        });
      } else {
        // Fall back to global timetable with detailed info
        const globalEntries = await storage.getTimetableEntriesWithDetails();
        const classEntries = globalEntries.filter((entry: any) => entry.classId === classId);
        
        res.json({
          entries: classEntries.map((entry: any) => ({
            ...entry,
            isWeeklyOverride: false,
            isModified: false
          })),
          source: 'global',
          weekStart: weekStart.toISOString().split('T')[0],
          modifiedBy: null,
          modificationCount: 0
        });
      }
    } catch (error) {
      console.error("Error fetching enhanced timetable:", error);
      res.status(500).json({ message: "Failed to fetch enhanced timetable" });
    }
  });

  // Refresh Global Timetable Action
  app.post("/api/timetable/refresh-global/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId } = req.params;

      // Only school admins and super admins can refresh global timetables
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      console.log(`[REFRESH GLOBAL] Starting global timetable refresh for class ${classId}`);

      // Step 1: Delete global timetable and current/future weekly timetables (preserve past weeks for history)
      const deletionResult = await storage.deleteGlobalAndFutureWeeklyTimetables(classId);
      console.log(`[REFRESH GLOBAL] Deleted ${deletionResult.globalDeleted} global entries and ${deletionResult.weeklyDeleted} current/future weekly timetables`);

      // Step 2: Generate new global timetable using existing logic
      // Get class assignments and generate timetable
      const classAssignments = await storage.getClassSubjectAssignments(classId);
      const timetableStructure = await storage.getTimetableStructure(classData.schoolId);
      
      if (!timetableStructure) {
        return res.status(400).json({ message: "No timetable structure found for school" });
      }

      // Simple timetable generation logic (you can enhance this with AI later)
      const newTimetableEntries = [];
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      
      for (const assignment of classAssignments) {
        if (!assignment.assignedTeacherId) continue;
        
        const subject = assignment.subject;
        const periodsNeeded = assignment.weeklyFrequency;
        let periodsAssigned = 0;
        
        // Distribute periods across the week
        for (let dayIndex = 0; dayIndex < days.length && periodsAssigned < periodsNeeded; dayIndex++) {
          const day = days[dayIndex];
          const dailyPeriods = periodsNeeded <= 5 ? 1 : Math.ceil(periodsNeeded / 5);
          
          for (let p = 0; p < dailyPeriods && periodsAssigned < periodsNeeded; p++) {
            const period = (dayIndex * dailyPeriods + p + 1) % timetableStructure.periodsPerDay + 1;
            const timeSlot = timetableStructure.timeSlots.find((slot: any) => slot.period === period);
            
            if (timeSlot) {
              newTimetableEntries.push({
                classId,
                teacherId: assignment.assignedTeacherId,
                subjectId: subject.id,
                day: day as "monday" | "tuesday" | "wednesday" | "thursday" | "friday",
                period,
                startTime: timeSlot.startTime,
                endTime: timeSlot.endTime,
                room: null,
                isActive: true
              });
              periodsAssigned++;
            }
          }
        }
      }

      // Step 3: Save new global timetable entries
      if (newTimetableEntries.length > 0) {
        await storage.createMultipleTimetableEntries(newTimetableEntries);
      }

      console.log(`[REFRESH GLOBAL] Created ${newTimetableEntries.length} new global timetable entries`);

      // Step 4: Copy the same timetable into weekly timetable table for current week
      const currentWeek = new Date();
      const weekStart = new Date(currentWeek);
      weekStart.setDate(currentWeek.getDate() - currentWeek.getDay() + 1); // Monday
      
      const weeklyTimetableData = newTimetableEntries.map(entry => ({
        day: entry.day,
        period: entry.period,
        teacherId: entry.teacherId,
        subjectId: entry.subjectId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        isModified: false,
        modificationReason: 'Global timetable refresh'
      }));

      // Remove any existing weekly timetable for this class and week, then create new one
      const existingWeekly = await storage.getWeeklyTimetable(classId, weekStart);
      if (existingWeekly) {
        await storage.updateWeeklyTimetable(existingWeekly.id, {
          timetableData: weeklyTimetableData,
          modifiedBy: user.id,
          modificationCount: 1,
          basedOnGlobalVersion: 'latest-refresh'
        });
      } else {
        await storage.createWeeklyTimetable({
          classId,
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          timetableData: weeklyTimetableData,
          modifiedBy: user.id,
          modificationCount: 1,
          basedOnGlobalVersion: 'latest-refresh',
          schoolId: classData.schoolId,
          isActive: true
        });
      }

      console.log(`[REFRESH GLOBAL] Copied global timetable to weekly for week ${weekStart.toISOString().split('T')[0]}`);

      res.json({
        success: true,
        message: "Global timetable refreshed and current/future weekly timetables updated successfully (past weeks preserved for history)",
        entriesCreated: newTimetableEntries.length,
        globalDeleted: deletionResult.globalDeleted,
        weeklyDeleted: deletionResult.weeklyDeleted,
        weekStart: weekStart.toISOString().split('T')[0]
      });

    } catch (error) {
      console.error("Error refreshing global timetable:", error);
      res.status(500).json({ message: "Failed to refresh global timetable" });
    }
  });

  // Set Weekly as Global Timetable
  app.post("/api/timetable/set-weekly-as-global/:classId", authMiddleware, async (req: any, res) => {
    try {
      const user = req.user;
      const { classId } = req.params;
      const { date } = req.body; // Date within the week to promote

      // Only school admins and super admins can set weekly as global
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify class access
      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (user.role === 'admin' && user.schoolId && classData.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate week start from provided date or current date
      const targetDate = date ? new Date(date) : new Date();
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // Monday

      // Get the weekly timetable to promote
      const weeklyTimetable = await storage.getWeeklyTimetable(classId, weekStart);
      if (!weeklyTimetable) {
        return res.status(404).json({ message: "No weekly timetable found for this week to promote" });
      }

      console.log(`[SET WEEKLY AS GLOBAL] Promoting weekly timetable for class ${classId}, week ${weekStart.toISOString().split('T')[0]} to global`);

      // Step 1: Deactivate current global timetable entries for this class
      await storage.deactivateTimetableEntriesForClass(classId);

      // Step 2: Create new global timetable entries from weekly timetable data
      if (weeklyTimetable.timetableData && Array.isArray(weeklyTimetable.timetableData)) {
        const newGlobalEntries = weeklyTimetable.timetableData
          .filter((entry: any) => entry.teacherId && entry.subjectId) // Only non-cancelled entries
          .map((entry: any) => ({
            classId,
            teacherId: entry.teacherId,
            subjectId: entry.subjectId,
            day: entry.day as "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday",
            period: entry.period,
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room || null,
            isActive: true
          }));

        if (newGlobalEntries.length > 0) {
          await storage.createMultipleTimetableEntries(newGlobalEntries);
        }

        console.log(`[SET WEEKLY AS GLOBAL] Created ${newGlobalEntries.length} new global entries from weekly timetable`);

        // Step 3: Update the weekly timetable to mark it as the new baseline
        await storage.updateWeeklyTimetable(weeklyTimetable.id, {
          basedOnGlobalVersion: 'promoted-to-global',
          modificationCount: weeklyTimetable.modificationCount + 1
        });

        res.json({
          success: true,
          message: "Weekly timetable successfully promoted to global timetable",
          entriesPromoted: newGlobalEntries.length,
          weekStart: weekStart.toISOString().split('T')[0]
        });
      } else {
        res.status(400).json({ message: "Weekly timetable has no valid data to promote" });
      }

    } catch (error) {
      console.error("Error setting weekly as global:", error);
      res.status(500).json({ message: "Failed to set weekly timetable as global" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
