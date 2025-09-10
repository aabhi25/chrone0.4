import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  boolean,
  uuid,
  index,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Schools table
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  contactPhone: varchar("contact_phone", { length: 15 }),
  adminName: varchar("admin_name", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  timetableFrozen: boolean("timetable_frozen").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { enum: ["super_admin", "admin", "teacher"] }).notNull().default("teacher"),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  passwordChangedAt: timestamp("password_changed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teachers table
export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).unique(),
  contactNumber: varchar("contact_number", { length: 15 }),
  schoolIdNumber: varchar("school_id_number", { length: 50 }),
  subjects: jsonb("subjects").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  classes: jsonb("classes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  availability: jsonb("availability").$type<{
    monday: string[];
    tuesday: string[];
    wednesday: string[];
    thursday: string[];
    friday: string[];
    saturday: string[];
  }>().notNull().default(sql`'{"monday":[],"tuesday":[],"wednesday":[],"thursday":[],"friday":[],"saturday":[]}'::jsonb`),
  maxLoad: integer("max_load").notNull().default(30),
  maxDailyPeriods: integer("max_daily_periods").notNull().default(6), // Maximum periods per day
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  status: varchar("status", { enum: ["active", "inactive", "left_school"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  periodsPerWeek: integer("periods_per_week").notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Classes table
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  grade: varchar("grade", { length: 50 }).notNull(),
  section: varchar("section", { length: 10 }).notNull(),
  studentCount: integer("student_count").notNull().default(0),
  requiredSubjects: jsonb("required_subjects").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  room: varchar("room", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Class Subject Assignments with weekly frequency
export const classSubjectAssignments = pgTable("class_subject_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  weeklyFrequency: integer("weekly_frequency").notNull(), // How many periods per week
  assignedTeacherId: uuid("assigned_teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Timetable versions
export const timetableVersions = pgTable("timetable_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 10 }).notNull(), // v0.1, v0.2, etc.
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  isActive: boolean("is_active").notNull().default(false), // Only one version can be active per class per week
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Timetable entries
export const timetableEntries = pgTable("timetable_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  day: varchar("day", { enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] }).notNull(),
  period: integer("period").notNull(), // 1-8 for different time slots
  startTime: varchar("start_time", { length: 5 }).notNull(), // "09:00"
  endTime: varchar("end_time", { length: 5 }).notNull(), // "09:45"
  room: varchar("room", { length: 100 }),
  versionId: uuid("version_id").references(() => timetableVersions.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Timetable validity periods table
export const timetableValidityPeriods = pgTable("timetable_validity_periods", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Substitutions table
export const substitutions = pgTable("substitutions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  originalTeacherId: uuid("original_teacher_id").notNull().references(() => teachers.id),
  substituteTeacherId: uuid("substitute_teacher_id").references(() => teachers.id),
  timetableEntryId: uuid("timetable_entry_id").notNull().references(() => timetableEntries.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  reason: text("reason"),
  status: varchar("status", { enum: ["pending", "confirmed", "rejected", "auto_assigned"] }).notNull().default("pending"),
  isAutoGenerated: boolean("is_auto_generated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Timetable Changes table - for tracking all modifications
export const timetableChanges = pgTable("timetable_changes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timetableEntryId: uuid("timetable_entry_id").notNull().references(() => timetableEntries.id, { onDelete: "cascade" }),
  changeType: varchar("change_type", { enum: ["substitution", "cancellation", "room_change", "time_change"] }).notNull(),
  changeDate: date("change_date").notNull(),
  originalTeacherId: uuid("original_teacher_id").references(() => teachers.id),
  newTeacherId: uuid("new_teacher_id").references(() => teachers.id),
  originalRoom: varchar("original_room", { length: 100 }),
  newRoom: varchar("new_room", { length: 100 }),
  reason: text("reason").notNull(),
  changeSource: varchar("change_source", { enum: ["manual", "auto_absence", "auto_substitution"] }).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Timetable Structure table
export const timetableStructures = pgTable("timetable_structures", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  periodsPerDay: integer("periods_per_day").notNull().default(8),
  workingDays: jsonb("working_days").$type<string[]>().notNull().default(sql`'["monday","tuesday","wednesday","thursday","friday","saturday"]'::jsonb`),
  timeSlots: jsonb("time_slots").$type<{
    period: number;
    startTime: string;
    endTime: string;
    isBreak?: boolean;
  }[]>().notNull().default(sql`'[{"period":1,"startTime":"07:30","endTime":"08:15"},{"period":2,"startTime":"08:15","endTime":"09:00"},{"period":3,"startTime":"09:00","endTime":"09:45"},{"period":4,"startTime":"09:45","endTime":"10:15"},{"period":5,"startTime":"10:15","endTime":"11:00","isBreak":true},{"period":6,"startTime":"11:00","endTime":"11:45"},{"period":7,"startTime":"11:45","endTime":"12:30"},{"period":8,"startTime":"12:30","endTime":"13:15"}]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Weekly Timetables table - stores admin-modified weekly timetable snapshots
export const weeklyTimetables = pgTable("weekly_timetables", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(), // Monday of the week
  weekEnd: date("week_end").notNull(), // Sunday of the week  
  timetableData: jsonb("timetable_data").$type<{
    day: string;
    period: number;
    teacherId: string | null; // null for cancelled periods
    subjectId: string | null; // null for cancelled periods
    startTime: string;
    endTime: string;
    room: string | null;
    isModified: boolean; // true if different from global timetable
    modificationReason?: string;
  }[]>().notNull().default(sql`'[]'::jsonb`),
  modifiedBy: varchar("modified_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  modificationCount: integer("modification_count").notNull().default(1), // Track number of changes made
  basedOnGlobalVersion: varchar("based_on_global_version"), // Track which global version this was based on
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure only one active weekly timetable per class per week
  classWeekIdx: index("class_week_idx").on(table.classId, table.weekStart),
}));

// Teacher attendance table
export const teacherAttendance = pgTable("teacher_attendance", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  status: varchar("status", { enum: ["present", "absent", "on_leave", "medical_leave", "personal_leave"] }).notNull().default("present"),
  reason: text("reason"), // Reason for absence or leave
  leaveStartDate: date("leave_start_date"), // For multi-day leave tracking
  leaveEndDate: date("leave_end_date"), // For multi-day leave tracking
  isFullDay: boolean("is_full_day").notNull().default(true), // For half-day leaves
  markedBy: varchar("marked_by").references(() => users.id), // Who marked the attendance
  markedAt: timestamp("marked_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit logs table for tracking changes
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(), // CREATE, UPDATE, DELETE, SUBSTITUTE
  entityType: varchar("entity_type", { length: 50 }).notNull(), // TEACHER, TIMETABLE_ENTRY, SUBSTITUTION
  entityId: varchar("entity_id", { length: 36 }).notNull(),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  teachers: many(teachers),
  subjects: many(subjects),
  classes: many(classes),
  timetableStructures: many(timetableStructures),
  weeklyTimetables: many(weeklyTimetables),
}));

export const usersRelations = relations(users, ({ one }) => ({
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
  teacher: one(teachers, {
    fields: [users.teacherId],
    references: [teachers.id],
  }),
}));

export const teachersRelations = relations(teachers, ({ one, many }) => ({
  school: one(schools, {
    fields: [teachers.schoolId],
    references: [schools.id],
  }),
  user: one(users),
  timetableEntries: many(timetableEntries),
  originalSubstitutions: many(substitutions, { relationName: "originalTeacher" }),
  substituteSubstitutions: many(substitutions, { relationName: "substituteTeacher" }),
  attendanceRecords: many(teacherAttendance),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  school: one(schools, {
    fields: [subjects.schoolId],
    references: [schools.id],
  }),
  timetableEntries: many(timetableEntries),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, {
    fields: [classes.schoolId],
    references: [schools.id],
  }),
  timetableEntries: many(timetableEntries),
  timetableValidityPeriods: many(timetableValidityPeriods),
  classSubjectAssignments: many(classSubjectAssignments),
  timetableVersions: many(timetableVersions),
  weeklyTimetables: many(weeklyTimetables),
}));

export const classSubjectAssignmentsRelations = relations(classSubjectAssignments, ({ one }) => ({
  class: one(classes, {
    fields: [classSubjectAssignments.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [classSubjectAssignments.subjectId],
    references: [subjects.id],
  }),
  assignedTeacher: one(teachers, {
    fields: [classSubjectAssignments.assignedTeacherId],
    references: [teachers.id],
  }),
}));

export const timetableVersionsRelations = relations(timetableVersions, ({ one, many }) => ({
  class: one(classes, {
    fields: [timetableVersions.classId],
    references: [classes.id],
  }),
  timetableEntries: many(timetableEntries),
}));

export const timetableEntriesRelations = relations(timetableEntries, ({ one, many }) => ({
  class: one(classes, {
    fields: [timetableEntries.classId],
    references: [classes.id],
  }),
  teacher: one(teachers, {
    fields: [timetableEntries.teacherId],
    references: [teachers.id],
  }),
  subject: one(subjects, {
    fields: [timetableEntries.subjectId],
    references: [subjects.id],
  }),
  version: one(timetableVersions, {
    fields: [timetableEntries.versionId],
    references: [timetableVersions.id],
  }),
  substitutions: many(substitutions),
}));

export const substitutionsRelations = relations(substitutions, ({ one }) => ({
  originalTeacher: one(teachers, {
    fields: [substitutions.originalTeacherId],
    references: [teachers.id],
    relationName: "originalTeacher",
  }),
  substituteTeacher: one(teachers, {
    fields: [substitutions.substituteTeacherId],
    references: [teachers.id],
    relationName: "substituteTeacher",
  }),
  timetableEntry: one(timetableEntries, {
    fields: [substitutions.timetableEntryId],
    references: [timetableEntries.id],
  }),
}));

export const timetableChangesRelations = relations(timetableChanges, ({ one }) => ({
  timetableEntry: one(timetableEntries, {
    fields: [timetableChanges.timetableEntryId],
    references: [timetableEntries.id],
  }),
  originalTeacher: one(teachers, {
    fields: [timetableChanges.originalTeacherId],
    references: [teachers.id],
    relationName: "originalTeacher",
  }),
  newTeacher: one(teachers, {
    fields: [timetableChanges.newTeacherId],
    references: [teachers.id],
    relationName: "newTeacher",
  }),
  approver: one(users, {
    fields: [timetableChanges.approvedBy],
    references: [users.id],
  }),
}));

export const timetableValidityPeriodsRelations = relations(timetableValidityPeriods, ({ one }) => ({
  class: one(classes, {
    fields: [timetableValidityPeriods.classId],
    references: [classes.id],
  }),
}));

export const timetableStructuresRelations = relations(timetableStructures, ({ one }) => ({
  school: one(schools, {
    fields: [timetableStructures.schoolId],
    references: [schools.id],
  }),
}));

export const teacherAttendanceRelations = relations(teacherAttendance, ({ one }) => ({
  teacher: one(teachers, {
    fields: [teacherAttendance.teacherId],
    references: [teachers.id],
  }),
  school: one(schools, {
    fields: [teacherAttendance.schoolId],
    references: [schools.id],
  }),
  markedByUser: one(users, {
    fields: [teacherAttendance.markedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  school: one(schools, {
    fields: [auditLogs.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const weeklyTimetablesRelations = relations(weeklyTimetables, ({ one }) => ({
  class: one(classes, {
    fields: [weeklyTimetables.classId],
    references: [classes.id],
  }),
  school: one(schools, {
    fields: [weeklyTimetables.schoolId],
    references: [schools.id],
  }),
  modifiedByUser: one(users, {
    fields: [weeklyTimetables.modifiedBy],
    references: [users.id],
  }),
}));


// Insert schemas
export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for creating and assigning a subject to a class in one operation
export const createAndAssignSubjectSchema = z.object({
  name: z.string().min(1, "Subject name is required").max(255, "Subject name too long"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").default("#3B82F6"),
  classId: z.string().uuid("Invalid class ID"),
  weeklyFrequency: z.number().min(1, "Weekly frequency must be at least 1").max(8, "Weekly frequency cannot exceed 8 periods"),
});

export const insertClassSchema = createInsertSchema(classes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).refine(
  (data) => !data.section || !data.section.includes(","),
  "Section cannot contain commas. Each class-section combination must be separate."
);

export const updateClassSchema = createInsertSchema(classes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial().refine(
  (data) => !data.section || !data.section.includes(","),
  "Section cannot contain commas. Each class-section combination must be separate."
);

export const insertTimetableEntrySchema = createInsertSchema(timetableEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyTimetableSchema = createInsertSchema(weeklyTimetables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubstitutionSchema = createInsertSchema(substitutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimetableChangeSchema = createInsertSchema(timetableChanges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimetableValidityPeriodSchema = createInsertSchema(timetableValidityPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClassSubjectAssignmentSchema = createInsertSchema(classSubjectAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimetableStructureSchema = createInsertSchema(timetableStructures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimetableVersionSchema = createInsertSchema(timetableVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Manual Assignment Audit Log table - AFTER all other table definitions
export const manualAssignmentAudits = pgTable("manual_assignment_audits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timetableEntryId: uuid("timetable_entry_id").notNull(), // Remove foreign key constraint to allow audit logs of deleted entries
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  day: varchar("day", { enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] }).notNull(),
  period: integer("period").notNull(),
  oldTeacherId: uuid("old_teacher_id").references(() => teachers.id),
  newTeacherId: uuid("new_teacher_id").references(() => teachers.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").references(() => subjects.id),
  changeReason: text("change_reason").default("Manual assignment by admin"),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teacher Replacements table - For tracking permanent teacher replacements
export const teacherReplacements = pgTable("teacher_replacements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  originalTeacherId: uuid("original_teacher_id").notNull().references(() => teachers.id),
  replacementTeacherId: uuid("replacement_teacher_id").notNull().references(() => teachers.id),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  replacementDate: timestamp("replacement_date").notNull(),
  reason: text("reason").notNull(),
  affectedTimetableEntries: integer("affected_timetable_entries").notNull().default(0),
  conflictDetails: jsonb("conflict_details").$type<{
    hasConflicts: boolean;
    conflictEntries?: {
      day: string;
      period: number;
      existingClass: string;
      conflictingClass: string;
    }[];
  }>().notNull().default(sql`'{"hasConflicts": false}'::jsonb`),
  status: varchar("status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  replacedBy: varchar("replaced_by").notNull().references(() => users.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for teacherReplacements
export const teacherReplacementsRelations = relations(teacherReplacements, ({ one }) => ({
  originalTeacher: one(teachers, {
    fields: [teacherReplacements.originalTeacherId],
    references: [teachers.id],
    relationName: "originalTeacher",
  }),
  replacementTeacher: one(teachers, {
    fields: [teacherReplacements.replacementTeacherId],
    references: [teachers.id],
    relationName: "replacementTeacher",
  }),
  school: one(schools, {
    fields: [teacherReplacements.schoolId],
    references: [schools.id],
  }),
  replacedByUser: one(users, {
    fields: [teacherReplacements.replacedBy],
    references: [users.id],
  }),
}));

export const insertManualAssignmentAuditSchema = createInsertSchema(manualAssignmentAudits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeacherReplacementSchema = createInsertSchema(teacherReplacements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeacherAttendanceSchema = createInsertSchema(teacherAttendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  markedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Schema for updating teacher daily periods
export const updateTeacherDailyPeriodsSchema = z.object({
  teacherId: z.string().uuid().optional(),
  maxDailyPeriods: z.number().min(1).max(10),
  applyToAll: z.boolean().default(false), // If true, apply to all teachers in school
});

// Bulk attendance marking schema for leave management
export const bulkAttendanceSchema = z.object({
  teacherId: z.string().uuid(),
  status: z.enum(["absent", "on_leave", "medical_leave", "personal_leave"]),
  reason: z.string().optional(),
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  isFullDay: z.boolean().default(true),
});

// Types
export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;

export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;

export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;

export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;

export type TimetableEntry = typeof timetableEntries.$inferSelect;
export type InsertTimetableEntry = z.infer<typeof insertTimetableEntrySchema>;

export type Substitution = typeof substitutions.$inferSelect;
export type InsertSubstitution = z.infer<typeof insertSubstitutionSchema>;

export type TimetableChange = typeof timetableChanges.$inferSelect;
export type InsertTimetableChange = z.infer<typeof insertTimetableChangeSchema>;

export type TimetableValidityPeriod = typeof timetableValidityPeriods.$inferSelect;
export type InsertTimetableValidityPeriod = z.infer<typeof insertTimetableValidityPeriodSchema>;

export type ClassSubjectAssignment = typeof classSubjectAssignments.$inferSelect;
export type InsertClassSubjectAssignment = z.infer<typeof insertClassSubjectAssignmentSchema>;

export type TimetableStructure = typeof timetableStructures.$inferSelect;
export type InsertTimetableStructure = z.infer<typeof insertTimetableStructureSchema>;

export type TimetableVersion = typeof timetableVersions.$inferSelect;
export type InsertTimetableVersion = z.infer<typeof insertTimetableVersionSchema>;

export type TeacherAttendance = typeof teacherAttendance.$inferSelect;
export type InsertTeacherAttendance = z.infer<typeof insertTeacherAttendanceSchema>;
export type BulkAttendanceData = z.infer<typeof bulkAttendanceSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type UpdateTeacherDailyPeriods = z.infer<typeof updateTeacherDailyPeriodsSchema>;

export type ManualAssignmentAudit = typeof manualAssignmentAudits.$inferSelect;
export type InsertManualAssignmentAudit = z.infer<typeof insertManualAssignmentAuditSchema>;

export type TeacherReplacement = typeof teacherReplacements.$inferSelect;
export type InsertTeacherReplacement = z.infer<typeof insertTeacherReplacementSchema>;

export type WeeklyTimetable = typeof weeklyTimetables.$inferSelect;
export type InsertWeeklyTimetable = z.infer<typeof insertWeeklyTimetableSchema>;
