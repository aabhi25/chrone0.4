import {
  teachers,
  subjects,
  classes,
  timetableEntries,
  substitutions,
  timetableValidityPeriods,
  classSubjectAssignments,
  timetableStructures,
  timetableVersions,
  timetableChanges,
  users,
  schools,
  teacherAttendance,
  auditLogs,
  teacherReplacements,
  weeklyTimetables,
  type Teacher,
  type InsertTeacher,
  type Subject,
  type InsertSubject,
  type Class,
  type InsertClass,
  type TimetableEntry,
  type InsertTimetableEntry,
  type TimetableValidityPeriod,
  type InsertTimetableValidityPeriod,
  type ClassSubjectAssignment,
  type InsertClassSubjectAssignment,
  type TimetableStructure,
  type InsertTimetableStructure,
  type TimetableVersion,
  type InsertTimetableVersion,
  type Substitution,
  type InsertSubstitution,
  type TimetableChange,
  type InsertTimetableChange,
  type User,
  type InsertUser,
  type School,
  type InsertSchool,
  type TeacherAttendance,
  type InsertTeacherAttendance,
  type BulkAttendanceData,
  type AuditLog,
  type InsertAuditLog,
  type UpdateTeacherDailyPeriods,
  manualAssignmentAudits,
  type ManualAssignmentAudit, 
  type InsertManualAssignmentAudit,
  type TeacherReplacement,
  type InsertTeacherReplacement,
  type WeeklyTimetable,
  type InsertWeeklyTimetable
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, inArray, sql, ne, gte, lte, between } from "drizzle-orm";
import { getCurrentDateIST, getCurrentDateTimeIST } from "@shared/utils/dateUtils";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersBySchoolId(schoolId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;

  // School operations
  getSchools(): Promise<School[]>;
  getSchoolsWithAdminEmails(): Promise<(School & { adminEmail?: string })[]>;
  getSchool(id: string): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: string, school: Partial<InsertSchool>): Promise<School>;
  deleteSchool(id: string): Promise<void>;

  // Teacher operations
  getTeachers(schoolId?: string): Promise<Teacher[]>;
  getTeacher(id: string): Promise<Teacher | undefined>;
  getTeacherCountBySchool(schoolId: string): Promise<number>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: string, teacher: Partial<InsertTeacher>): Promise<Teacher>;
  deleteTeacher(id: string): Promise<void>;
  getAvailableTeachers(day: string, period: number, subjectId: string, schoolId: string): Promise<Teacher[]>;
  updateTeacherDailyPeriods(schoolId: string, config: UpdateTeacherDailyPeriods): Promise<{ success: boolean; message: string }>;
  getTeacherSchedule(teacherId: string, date?: string): Promise<TimetableEntry[]>;
  getTeacherWorkloadAnalytics(schoolId: string): Promise<any>;
  getTimetableEntriesByTeacher(teacherId: string): Promise<TimetableEntry[]>;
  
  // Teacher Replacement operations
  createTeacherReplacement(replacement: InsertTeacherReplacement): Promise<TeacherReplacement>;
  getAllTeacherReplacements(): Promise<TeacherReplacement[]>;
  getTeacherReplacementsBySchool(schoolId: string): Promise<TeacherReplacement[]>;

  // Subject operations
  getSubjects(schoolId?: string): Promise<Subject[]>;
  getSubject(id: string): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: string, subject: Partial<InsertSubject>): Promise<Subject>;
  deleteSubject(id: string): Promise<void>;
  checkSubjectCodeExists(code: string, schoolId: string, excludeId?: string): Promise<boolean>;

  // Class operations
  getClasses(schoolId?: string): Promise<Class[]>;
  getClass(id: string): Promise<Class | undefined>;
  createClass(classData: InsertClass): Promise<Class>;
  updateClass(id: string, classData: Partial<InsertClass>): Promise<Class>;
  deleteClass(id: string): Promise<void>;
  checkClassExists(grade: string, section: string | null, schoolId: string, excludeId?: string): Promise<boolean>;
  getOtherSectionsOfGrade(grade: string, schoolId: string, excludeClassId: string): Promise<Class[]>;
  copySubjectsBetweenClasses(sourceClassId: string, targetClassIds: string[], schoolId: string): Promise<{ copiedCount: number; skippedCount: number }>;

  // Class Subject Assignment operations
  getClassSubjectAssignments(classId?: string): Promise<any[]>;
  getClassSubjectAssignment(id: string): Promise<ClassSubjectAssignment | undefined>;
  createClassSubjectAssignment(assignment: InsertClassSubjectAssignment): Promise<ClassSubjectAssignment>;
  updateClassSubjectAssignment(id: string, assignment: Partial<InsertClassSubjectAssignment>): Promise<ClassSubjectAssignment>;
  deleteClassSubjectAssignment(id: string): Promise<void>;
  getClassSubjectAssignmentByClassAndSubject(classId: string, subjectId: string): Promise<ClassSubjectAssignment | undefined>;

  // Timetable operations
  getTimetableEntries(): Promise<TimetableEntry[]>;
  getTimetableForClass(classId: string): Promise<TimetableEntry[]>;
  getTimetableForTeacher(teacherId: string): Promise<TimetableEntry[]>;
  createTimetableEntry(entry: InsertTimetableEntry): Promise<TimetableEntry>;
  updateTimetableEntry(id: string, entry: Partial<InsertTimetableEntry>): Promise<TimetableEntry>;
  deleteTimetableEntry(id: string): Promise<void>;
  clearTimetable(): Promise<void>;
  bulkCreateTimetableEntries(entries: InsertTimetableEntry[]): Promise<TimetableEntry[]>;

  // Timetable version operations
  createTimetableVersion(version: InsertTimetableVersion): Promise<TimetableVersion>;
  getTimetableVersionsForClass(classId: string, weekStart: string, weekEnd: string): Promise<TimetableVersion[]>;
  getTimetableEntriesForVersion(versionId: string): Promise<TimetableEntry[]>;
  setActiveVersion(versionId: string, classId: string): Promise<void>;
  getActiveTimetableVersion(classId: string, weekStart: string, weekEnd: string): Promise<TimetableVersion | null>;

  // Substitution operations
  getSubstitutions(): Promise<Substitution[]>;
  getSubstitution(id: string): Promise<Substitution | undefined>;
  createSubstitution(substitution: InsertSubstitution): Promise<Substitution>;
  updateSubstitution(id: string, substitution: Partial<InsertSubstitution>): Promise<Substitution>;
  deleteSubstitution(id: string): Promise<void>;
  getActiveSubstitutions(): Promise<Substitution[]>;
  
  // Timetable changes operations
  getTimetableChanges(schoolId: string, date?: string): Promise<TimetableChange[]>;
  getTimetableChangesByEntry(timetableEntryId: string): Promise<TimetableChange[]>;
  createTimetableChange(change: InsertTimetableChange): Promise<TimetableChange>;
  updateTimetableChange(id: string, change: Partial<InsertTimetableChange>): Promise<TimetableChange>;
  deleteTimetableChange(id: string): Promise<void>;
  getActiveTimetableChanges(schoolId: string, date: string): Promise<TimetableChange[]>;

  // Timetable validity period operations
  getTimetableValidityPeriods(classId?: string): Promise<TimetableValidityPeriod[]>;
  getTimetableValidityPeriod(id: string): Promise<TimetableValidityPeriod | undefined>;
  createTimetableValidityPeriod(period: InsertTimetableValidityPeriod): Promise<TimetableValidityPeriod>;
  updateTimetableValidityPeriod(id: string, period: Partial<InsertTimetableValidityPeriod>): Promise<TimetableValidityPeriod>;
  deleteTimetableValidityPeriod(id: string): Promise<void>;

  // Teacher attendance operations
  getTeacherAttendance(schoolId: string, date?: string): Promise<TeacherAttendance[]>;
  getTeacherAttendanceByTeacher(teacherId: string, startDate?: string, endDate?: string): Promise<TeacherAttendance[]>;
  markTeacherAttendance(attendance: InsertTeacherAttendance): Promise<TeacherAttendance>;
  markBulkTeacherAttendance(bulkData: BulkAttendanceData, markedBy: string): Promise<TeacherAttendance[]>;
  updateTeacherAttendance(id: string, attendance: Partial<InsertTeacherAttendance>): Promise<TeacherAttendance>;
  deleteTeacherAttendance(id: string): Promise<void>;
  isTeacherAbsent(teacherId: string, date: string): Promise<boolean>;

  // Timetable Structure operations
  getTimetableStructures(schoolId?: string): Promise<TimetableStructure[]>;
  getTimetableStructure(id: string): Promise<TimetableStructure | undefined>;
  getTimetableStructureBySchool(schoolId: string): Promise<TimetableStructure | undefined>;
  createTimetableStructure(structure: InsertTimetableStructure): Promise<TimetableStructure>;
  updateTimetableStructure(id: string, structure: Partial<InsertTimetableStructure>): Promise<TimetableStructure>;
  deleteTimetableStructure(id: string): Promise<void>;

  // Analytics
  getStats(schoolId: string): Promise<{
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
    todaySubstitutions: number;
  }>;
  
  getAdminDashboardStats(): Promise<{
    totalSchools: number;
    activeSchools: number;
    inactiveSchools: number;
    schoolAdminLogins: Array<{
      schoolName: string;
      adminName: string;
      lastLogin: Date | null;
    }>;
    schoolTeacherCounts: Array<{
      schoolName: string;
      activeTeachers: number;
    }>;
  }>;

  // Audit log operations
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(schoolId: string, limit?: number): Promise<AuditLog[]>;

  // Enhanced substitution operations
  getAbsentTeacherAlerts(schoolId: string, date: string): Promise<any[]>;
  findSubstituteTeachers(originalTeacherId: string, timetableEntryId: string, date: string): Promise<Teacher[]>;
  autoAssignSubstitute(timetableEntryId: string, date: string, reason: string, assignedBy: string): Promise<{ success: boolean; substitution?: Substitution; message: string }>;

  // Manual assignment operations
  getTeachersForClass(classId: string): Promise<Teacher[]>;
  createManualAssignmentAudit(audit: InsertManualAssignmentAudit): Promise<ManualAssignmentAudit>;
  getTimetableEntry(id: string): Promise<TimetableEntry | undefined>;
  updateTimetableEntry(id: string, entry: Partial<InsertTimetableEntry>): Promise<TimetableEntry>;
  createTimetableEntry(entry: InsertTimetableEntry): Promise<TimetableEntry>;
  isTeacherAvailable(teacherId: string, day: string, period: number, date?: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsersBySchoolId(schoolId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.schoolId, schoolId));
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // School operations
  async getSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getSchoolsWithAdminEmails(): Promise<(School & { adminEmail?: string })[]> {
    const schoolsWithAdmins = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        contactPhone: schools.contactPhone,
        adminName: schools.adminName,
        isActive: schools.isActive,
        createdAt: schools.createdAt,
        updatedAt: schools.updatedAt,
        adminEmail: users.email,
      })
      .from(schools)
      .leftJoin(users, and(eq(schools.id, users.schoolId), eq(users.role, "admin")));
    
    return schoolsWithAdmins.map(school => ({
      ...school,
      adminEmail: school.adminEmail || undefined
    }));
  }

  async getSchool(id: string): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school;
  }

  async createSchool(schoolData: InsertSchool): Promise<School> {
    const [school] = await db.insert(schools).values(schoolData).returning();
    return school;
  }

  async updateSchool(id: string, schoolData: Partial<InsertSchool>): Promise<School> {
    const [school] = await db
      .update(schools)
      .set({ ...schoolData, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();
    
    if (!school) {
      throw new Error(`School with id ${id} not found`);
    }
    
    return school;
  }

  async deleteSchool(id: string): Promise<void> {
    await db.delete(schools).where(eq(schools.id, id));
  }

  // Teacher operations
  async getTeachers(schoolId?: string): Promise<Teacher[]> {
    if (schoolId) {
      return await db.select().from(teachers).where(
        and(eq(teachers.isActive, true), eq(teachers.schoolId, schoolId))
      );
    }
    return await db.select().from(teachers).where(eq(teachers.isActive, true));
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
    return teacher;
  }

  async getTeacherCountBySchool(schoolId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(teachers)
      .where(and(eq(teachers.schoolId, schoolId), eq(teachers.isActive, true)));
    return result[0]?.count || 0;
  }

  async createTeacher(teacher: InsertTeacher): Promise<Teacher> {
    const insertData: any = { ...teacher };
    if (teacher.subjects) {
      insertData.subjects = teacher.subjects;
    }
    const [created] = await db.insert(teachers).values(insertData).returning();
    return created;
  }

  async updateTeacher(id: string, teacher: Partial<InsertTeacher>): Promise<Teacher> {
    const updateData: any = { ...teacher, updatedAt: new Date() };
    if (teacher.subjects) {
      updateData.subjects = teacher.subjects; // Keep as array, don't stringify
    }
    const [updated] = await db
      .update(teachers)
      .set(updateData)
      .where(eq(teachers.id, id))
      .returning();
    return updated;
  }

  async deleteTeacher(id: string): Promise<void> {
    await db.update(teachers).set({ isActive: false }).where(eq(teachers.id, id));
  }

  async getAvailableTeachers(day: string, period: number, subjectId: string | null, schoolId: string): Promise<Teacher[]> {
    try {
      // TEMPORARY DEBUG VERSION - Just return all active teachers for now
      const allTeachers = await db
        .select()
        .from(teachers)
        .where(eq(teachers.isActive, true));

      console.log(`[DEBUG] Total active teachers found: ${allTeachers.length}`);
      console.log(`[DEBUG] Teachers:`, allTeachers.map(t => `${t.name} (${t.schoolId})`));
      console.log(`[DEBUG] Looking for schoolId: ${schoolId}`);

      // Filter by school
      const schoolTeachers = allTeachers.filter(t => t.schoolId === schoolId);
      console.log(`[DEBUG] Teachers in school: ${schoolTeachers.length}`);

      // For debugging, let's just return all teachers in the school without any other filtering
      // This will help us confirm the basic functionality works
      return schoolTeachers;
    } catch (error) {
      console.error(`[STORAGE ERROR] getAvailableTeachers failed:`, error);
      return [];
    }
  }

  // Subject operations
  async getSubjects(schoolId?: string): Promise<Subject[]> {
    if (schoolId) {
      return await db.select().from(subjects).where(eq(subjects.schoolId, schoolId));
    }
    return await db.select().from(subjects);
  }

  async getSubject(id: string): Promise<Subject | undefined> {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
    return subject;
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const [created] = await db.insert(subjects).values(subject).returning();
    return created;
  }

  async updateSubject(id: string, subject: Partial<InsertSubject>): Promise<Subject> {
    const [updated] = await db
      .update(subjects)
      .set({ ...subject, updatedAt: new Date() })
      .where(eq(subjects.id, id))
      .returning();
    return updated;
  }

  async deleteSubject(id: string): Promise<void> {
    await db.delete(subjects).where(eq(subjects.id, id));
  }

  async checkSubjectCodeExists(code: string, schoolId: string, excludeId?: string): Promise<boolean> {
    const conditions = [eq(subjects.code, code), eq(subjects.schoolId, schoolId)];
    if (excludeId) {
      conditions.push(ne(subjects.id, excludeId));
    }
    
    const [existing] = await db.select().from(subjects).where(and(...conditions)).limit(1);
    return !!existing;
  }


  // Class operations
  async getClasses(schoolId?: string): Promise<Class[]> {
    if (schoolId) {
      return await db.select().from(classes).where(eq(classes.schoolId, schoolId));
    }
    return await db.select().from(classes);
  }

  async getClass(id: string): Promise<Class | undefined> {
    const [classData] = await db.select().from(classes).where(eq(classes.id, id));
    return classData;
  }

  async createClass(classData: InsertClass): Promise<Class> {
    const [created] = await db.insert(classes).values({
      ...classData,
      requiredSubjects: JSON.stringify(classData.requiredSubjects || []) as any,
    }).returning();
    return created;
  }

  async updateClass(id: string, classData: Partial<InsertClass>): Promise<Class> {
    const updateData: any = { ...classData, updatedAt: new Date() };
    if (classData.requiredSubjects) {
      updateData.requiredSubjects = JSON.stringify(classData.requiredSubjects);
    }
    const [updated] = await db
      .update(classes)
      .set(updateData)
      .where(eq(classes.id, id))
      .returning();
    return updated;
  }

  async deleteClass(id: string): Promise<void> {
    await db.delete(classes).where(eq(classes.id, id));
  }

  async getOtherSectionsOfGrade(grade: string, schoolId: string, excludeClassId: string): Promise<Class[]> {
    return await db
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.grade, grade),
          eq(classes.schoolId, schoolId),
          ne(classes.id, excludeClassId)
        )
      )
      .orderBy(classes.section);
  }

  async copySubjectsBetweenClasses(sourceClassId: string, targetClassIds: string[], schoolId: string): Promise<{ copiedCount: number; skippedCount: number }> {
    // Get all subject assignments from source class
    const sourceAssignments = await db
      .select()
      .from(classSubjectAssignments)
      .where(eq(classSubjectAssignments.classId, sourceClassId));

    let copiedCount = 0;
    let skippedCount = 0;

    for (const targetClassId of targetClassIds) {
      // Verify target class exists and belongs to the same school
      const targetClass = await this.getClass(targetClassId);
      if (!targetClass || targetClass.schoolId !== schoolId) {
        skippedCount++;
        continue;
      }

      // Get existing assignments for target class to avoid duplicates
      const existingAssignments = await db
        .select({
          subjectId: classSubjectAssignments.subjectId
        })
        .from(classSubjectAssignments)
        .where(eq(classSubjectAssignments.classId, targetClassId));

      const existingSubjectIds = existingAssignments.map(a => a.subjectId);

      // Copy each assignment that doesn't already exist
      for (const assignment of sourceAssignments) {
        if (!existingSubjectIds.includes(assignment.subjectId)) {
          await db.insert(classSubjectAssignments).values({
            classId: targetClassId,
            subjectId: assignment.subjectId,
            weeklyFrequency: assignment.weeklyFrequency,
          });
          copiedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    return { copiedCount, skippedCount };
  }

  async checkClassExists(grade: string, section: string | null, schoolId: string, excludeId?: string): Promise<boolean> {
    const conditions = [
      eq(classes.grade, grade),
      eq(classes.schoolId, schoolId),
      // Handle both empty strings and null values for empty sections
      section && section.trim() !== "" ? eq(classes.section, section) : 
        or(eq(classes.section, ""), sql`${classes.section} IS NULL`)
    ];
    
    if (excludeId) {
      conditions.push(sql`${classes.id} != ${excludeId}`);
    }
    
    const result = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(...conditions));
    
    return result.length > 0;
  }

  // Timetable operations
  async getTimetableEntries(schoolId?: string): Promise<TimetableEntry[]> {
    if (schoolId) {
      return await db
        .select()
        .from(timetableEntries)
        .innerJoin(classes, eq(timetableEntries.classId, classes.id))
        .where(and(
          eq(timetableEntries.isActive, true),
          eq(classes.schoolId, schoolId)
        ));
    }
    return await db
      .select()
      .from(timetableEntries)
      .where(eq(timetableEntries.isActive, true));
  }

  async getTimetableForClass(classId: string): Promise<TimetableEntry[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.classId, classId),
          eq(timetableEntries.isActive, true)
        )
      );
  }

  async getTimetableForTeacher(teacherId: string): Promise<TimetableEntry[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.teacherId, teacherId),
          eq(timetableEntries.isActive, true)
        )
      );
  }

  async createTimetableEntry(entry: InsertTimetableEntry): Promise<TimetableEntry> {
    const [created] = await db.insert(timetableEntries).values(entry).returning();
    return created;
  }

  async updateTimetableEntry(id: string, entry: Partial<InsertTimetableEntry>): Promise<TimetableEntry> {
    const [updated] = await db
      .update(timetableEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(timetableEntries.id, id))
      .returning();
    return updated;
  }

  async deleteTimetableEntry(id: string): Promise<void> {
    await db.delete(timetableEntries).where(eq(timetableEntries.id, id));
  }

  async deleteTimetableEntriesForClass(classId: string): Promise<void> {
    await db.delete(timetableEntries).where(eq(timetableEntries.classId, classId));
  }

  async deleteTimetableEntriesForTeacherAndDay(teacherId: string, day: string): Promise<void> {
    await db.delete(timetableEntries).where(
      and(
        eq(timetableEntries.teacherId, teacherId),
        eq(timetableEntries.day, day)
      )
    );
  }

  async clearTimetable(): Promise<void> {
    await db.delete(timetableEntries);
  }

  async bulkCreateTimetableEntries(entries: InsertTimetableEntry[]): Promise<TimetableEntry[]> {
    if (entries.length === 0) return [];
    
    // Before creating new entries, deactivate ALL old entries for these classes
    const classIds = Array.from(new Set(entries.map(e => e.classId)));
    for (let i = 0; i < classIds.length; i++) {
      const classId = classIds[i];
      // Deactivate ALL existing entries for this class to prevent duplicates
      await db
        .update(timetableEntries)
        .set({ isActive: false })
        .where(eq(timetableEntries.classId, classId));
    }
    
    return await db.insert(timetableEntries).values(entries).returning();
  }

  // Timetable version operations
  async createTimetableVersion(version: InsertTimetableVersion): Promise<TimetableVersion> {
    const [created] = await db.insert(timetableVersions).values(version).returning();
    return created;
  }

  async getTimetableVersionsForClass(classId: string, weekStart: string, weekEnd: string): Promise<TimetableVersion[]> {
    return await db
      .select()
      .from(timetableVersions)
      .where(
        and(
          eq(timetableVersions.classId, classId),
          eq(timetableVersions.weekStart, weekStart),
          eq(timetableVersions.weekEnd, weekEnd)
        )
      )
      .orderBy(timetableVersions.createdAt);
  }

  async getTimetableEntriesForVersion(versionId: string): Promise<TimetableEntry[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(eq(timetableEntries.versionId, versionId));
  }

  async setActiveVersion(versionId: string, classId: string): Promise<void> {
    // First, deactivate all versions for this class
    const version = await db
      .select()
      .from(timetableVersions)
      .where(eq(timetableVersions.id, versionId))
      .limit(1);
    
    if (version.length > 0) {
      const { weekStart, weekEnd } = version[0];
      
      // Deactivate all existing versions for this class/week
      await db
        .update(timetableVersions)
        .set({ isActive: false })
        .where(
          and(
            eq(timetableVersions.classId, classId),
            eq(timetableVersions.weekStart, weekStart),
            eq(timetableVersions.weekEnd, weekEnd)
          )
        );

      // Then activate ONLY the selected version
      await db
        .update(timetableVersions)
        .set({ isActive: true })
        .where(eq(timetableVersions.id, versionId));
      
      // Safety check: Ensure only one version is active for this class/week
      const activeCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(timetableVersions)
        .where(
          and(
            eq(timetableVersions.classId, classId),
            eq(timetableVersions.weekStart, weekStart),
            eq(timetableVersions.weekEnd, weekEnd),
            eq(timetableVersions.isActive, true)
          )
        );
      
      if (activeCount[0].count > 1) {
        console.error(`ERROR: Multiple active versions detected for class ${classId}, week ${weekStart}-${weekEnd}. Count: ${activeCount[0].count}`);
        // Force fix by deactivating all and activating only the requested version
        await db
          .update(timetableVersions)
          .set({ isActive: false })
          .where(
            and(
              eq(timetableVersions.classId, classId),
              eq(timetableVersions.weekStart, weekStart),
              eq(timetableVersions.weekEnd, weekEnd)
            )
          );
        await db
          .update(timetableVersions)
          .set({ isActive: true })
          .where(eq(timetableVersions.id, versionId));
      }
    }
  }

  async getActiveTimetableVersion(classId: string, weekStart: string, weekEnd: string): Promise<TimetableVersion | null> {
    const versions = await db
      .select()
      .from(timetableVersions)
      .where(
        and(
          eq(timetableVersions.classId, classId),
          eq(timetableVersions.weekStart, weekStart),
          eq(timetableVersions.weekEnd, weekEnd),
          eq(timetableVersions.isActive, true)
        )
      )
      .limit(1);
    
    return versions.length > 0 ? versions[0] : null;
  }

  // Substitution operations
  async getSubstitutions(schoolId?: string): Promise<Substitution[]> {
    if (schoolId) {
      return await db
        .select({
          id: substitutions.id,
          date: substitutions.date,
          originalTeacherId: substitutions.originalTeacherId,
          substituteTeacherId: substitutions.substituteTeacherId,
          timetableEntryId: substitutions.timetableEntryId,
          reason: substitutions.reason,
          status: substitutions.status,
          createdAt: substitutions.createdAt,
          updatedAt: substitutions.updatedAt,
        })
        .from(substitutions)
        .innerJoin(teachers, eq(substitutions.originalTeacherId, teachers.id))
        .where(eq(teachers.schoolId, schoolId));
    }
    return await db.select().from(substitutions);
  }

  async getSubstitution(id: string): Promise<Substitution | undefined> {
    const [substitution] = await db.select().from(substitutions).where(eq(substitutions.id, id));
    return substitution;
  }

  async createSubstitution(substitution: InsertSubstitution): Promise<Substitution> {
    const [created] = await db.insert(substitutions).values(substitution).returning();
    return created;
  }

  async updateSubstitution(id: string, substitution: Partial<InsertSubstitution>): Promise<Substitution> {
    const [updated] = await db
      .update(substitutions)
      .set({ ...substitution, updatedAt: new Date() })
      .where(eq(substitutions.id, id))
      .returning();
    return updated;
  }

  async deleteSubstitution(id: string): Promise<void> {
    await db.delete(substitutions).where(eq(substitutions.id, id));
  }

  async getActiveSubstitutions(): Promise<Substitution[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await db
      .select()
      .from(substitutions)
      .where(
        and(
          sql`${substitutions.date} >= ${today}`,
          sql`${substitutions.date} < ${tomorrow}`,
          eq(substitutions.status, "confirmed")
        )
      );
  }

  async getSubstitutionsByWeek(weekStart: Date, weekEnd: Date, schoolId?: string): Promise<Substitution[]> {
    if (schoolId) {
      return await db
        .select({
          id: substitutions.id,
          date: substitutions.date,
          originalTeacherId: substitutions.originalTeacherId,
          substituteTeacherId: substitutions.substituteTeacherId,
          timetableEntryId: substitutions.timetableEntryId,
          reason: substitutions.reason,
          status: substitutions.status,
          isAutoGenerated: substitutions.isAutoGenerated,
          createdAt: substitutions.createdAt,
          updatedAt: substitutions.updatedAt,
        })
        .from(substitutions)
        .innerJoin(teachers, eq(substitutions.originalTeacherId, teachers.id))
        .where(
          and(
            sql`${substitutions.date} >= ${weekStart}`,
            sql`${substitutions.date} <= ${weekEnd}`,
            eq(teachers.schoolId, schoolId)
          )
        );
    }

    return await db
      .select()
      .from(substitutions)
      .where(
        and(
          sql`${substitutions.date} >= ${weekStart}`,
          sql`${substitutions.date} <= ${weekEnd}`
        )
      );
  }

  // Timetable changes operations
  async getTimetableChanges(schoolId: string, date?: string): Promise<any[]> {
    let query = db
      .select({
        id: timetableChanges.id,
        timetableEntryId: timetableChanges.timetableEntryId,
        changeType: timetableChanges.changeType,
        changeDate: timetableChanges.changeDate,
        originalTeacherId: timetableChanges.originalTeacherId,
        newTeacherId: timetableChanges.newTeacherId,
        originalRoom: timetableChanges.originalRoom,
        newRoom: timetableChanges.newRoom,
        reason: timetableChanges.reason,
        changeSource: timetableChanges.changeSource,
        approvedBy: timetableChanges.approvedBy,
        approvedAt: timetableChanges.approvedAt,
        isActive: timetableChanges.isActive,
        createdAt: timetableChanges.createdAt,
        updatedAt: timetableChanges.updatedAt,
        // Include class information as flat fields
        affectedClassId: classes.id,
        affectedClassGrade: classes.grade,
        affectedClassSection: classes.section,
        affectedClassStudentCount: classes.studentCount,
        affectedClassRoom: classes.room,
        // Include timetable entry information as flat fields
        timetableEntryDay: timetableEntries.day,
        timetableEntryPeriod: timetableEntries.period,
        timetableEntryStartTime: timetableEntries.startTime,
        timetableEntryEndTime: timetableEntries.endTime
      })
      .from(timetableChanges)
      .innerJoin(timetableEntries, eq(timetableChanges.timetableEntryId, timetableEntries.id))
      .innerJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(timetableChanges.isActive, true)
      ));

    if (date) {
      query = query.where(and(
        eq(classes.schoolId, schoolId),
        eq(timetableChanges.isActive, true),
        eq(timetableChanges.changeDate, date)
      ));
    }

    return await query;
  }

  async getTimetableChangesByEntry(timetableEntryId: string): Promise<TimetableChange[]> {
    return await db
      .select()
      .from(timetableChanges)
      .where(and(
        eq(timetableChanges.timetableEntryId, timetableEntryId),
        eq(timetableChanges.isActive, true)
      ))
      .orderBy(timetableChanges.createdAt);
  }

  async createTimetableChange(change: InsertTimetableChange): Promise<TimetableChange> {
    const [created] = await db.insert(timetableChanges).values(change).returning();
    return created;
  }

  async updateTimetableChange(id: string, change: Partial<InsertTimetableChange>): Promise<TimetableChange> {
    const [updated] = await db
      .update(timetableChanges)
      .set({ ...change, updatedAt: new Date() })
      .where(eq(timetableChanges.id, id))
      .returning();
    return updated;
  }

  async deleteTimetableChange(id: string): Promise<void> {
    await db.delete(timetableChanges).where(eq(timetableChanges.id, id));
  }

  async getActiveTimetableChanges(schoolId: string, date: string): Promise<TimetableChange[]> {
    return await db
      .select({
        id: timetableChanges.id,
        timetableEntryId: timetableChanges.timetableEntryId,
        changeType: timetableChanges.changeType,
        changeDate: timetableChanges.changeDate,
        originalTeacherId: timetableChanges.originalTeacherId,
        newTeacherId: timetableChanges.newTeacherId,
        originalRoom: timetableChanges.originalRoom,
        newRoom: timetableChanges.newRoom,
        reason: timetableChanges.reason,
        changeSource: timetableChanges.changeSource,
        approvedBy: timetableChanges.approvedBy,
        approvedAt: timetableChanges.approvedAt,
        isActive: timetableChanges.isActive,
        createdAt: timetableChanges.createdAt,
        updatedAt: timetableChanges.updatedAt,
        // Include class information as flat fields
        affectedClassId: classes.id,
        affectedClassGrade: classes.grade,
        affectedClassSection: classes.section,
        affectedClassStudentCount: classes.studentCount,
        affectedClassRoom: classes.room,
        // Include timetable entry information as flat fields
        timetableEntryDay: timetableEntries.day,
        timetableEntryPeriod: timetableEntries.period,
        timetableEntryStartTime: timetableEntries.startTime,
        timetableEntryEndTime: timetableEntries.endTime
      })
      .from(timetableChanges)
      .innerJoin(timetableEntries, eq(timetableChanges.timetableEntryId, timetableEntries.id))
      .innerJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(and(
        eq(classes.schoolId, schoolId),
        eq(timetableChanges.changeDate, date),
        eq(timetableChanges.isActive, true)
      ))
      .orderBy(timetableChanges.createdAt);
  }

  // Analytics
  async getStats(schoolId: string): Promise<{
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
    todaySubstitutions: number;
  }> {
    const [teacherCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(teachers)
      .where(and(eq(teachers.isActive, true), eq(teachers.schoolId, schoolId)));

    const [classCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .where(eq(classes.schoolId, schoolId));

    const [subjectCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .where(eq(subjects.schoolId, schoolId));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [substitutionCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(substitutions)
      .innerJoin(teachers, eq(substitutions.teacherId, teachers.id))
      .where(
        and(
          eq(teachers.schoolId, schoolId),
          sql`${substitutions.date} >= ${today}`,
          sql`${substitutions.date} < ${tomorrow}`
        )
      );

    return {
      totalTeachers: Number(teacherCount?.count) || 0,
      totalClasses: Number(classCount?.count) || 0,
      totalSubjects: Number(subjectCount?.count) || 0,
      todaySubstitutions: Number(substitutionCount?.count) || 0,
    };
  }

  async getAdminDashboardStats(): Promise<{
    totalSchools: number;
    activeSchools: number;
    inactiveSchools: number;
    schoolAdminLogins: Array<{
      schoolName: string;
      adminName: string;
      lastLogin: Date | null;
    }>;
    schoolTeacherCounts: Array<{
      schoolName: string;
      activeTeachers: number;
    }>;
  }> {
    // Get school counts
    const [totalSchoolsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schools);

    const [activeSchoolsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schools)
      .where(eq(schools.isActive, true));

    const [inactiveSchoolsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schools)
      .where(eq(schools.isActive, false));

    // Get school admin login info
    const schoolAdminLogins = await db
      .select({
        schoolName: schools.name,
        adminName: sql<string>`CONCAT(${users.firstName}, ' ', COALESCE(${users.lastName}, ''))`,
        lastLogin: users.updatedAt, // Using updatedAt as proxy for last activity
      })
      .from(schools)
      .leftJoin(users, and(
        eq(users.schoolId, schools.id),
        eq(users.role, "admin")
      ))
      .orderBy(schools.name);

    // Get teacher counts per school
    const schoolTeacherCounts = await db
      .select({
        schoolName: schools.name,
        activeTeachers: sql<number>`COUNT(${teachers.id})`,
      })
      .from(schools)
      .leftJoin(teachers, and(
        eq(teachers.schoolId, schools.id),
        eq(teachers.isActive, true)
      ))
      .groupBy(schools.id, schools.name)
      .orderBy(schools.name);

    return {
      totalSchools: Number(totalSchoolsResult?.count) || 0,
      activeSchools: Number(activeSchoolsResult?.count) || 0,
      inactiveSchools: Number(inactiveSchoolsResult?.count) || 0,
      schoolAdminLogins: schoolAdminLogins.map(item => ({
        schoolName: item.schoolName,
        adminName: item.adminName || 'No Admin',
        lastLogin: item.lastLogin,
      })),
      schoolTeacherCounts: schoolTeacherCounts.map(item => ({
        schoolName: item.schoolName,
        activeTeachers: Number(item.activeTeachers) || 0,
      })),
    };
  }

  // Timetable validity period operations
  async getTimetableValidityPeriods(classId?: string): Promise<TimetableValidityPeriod[]> {
    if (classId) {
      return await db.select().from(timetableValidityPeriods).where(eq(timetableValidityPeriods.classId, classId));
    }
    return await db.select().from(timetableValidityPeriods);
  }

  async getTimetableValidityPeriod(id: string): Promise<TimetableValidityPeriod | undefined> {
    const [period] = await db.select().from(timetableValidityPeriods).where(eq(timetableValidityPeriods.id, id));
    return period;
  }

  async createTimetableValidityPeriod(period: InsertTimetableValidityPeriod): Promise<TimetableValidityPeriod> {
    // First, deactivate other active periods for this class
    await db
      .update(timetableValidityPeriods)
      .set({ isActive: false })
      .where(and(
        eq(timetableValidityPeriods.classId, period.classId),
        eq(timetableValidityPeriods.isActive, true)
      ));

    const [newPeriod] = await db.insert(timetableValidityPeriods).values(period).returning();
    return newPeriod;
  }

  async updateTimetableValidityPeriod(id: string, period: Partial<InsertTimetableValidityPeriod>): Promise<TimetableValidityPeriod> {
    const [updatedPeriod] = await db
      .update(timetableValidityPeriods)
      .set(period)
      .where(eq(timetableValidityPeriods.id, id))
      .returning();
    return updatedPeriod;
  }

  async deleteTimetableValidityPeriod(id: string): Promise<void> {
    await db.delete(timetableValidityPeriods).where(eq(timetableValidityPeriods.id, id));
  }

  // Class Subject Assignment operations
  async getClassSubjectAssignments(classId?: string, schoolId?: string): Promise<any[]> {
    const query = db
      .select({
        id: classSubjectAssignments.id,
        classId: classSubjectAssignments.classId,
        subjectId: classSubjectAssignments.subjectId,
        weeklyFrequency: classSubjectAssignments.weeklyFrequency,
        assignedTeacherId: classSubjectAssignments.assignedTeacherId,
        subject: {
          id: subjects.id,
          name: subjects.name,
          code: subjects.code,
          color: subjects.color,
          periodsPerWeek: subjects.periodsPerWeek,
          schoolId: subjects.schoolId,
        },
        assignedTeacher: {
          id: teachers.id,
          name: teachers.name,
          email: teachers.email,
          contactNumber: teachers.contactNumber,
          schoolIdNumber: teachers.schoolIdNumber,
          schoolId: teachers.schoolId,
          isActive: teachers.isActive,
        }
      })
      .from(classSubjectAssignments)
      .innerJoin(subjects, eq(classSubjectAssignments.subjectId, subjects.id))
      .leftJoin(teachers, eq(classSubjectAssignments.assignedTeacherId, teachers.id));

    let conditions = [];
    
    if (classId) {
      conditions.push(eq(classSubjectAssignments.classId, classId));
    }
    
    // Add school filtering by joining with classes table
    if (schoolId) {
      const queryWithClassJoin = query.innerJoin(classes, eq(classSubjectAssignments.classId, classes.id));
      conditions.push(eq(classes.schoolId, schoolId));
      
      if (conditions.length > 0) {
        return await queryWithClassJoin.where(and(...conditions));
      }
      return await queryWithClassJoin;
    }
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getClassSubjectAssignment(id: string): Promise<ClassSubjectAssignment | undefined> {
    const [assignment] = await db.select().from(classSubjectAssignments).where(eq(classSubjectAssignments.id, id));
    return assignment;
  }

  async createClassSubjectAssignment(assignment: InsertClassSubjectAssignment): Promise<ClassSubjectAssignment> {
    const [newAssignment] = await db.insert(classSubjectAssignments).values(assignment).returning();
    return newAssignment;
  }

  async updateClassSubjectAssignment(id: string, assignment: Partial<InsertClassSubjectAssignment>): Promise<ClassSubjectAssignment> {
    const [updatedAssignment] = await db
      .update(classSubjectAssignments)
      .set(assignment)
      .where(eq(classSubjectAssignments.id, id))
      .returning();
    return updatedAssignment;
  }

  async deleteClassSubjectAssignment(id: string): Promise<void> {
    await db.delete(classSubjectAssignments).where(eq(classSubjectAssignments.id, id));
  }

  async getClassSubjectAssignmentByClassAndSubject(classId: string, subjectId: string): Promise<ClassSubjectAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(classSubjectAssignments)
      .where(and(
        eq(classSubjectAssignments.classId, classId),
        eq(classSubjectAssignments.subjectId, subjectId)
      ));
    return assignment;
  }

  // Timetable Structure operations
  async getTimetableStructures(schoolId?: string): Promise<TimetableStructure[]> {
    if (schoolId) {
      return await db.select().from(timetableStructures).where(eq(timetableStructures.schoolId, schoolId));
    }
    return await db.select().from(timetableStructures);
  }

  async getTimetableStructure(id: string): Promise<TimetableStructure | undefined> {
    const [structure] = await db.select().from(timetableStructures).where(eq(timetableStructures.id, id));
    return structure;
  }

  async getTimetableStructureBySchool(schoolId: string): Promise<TimetableStructure | undefined> {
    const [structure] = await db
      .select()
      .from(timetableStructures)
      .where(and(
        eq(timetableStructures.schoolId, schoolId),
        eq(timetableStructures.isActive, true)
      ));
    return structure;
  }

  async createTimetableStructure(structure: InsertTimetableStructure): Promise<TimetableStructure> {
    // First, deactivate other active structures for this school
    await db
      .update(timetableStructures)
      .set({ isActive: false })
      .where(and(
        eq(timetableStructures.schoolId, structure.schoolId),
        eq(timetableStructures.isActive, true)
      ));

    const [newStructure] = await db.insert(timetableStructures).values(structure).returning();
    return newStructure;
  }

  async updateTimetableStructure(id: string, structure: Partial<InsertTimetableStructure>): Promise<TimetableStructure> {
    const [updatedStructure] = await db
      .update(timetableStructures)
      .set(structure)
      .where(eq(timetableStructures.id, id))
      .returning();
    return updatedStructure;
  }

  async deleteTimetableStructure(id: string): Promise<void> {
    await db.delete(timetableStructures).where(eq(timetableStructures.id, id));
  }

  // Teacher attendance operations
  async getTeacherAttendance(schoolId: string, date?: string): Promise<TeacherAttendance[]> {
    const conditions = [eq(teacherAttendance.schoolId, schoolId)];
    
    if (date) {
      conditions.push(eq(teacherAttendance.attendanceDate, date));
    }
    
    return await db
      .select()
      .from(teacherAttendance)
      .where(and(...conditions))
      .orderBy(teacherAttendance.attendanceDate);
  }

  async getTeacherAttendanceByTeacher(teacherId: string, startDate?: string, endDate?: string): Promise<TeacherAttendance[]> {
    const conditions = [eq(teacherAttendance.teacherId, teacherId)];
    
    if (startDate && endDate) {
      conditions.push(between(teacherAttendance.attendanceDate, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(teacherAttendance.attendanceDate, startDate));
    } else if (endDate) {
      conditions.push(lte(teacherAttendance.attendanceDate, endDate));
    }
    
    return await db
      .select()
      .from(teacherAttendance)
      .where(and(...conditions))
      .orderBy(teacherAttendance.attendanceDate);
  }

  async markTeacherAttendance(attendance: InsertTeacherAttendance): Promise<TeacherAttendance> {
    // Check if attendance already exists for this teacher and date
    const existing = await db
      .select()
      .from(teacherAttendance)
      .where(
        and(
          eq(teacherAttendance.teacherId, attendance.teacherId),
          eq(teacherAttendance.attendanceDate, attendance.attendanceDate)
        )
      );

    let result: TeacherAttendance;
    let wasAbsentBefore = false;
    let isAbsentNow = attendance.status !== "present";

    if (existing.length > 0) {
      wasAbsentBefore = existing[0].status !== "present";
      
      // Update existing record
      const [updated] = await db
        .update(teacherAttendance)
        .set({
          status: attendance.status,
          reason: attendance.reason,
          isFullDay: attendance.isFullDay,
          markedBy: attendance.markedBy,
          markedAt: getCurrentDateTimeIST(),
        })
        .where(eq(teacherAttendance.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      // Create new record
      const [created] = await db
        .insert(teacherAttendance)
        .values(attendance)
        .returning();
      result = created;
    }

    // Handle automatic absence detection and substitution
    try {
      const { AbsenceDetectionService } = await import("./services/absenceDetectionService");
      
      // If teacher is being marked as absent and wasn't absent before
      if (isAbsentNow && !wasAbsentBefore) {
        console.log(`Triggering automatic absence detection for teacher ${attendance.teacherId} on ${attendance.attendanceDate}`);
        
        await AbsenceDetectionService.handleTeacherAbsence(
          attendance.teacherId,
          attendance.attendanceDate,
          attendance.reason || "No reason provided",
          attendance.markedBy || "system"
        );
      }
      // If teacher is being marked as present and was absent before
      else if (!isAbsentNow && wasAbsentBefore) {
        console.log(`Teacher ${attendance.teacherId} returned on ${attendance.attendanceDate}, checking for automatic changes to revert`);
        
        await AbsenceDetectionService.handleTeacherReturn(
          attendance.teacherId,
          attendance.attendanceDate,
          attendance.markedBy || "system"
        );
      }
    } catch (absenceError) {
      console.error("Error in automatic absence detection:", absenceError);
      // Don't throw the error as attendance marking should still succeed
      // Log it for admin review
      try {
        await this.createAuditLog({
          action: "absence_detection_error",
          entityType: "teacher_attendance",
          entityId: attendance.teacherId,
          userId: attendance.markedBy || "system",
          description: `Failed to process automatic absence detection: ${absenceError instanceof Error ? absenceError.message : 'Unknown error'}`,
          schoolId: attendance.schoolId
        });
      } catch (auditError) {
        console.error("Failed to log absence detection error:", auditError);
      }
    }

    return result;
  }

  async markBulkTeacherAttendance(bulkData: BulkAttendanceData, markedBy: string): Promise<TeacherAttendance[]> {
    const { teacherId, status, reason, startDate, endDate, isFullDay } = bulkData;
    const records: TeacherAttendance[] = [];
    
    // Get teacher and school info
    const teacher = await this.getTeacher(teacherId);
    if (!teacher) {
      throw new Error("Teacher not found");
    }

    // Generate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateString = currentDate.toISOString().split('T')[0];
      
      try {
        const attendanceRecord = await this.markTeacherAttendance({
          teacherId,
          schoolId: teacher.schoolId,
          attendanceDate: dateString,
          status,
          reason,
          leaveStartDate: startDate,
          leaveEndDate: endDate,
          isFullDay,
          markedBy,
        });
        records.push(attendanceRecord);
      } catch (error) {
        console.error(`Failed to mark attendance for ${dateString}:`, error);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return records;
  }

  async updateTeacherAttendance(id: string, attendance: Partial<InsertTeacherAttendance>): Promise<TeacherAttendance> {
    const [updated] = await db
      .update(teacherAttendance)
      .set({
        ...attendance,
        updatedAt: getCurrentDateTimeIST(),
      })
      .where(eq(teacherAttendance.id, id))
      .returning();
      
    if (!updated) {
      throw new Error("Teacher attendance record not found");
    }
    
    return updated;
  }

  async deleteTeacherAttendance(id: string): Promise<void> {
    await db.delete(teacherAttendance).where(eq(teacherAttendance.id, id));
  }

  async isTeacherAbsent(teacherId: string, date: string): Promise<boolean> {
    const attendance = await db
      .select()
      .from(teacherAttendance)
      .where(
        and(
          eq(teacherAttendance.teacherId, teacherId),
          eq(teacherAttendance.attendanceDate, date)
        )
      );
    
    if (attendance.length === 0) {
      return false; // No record means present by default
    }
    
    return attendance[0].status !== "present";
  }

  // Audit log operations
  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(auditLog).returning();
    return log;
  }

  async getAuditLogs(schoolId: string, limit: number = 50): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.schoolId, schoolId))
      .orderBy(auditLogs.createdAt)
      .limit(limit);
  }

  // Enhanced teacher operations for daily periods
  async updateTeacherDailyPeriods(schoolId: string, config: UpdateTeacherDailyPeriods): Promise<{ success: boolean; message: string }> {
    try {
      if (config.applyToAll) {
        // Update all teachers in the school
        await db
          .update(teachers)
          .set({ maxDailyPeriods: config.maxDailyPeriods })
          .where(eq(teachers.schoolId, schoolId));
        
        return { 
          success: true, 
          message: `Updated daily periods limit to ${config.maxDailyPeriods} for all teachers` 
        };
      } else if (config.teacherId) {
        // Update specific teacher
        await db
          .update(teachers)
          .set({ maxDailyPeriods: config.maxDailyPeriods })
          .where(and(eq(teachers.id, config.teacherId), eq(teachers.schoolId, schoolId)));
        
        return { 
          success: true, 
          message: `Updated daily periods limit to ${config.maxDailyPeriods} for selected teacher` 
        };
      } else {
        return { success: false, message: "Teacher ID is required when not applying to all teachers" };
      }
    } catch (error) {
      console.error("Error updating teacher daily periods:", error);
      return { success: false, message: "Failed to update teacher daily periods" };
    }
  }

  async getTeacherSchedule(teacherId: string, date?: string): Promise<TimetableEntry[]> {
    let query = db
      .select()
      .from(timetableEntries)
      .where(eq(timetableEntries.teacherId, teacherId))
      .orderBy(timetableEntries.day, timetableEntries.period);

    return await query;
  }

  async getTeacherWorkloadAnalytics(schoolId: string): Promise<any> {
    // Get all teachers and their current workload
    const teachersList = await this.getTeachers(schoolId);
    const allEntries = await db
      .select()
      .from(timetableEntries)
      .innerJoin(teachers, eq(timetableEntries.teacherId, teachers.id))
      .where(eq(teachers.schoolId, schoolId));

    const workloadData = teachersList.map(teacher => {
      const teacherEntries = allEntries.filter(entry => entry.timetable_entries.teacherId === teacher.id);
      const weeklyPeriods = teacherEntries.length;
      const dailyPeriods: Record<string, number> = {};
      
      teacherEntries.forEach(entry => {
        const day = entry.timetable_entries.day;
        dailyPeriods[day] = (dailyPeriods[day] || 0) + 1;
      });

      const avgDailyPeriods = weeklyPeriods / 6; // Assuming 6 working days
      const maxDailyPeriods = Math.max(...Object.values(dailyPeriods), 0);

      return {
        teacherId: teacher.id,
        teacherName: teacher.name,
        weeklyPeriods,
        avgDailyPeriods: Math.round(avgDailyPeriods * 10) / 10,
        maxDailyPeriods,
        maxAllowedDaily: teacher.maxDailyPeriods,
        isOverloaded: maxDailyPeriods > teacher.maxDailyPeriods,
        dailyBreakdown: dailyPeriods
      };
    });

    return {
      teachers: workloadData,
      summary: {
        totalTeachers: teachersList.length,
        overloadedTeachers: workloadData.filter(t => t.isOverloaded).length,
        avgWeeklyPeriods: workloadData.reduce((sum, t) => sum + t.weeklyPeriods, 0) / teachersList.length || 0
      }
    };
  }

  async getTimetableEntriesByTeacher(teacherId: string): Promise<TimetableEntry[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(and(
        eq(timetableEntries.teacherId, teacherId),
        eq(timetableEntries.isActive, true)
      ))
      .orderBy(timetableEntries.day, timetableEntries.period);
  }

  // Teacher Replacement operations
  async createTeacherReplacement(replacement: InsertTeacherReplacement): Promise<TeacherReplacement> {
    const [newReplacement] = await db
      .insert(teacherReplacements)
      .values(replacement)
      .returning();
    return newReplacement;
  }

  async getAllTeacherReplacements(): Promise<TeacherReplacement[]> {
    return await db
      .select({
        id: teacherReplacements.id,
        originalTeacherId: teacherReplacements.originalTeacherId,
        replacementTeacherId: teacherReplacements.replacementTeacherId,
        schoolId: teacherReplacements.schoolId,
        replacementDate: teacherReplacements.replacementDate,
        reason: teacherReplacements.reason,
        affectedTimetableEntries: teacherReplacements.affectedTimetableEntries,
        conflictDetails: teacherReplacements.conflictDetails,
        status: teacherReplacements.status,
        replacedBy: teacherReplacements.replacedBy,
        completedAt: teacherReplacements.completedAt,
        createdAt: teacherReplacements.createdAt,
        updatedAt: teacherReplacements.updatedAt,
        originalTeacher: {
          id: sql`orig_teacher.id`,
          name: sql`orig_teacher.name`,
          email: sql`orig_teacher.email`
        },
        replacementTeacher: {
          id: sql`repl_teacher.id`,
          name: sql`repl_teacher.name`,
          email: sql`repl_teacher.email`
        },
        school: {
          id: sql`school.id`,
          name: sql`school.name`
        },
        replacedByUser: {
          id: sql`replaced_by_user.id`,
          email: sql`replaced_by_user.email`
        }
      })
      .from(teacherReplacements)
      .leftJoin(sql`${teachers} as orig_teacher`, sql`orig_teacher.id = ${teacherReplacements.originalTeacherId}`)
      .leftJoin(sql`${teachers} as repl_teacher`, sql`repl_teacher.id = ${teacherReplacements.replacementTeacherId}`)
      .leftJoin(schools, eq(teacherReplacements.schoolId, schools.id))
      .leftJoin(sql`${users} as replaced_by_user`, sql`replaced_by_user.id = ${teacherReplacements.replacedBy}`)
      .orderBy(sql`${teacherReplacements.createdAt} DESC`);
  }

  async getTeacherReplacementsBySchool(schoolId: string): Promise<TeacherReplacement[]> {
    return await db
      .select({
        id: teacherReplacements.id,
        originalTeacherId: teacherReplacements.originalTeacherId,
        replacementTeacherId: teacherReplacements.replacementTeacherId,
        schoolId: teacherReplacements.schoolId,
        replacementDate: teacherReplacements.replacementDate,
        reason: teacherReplacements.reason,
        affectedTimetableEntries: teacherReplacements.affectedTimetableEntries,
        conflictDetails: teacherReplacements.conflictDetails,
        status: teacherReplacements.status,
        replacedBy: teacherReplacements.replacedBy,
        completedAt: teacherReplacements.completedAt,
        createdAt: teacherReplacements.createdAt,
        updatedAt: teacherReplacements.updatedAt,
        originalTeacher: {
          id: sql`orig_teacher.id`,
          name: sql`orig_teacher.name`,
          email: sql`orig_teacher.email`
        },
        replacementTeacher: {
          id: sql`repl_teacher.id`,
          name: sql`repl_teacher.name`,
          email: sql`repl_teacher.email`
        },
        replacedByUser: {
          id: sql`replaced_by_user.id`,
          email: sql`replaced_by_user.email`
        }
      })
      .from(teacherReplacements)
      .leftJoin(sql`${teachers} as orig_teacher`, sql`orig_teacher.id = ${teacherReplacements.originalTeacherId}`)
      .leftJoin(sql`${teachers} as repl_teacher`, sql`repl_teacher.id = ${teacherReplacements.replacementTeacherId}`)
      .leftJoin(sql`${users} as replaced_by_user`, sql`replaced_by_user.id = ${teacherReplacements.replacedBy}`)
      .where(eq(teacherReplacements.schoolId, schoolId))
      .orderBy(sql`${teacherReplacements.createdAt} DESC`);
  }

  // Enhanced substitution operations
  async getAbsentTeacherAlerts(schoolId: string, date: string): Promise<any[]> {
    const absentTeachers = await db
      .select({
        teacher: teachers,
        attendance: teacherAttendance,
      })
      .from(teacherAttendance)
      .innerJoin(teachers, eq(teacherAttendance.teacherId, teachers.id))
      .where(
        and(
          eq(teachers.schoolId, schoolId),
          eq(teacherAttendance.attendanceDate, date),
          inArray(teacherAttendance.status, ['absent', 'on_leave', 'medical_leave', 'personal_leave'])
        )
      );

    const alerts = [];
    for (const absent of absentTeachers) {
      const schedule = await db
        .select()
        .from(timetableEntries)
        .where(eq(timetableEntries.teacherId, absent.teacher.id));

      // Get the day of the week for the absence date to filter affected classes
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const affectedClassesForDay = schedule.filter(entry => entry.day.toLowerCase() === dayOfWeek);

      alerts.push({
        teacher: absent.teacher,
        attendance: absent.attendance,
        affectedClasses: affectedClassesForDay.length,  // ✅ Only count classes for the specific absence day
        schedule: schedule
      });
    }

    return alerts;
  }

  async findSubstituteTeachers(originalTeacherId: string, timetableEntryId: string, date: string): Promise<Teacher[]> {
    const entry = await db
      .select()
      .from(timetableEntries)
      .where(eq(timetableEntries.id, timetableEntryId))
      .limit(1);

    if (!entry.length) return [];

    const { day, period, subjectId } = entry[0];
    
    // Get the original teacher's school
    const originalTeacher = await this.getTeacher(originalTeacherId);
    if (!originalTeacher) return [];

    // Find teachers who can teach the same subject and are available
    const sameSubjectTeachers = await db
      .select()
      .from(teachers)
      .where(
        and(
          eq(teachers.schoolId, originalTeacher.schoolId),
          eq(teachers.isActive, true),
          ne(teachers.id, originalTeacherId)
        )
      );

    // Filter for teachers who teach this subject
    const qualifiedTeachers = sameSubjectTeachers.filter(teacher => {
      const subjectsArray = Array.isArray(teacher.subjects) ? teacher.subjects : [];
      return subjectsArray.includes(subjectId);
    });

    // Check availability (not assigned to another class at same time)
    const availableTeachers = [];
    for (const teacher of qualifiedTeachers) {
      // Check if teacher is absent on this date
      const isAbsent = await this.isTeacherAbsent(teacher.id, date);
      if (isAbsent) continue;

      // Check if teacher has conflicts at this time
      const conflicts = await db
        .select()
        .from(timetableEntries)
        .where(
          and(
            eq(timetableEntries.teacherId, teacher.id),
            eq(timetableEntries.day, day),
            eq(timetableEntries.period, period)
          )
        );

      if (conflicts.length === 0) {
        // Check daily period limit
        const dailySchedule = await db
          .select()
          .from(timetableEntries)
          .where(
            and(
              eq(timetableEntries.teacherId, teacher.id),
              eq(timetableEntries.day, day)
            )
          );

        if (dailySchedule.length < teacher.maxDailyPeriods) {
          availableTeachers.push(teacher);
        }
      }
    }

    // Sort by preference: same subject first, then by current workload
    return availableTeachers.sort((a, b) => {
      const aSubjects = Array.isArray(a.subjects) ? a.subjects : [];
      const bSubjects = Array.isArray(b.subjects) ? b.subjects : [];
      
      const aCanTeach = aSubjects.includes(subjectId);
      const bCanTeach = bSubjects.includes(subjectId);
      
      if (aCanTeach && !bCanTeach) return -1;
      if (!aCanTeach && bCanTeach) return 1;
      return 0;
    });
  }

  async autoAssignSubstitute(timetableEntryId: string, date: string, reason: string, assignedBy: string): Promise<{ success: boolean; substitution?: Substitution; message: string }> {
    try {
      const entry = await db
        .select()
        .from(timetableEntries)
        .where(eq(timetableEntries.id, timetableEntryId))
        .limit(1);

      if (!entry.length) {
        return { success: false, message: "Timetable entry not found" };
      }

      const originalTeacherId = entry[0].teacherId;
      const possibleSubstitutes = await this.findSubstituteTeachers(originalTeacherId, timetableEntryId, date);

      if (possibleSubstitutes.length === 0) {
        return { success: false, message: "No available substitute teachers found" };
      }

      // Use the first available teacher (highest priority)
      const substituteTeacher = possibleSubstitutes[0];
      
      const substitution = await this.createSubstitution({
        originalTeacherId,
        substituteTeacherId: substituteTeacher.id,
        timetableEntryId,
        date: new Date(date + 'T00:00:00Z'),
        reason,
        status: 'confirmed'
      });

      // Create audit log
      const teacher = await this.getTeacher(originalTeacherId);
      await this.createAuditLog({
        schoolId: teacher?.schoolId || '',
        userId: assignedBy,
        action: 'SUBSTITUTE',
        entityType: 'SUBSTITUTION',
        entityId: substitution.id,
        description: `Auto-assigned ${substituteTeacher.name} as substitute for ${teacher?.name}`,
        newValues: { substituteTeacherId: substituteTeacher.id, reason }
      });

      return { 
        success: true, 
        substitution, 
        message: `Successfully assigned ${substituteTeacher.name} as substitute` 
      };
    } catch (error) {
      console.error("Error auto-assigning substitute:", error);
      return { success: false, message: "Failed to assign substitute teacher" };
    }
  }

  // Manual assignment operations
  async getTeachersForClass(classId: string): Promise<Teacher[]> {
    const assignments = await db
      .select()
      .from(classSubjectAssignments)
      .where(eq(classSubjectAssignments.classId, classId));

    const teacherIds = assignments
      .filter(a => a.assignedTeacherId)
      .map(a => a.assignedTeacherId as string);

    if (teacherIds.length === 0) return [];

    const classTeachersResult = await db
      .select()
      .from(teachers)
      .where(inArray(teachers.id, teacherIds));

    return classTeachersResult;
  }

  async createManualAssignmentAudit(audit: InsertManualAssignmentAudit): Promise<ManualAssignmentAudit> {
    const [created] = await db
      .insert(manualAssignmentAudits)
      .values(audit)
      .returning();
    return created;
  }

  async getTimetableEntry(id: string): Promise<TimetableEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timetableEntries)
      .where(eq(timetableEntries.id, id));
    return entry;
  }



  async isTeacherAvailable(teacherId: string, day: string, period: number, date?: string): Promise<boolean> {
    // Check if teacher is absent on this date (if date provided)
    if (date) {
      const isAbsent = await this.isTeacherAbsent(teacherId, date);
      if (isAbsent) return false;
    }

    // Check existing timetable conflicts
    const conflicts = await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.teacherId, teacherId),
          eq(timetableEntries.day, day as any),
          eq(timetableEntries.period, period),
          eq(timetableEntries.isActive, true)
        )
      );

    if (conflicts.length > 0) return false;

    // Check daily period limits
    const teacher = await this.getTeacher(teacherId);
    if (teacher) {
      const dailySchedule = await db
        .select()
        .from(timetableEntries)
        .where(
          and(
            eq(timetableEntries.teacherId, teacherId),
            eq(timetableEntries.day, day as any),
            eq(timetableEntries.isActive, true)
          )
        );

      if (dailySchedule.length >= teacher.maxDailyPeriods) {
        return false;
      }
    }

    return true;
  }

  // Global Timetable Management
  async replaceGlobalTimetableForClass(classId: string, effectiveTimetable: TimetableEntry[]): Promise<void> {
    await db.transaction(async (tx) => {
      // First, deactivate all existing entries for this class
      await tx
        .update(timetableEntries)
        .set({ isActive: false })
        .where(eq(timetableEntries.classId, classId));
      
      // Then insert the new global timetable entries
      if (effectiveTimetable.length > 0) {
        const newEntries = effectiveTimetable.map(entry => ({
          classId: entry.classId,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          day: entry.day,
          period: entry.period,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          versionId: entry.versionId,
          isActive: true
        }));
        
        await tx.insert(timetableEntries).values(newEntries);
      }
    });
  }

  async clearWeeklyChangesForClass(classId: string, date: string): Promise<void> {
    // Calculate week start and end dates
    const selectedDate = new Date(date);
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - selectedDate.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday
    
    // Find all timetable entry IDs for this class
    const classEntries = await db
      .select({ id: timetableEntries.id })
      .from(timetableEntries)
      .where(eq(timetableEntries.classId, classId));
    
    const entryIds = classEntries.map(entry => entry.id);
    
    if (entryIds.length === 0) return;
    
    // Deactivate all timetable changes for this class in the specified week
    await db
      .update(timetableChanges)
      .set({ isActive: false })
      .where(
        and(
          inArray(timetableChanges.timetableEntryId, entryIds),
          gte(timetableChanges.changeDate, weekStart.toISOString().split('T')[0]),
          lte(timetableChanges.changeDate, weekEnd.toISOString().split('T')[0])
        )
      );
  }

  // Weekly Timetable Functions
  async getWeeklyTimetable(classId: string, weekStart: Date): Promise<WeeklyTimetable | null> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday
    
    const results = await db
      .select()
      .from(weeklyTimetables)
      .where(
        and(
          eq(weeklyTimetables.classId, classId),
          eq(weeklyTimetables.weekStart, weekStart.toISOString().split('T')[0]),
          eq(weeklyTimetables.isActive, true)
        )
      )
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }

  async createWeeklyTimetable(data: InsertWeeklyTimetable): Promise<WeeklyTimetable> {
    const results = await db
      .insert(weeklyTimetables)
      .values(data)
      .returning();
    
    return results[0];
  }

  async updateWeeklyTimetable(id: string, data: Partial<InsertWeeklyTimetable>): Promise<WeeklyTimetable> {
    const results = await db
      .update(weeklyTimetables)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(weeklyTimetables.id, id))
      .returning();
    
    return results[0];
  }

  async createOrUpdateWeeklyTimetable(
    classId: string, 
    weekStart: Date, 
    timetableData: any[],
    modifiedBy: string,
    schoolId: string
  ): Promise<WeeklyTimetable> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday
    
    // Check if a weekly timetable already exists for this class and week
    const existing = await this.getWeeklyTimetable(classId, weekStart);
    
    if (existing) {
      // Update the existing weekly timetable
      return await this.updateWeeklyTimetable(existing.id, {
        timetableData,
        modifiedBy,
        modificationCount: existing.modificationCount + 1,
      });
    } else {
      // Create a new weekly timetable
      return await this.createWeeklyTimetable({
        classId,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        timetableData,
        modifiedBy,
        modificationCount: 1,
        basedOnGlobalVersion: 'current', // Track the global version this is based on
        schoolId,
        isActive: true,
      });
    }
  }

  async promoteWeeklyTimetableToGlobal(weeklyTimetableId: string): Promise<void> {
    // Get the weekly timetable
    const weeklyTimetable = await db
      .select()
      .from(weeklyTimetables)
      .where(eq(weeklyTimetables.id, weeklyTimetableId))
      .limit(1);
    
    if (weeklyTimetable.length === 0) {
      throw new Error('Weekly timetable not found');
    }
    
    const weekly = weeklyTimetable[0];
    
    await db.transaction(async (tx) => {
      // Deactivate current global timetable entries for this class
      await tx
        .update(timetableEntries)
        .set({ isActive: false })
        .where(eq(timetableEntries.classId, weekly.classId));
      
      // Create new global timetable entries from weekly timetable data
      if (weekly.timetableData && Array.isArray(weekly.timetableData)) {
        const newEntries = weekly.timetableData
          .filter(entry => entry.teacherId && entry.subjectId) // Only non-cancelled entries
          .map(entry => ({
            classId: weekly.classId,
            teacherId: entry.teacherId,
            subjectId: entry.subjectId,
            day: entry.day as "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday",
            period: entry.period,
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room || null,
            versionId: null, // Will need to create or reference appropriate version
            isActive: true,
          }));
        
        if (newEntries.length > 0) {
          await tx.insert(timetableEntries).values(newEntries);
        }
      }
    });
  }

  // Get all timetable entries for a specific class
  async getTimetableEntriesForClass(classId: string): Promise<any[]> {
    return await db
      .select()
      .from(timetableEntries)
      .where(
        and(
          eq(timetableEntries.classId, classId),
          eq(timetableEntries.isActive, true)
        )
      )
      .orderBy(timetableEntries.day, timetableEntries.period);
  }

  // Get detailed timetable entries with teacher and subject information
  async getTimetableEntriesWithDetails(): Promise<any[]> {
    return await db
      .select({
        id: timetableEntries.id,
        classId: timetableEntries.classId,
        teacherId: timetableEntries.teacherId,
        subjectId: timetableEntries.subjectId,
        day: timetableEntries.day,
        period: timetableEntries.period,
        startTime: timetableEntries.startTime,
        endTime: timetableEntries.endTime,
        room: timetableEntries.room,
        isActive: timetableEntries.isActive,
        createdAt: timetableEntries.createdAt,
        updatedAt: timetableEntries.updatedAt,
        teacher: {
          id: teachers.id,
          name: teachers.name,
          email: teachers.email,
          contactNumber: teachers.contactNumber,
          schoolIdNumber: teachers.schoolIdNumber,
          subjects: teachers.subjects,
          classes: teachers.classes,
          availability: teachers.availability,
          maxLoad: teachers.maxLoad,
          maxDailyPeriods: teachers.maxDailyPeriods,
          schoolId: teachers.schoolId,
          isActive: teachers.isActive,
          status: teachers.status,
          createdAt: teachers.createdAt,
          updatedAt: teachers.updatedAt
        },
        subject: {
          id: subjects.id,
          name: subjects.name,
          code: subjects.code,
          periodsPerWeek: subjects.periodsPerWeek,
          color: subjects.color,
          schoolId: subjects.schoolId,
          createdAt: subjects.createdAt,
          updatedAt: subjects.updatedAt
        },
        class: {
          id: classes.id,
          grade: classes.grade,
          section: classes.section,
          studentCount: classes.studentCount,
          requiredSubjects: classes.requiredSubjects,
          schoolId: classes.schoolId,
          room: classes.room,
          createdAt: classes.createdAt,
          updatedAt: classes.updatedAt
        }
      })
      .from(timetableEntries)
      .leftJoin(teachers, eq(timetableEntries.teacherId, teachers.id))
      .leftJoin(subjects, eq(timetableEntries.subjectId, subjects.id))
      .leftJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(eq(timetableEntries.isActive, true))
      .orderBy(timetableEntries.day, timetableEntries.period);
  }

  // Deactivate all timetable entries for a specific class
  async deactivateTimetableEntriesForClass(classId: string): Promise<void> {
    await db
      .update(timetableEntries)
      .set({ 
        isActive: false,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(timetableEntries.classId, classId));
  }

  // Create multiple timetable entries at once
  async createMultipleTimetableEntries(entries: any[]): Promise<any[]> {
    if (entries.length === 0) return [];
    
    const results = await db
      .insert(timetableEntries)
      .values(entries)
      .returning();
    
    return results;
  }

  // Update or create a specific entry in weekly timetable
  async updateWeeklyTimetableEntry(
    classId: string,
    weekStart: string,
    weekEnd: string,
    day: string,
    period: number,
    entryData: {
      teacherId: string | null;
      subjectId: string | null;
      startTime?: string;
      endTime?: string;
      room?: string | null;
      isModified: boolean;
      modificationReason?: string;
    },
    modifiedBy: string
  ): Promise<{ id: string; modificationCount: number }> {
    return await db.transaction(async (tx) => {
      // First get or create the weekly timetable for this week
      let [existingWeeklyTimetable] = await tx
        .select()
        .from(weeklyTimetables)
        .where(
          and(
            eq(weeklyTimetables.classId, classId),
            eq(weeklyTimetables.weekStart, weekStart),
            eq(weeklyTimetables.isActive, true)
          )
        );

      let timetableData: any[] = [];
      let modificationCount = 1;

      if (existingWeeklyTimetable) {
        // Update existing weekly timetable
        timetableData = Array.isArray(existingWeeklyTimetable.timetableData) 
          ? [...existingWeeklyTimetable.timetableData] 
          : [];
        modificationCount = (existingWeeklyTimetable.modificationCount || 0) + 1;
      } else {
        // Create new weekly timetable based on current global timetable for this class
        const globalEntries = await tx
          .select()
          .from(timetableEntries)
          .where(
            and(
              eq(timetableEntries.classId, classId),
              eq(timetableEntries.isActive, true)
            )
          );

        // Convert global entries to weekly timetable format
        timetableData = globalEntries.map(entry => ({
          day: entry.day,
          period: entry.period,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          isModified: false
        }));
      }

      // Find and update the specific entry, or add it if it doesn't exist
      const entryIndex = timetableData.findIndex(
        entry => entry.day.toLowerCase() === day.toLowerCase() && entry.period === period
      );

      // If both teacherId and subjectId are null, this is a deletion - remove the entry
      if (!entryData.teacherId && !entryData.subjectId) {
        if (entryIndex >= 0) {
          // Remove the entry from the timetable data
          timetableData.splice(entryIndex, 1);
        }
        // If entry doesn't exist, nothing to delete
      } else {
        // This is an assignment/update - create or update the entry
        const updatedEntry = {
          day: day.toLowerCase(),
          period,
          teacherId: entryData.teacherId,
          subjectId: entryData.subjectId,
          startTime: entryData.startTime || "08:00",
          endTime: entryData.endTime || "08:45",
          room: entryData.room || null,
          isModified: entryData.isModified,
          modificationReason: entryData.modificationReason
        };

        if (entryIndex >= 0) {
          timetableData[entryIndex] = updatedEntry;
        } else {
          timetableData.push(updatedEntry);
        }
      }

      if (existingWeeklyTimetable) {
        // Update existing record
        const [updated] = await tx
          .update(weeklyTimetables)
          .set({
            timetableData,
            modificationCount,
            modifiedBy,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(weeklyTimetables.id, existingWeeklyTimetable.id))
          .returning({ id: weeklyTimetables.id, modificationCount: weeklyTimetables.modificationCount });

        return { id: updated.id, modificationCount: updated.modificationCount };
      } else {
        // Create new record
        const [created] = await tx
          .insert(weeklyTimetables)
          .values({
            classId,
            weekStart,
            weekEnd,
            timetableData,
            modifiedBy,
            modificationCount,
            schoolId: (await tx.select({ schoolId: classes.schoolId }).from(classes).where(eq(classes.id, classId)))[0].schoolId
          })
          .returning({ id: weeklyTimetables.id, modificationCount: weeklyTimetables.modificationCount });

        return { id: created.id, modificationCount: created.modificationCount };
      }
    });
  }

  // Delete global timetable and current/future weekly timetables for a specific class
  async deleteGlobalAndFutureWeeklyTimetables(classId: string): Promise<{ globalDeleted: number, weeklyDeleted: number }> {
    const result = { globalDeleted: 0, weeklyDeleted: 0 };
    
    // Calculate current week start (Monday)
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday of current week
    currentWeekStart.setHours(0, 0, 0, 0); // Start of day
    
    const currentWeekStartString = currentWeekStart.toISOString().split('T')[0];
    
    await db.transaction(async (tx) => {
      // Delete all global timetable entries for this class
      const deletedGlobal = await tx
        .delete(timetableEntries)
        .where(eq(timetableEntries.classId, classId))
        .returning({ id: timetableEntries.id });
      
      result.globalDeleted = deletedGlobal.length;
      
      // Delete only weekly timetables from current week onwards (preserve past weeks for history)
      const deletedWeekly = await tx
        .delete(weeklyTimetables)
        .where(
          and(
            eq(weeklyTimetables.classId, classId),
            gte(weeklyTimetables.weekStart, currentWeekStartString)
          )
        )
        .returning({ id: weeklyTimetables.id });
      
      result.weeklyDeleted = deletedWeekly.length;
    });
    
    return result;
  }
}

export const storage = new DatabaseStorage();