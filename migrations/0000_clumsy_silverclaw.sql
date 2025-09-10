CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(36) NOT NULL,
	"previous_values" jsonb,
	"new_values" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "class_subject_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"weekly_frequency" integer NOT NULL,
	"assigned_teacher_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade" varchar(50) NOT NULL,
	"section" varchar(10) NOT NULL,
	"student_count" integer DEFAULT 0 NOT NULL,
	"required_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"school_id" uuid NOT NULL,
	"room" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"contact_phone" varchar(15),
	"admin_name" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(10) NOT NULL,
	"periods_per_week" integer NOT NULL,
	"color" varchar(7) DEFAULT '#3B82F6' NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "substitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_teacher_id" uuid NOT NULL,
	"substitute_teacher_id" uuid,
	"timetable_entry_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"reason" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"is_auto_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teacher_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"status" varchar DEFAULT 'present' NOT NULL,
	"reason" text,
	"leave_start_date" date,
	"leave_end_date" date,
	"is_full_day" boolean DEFAULT true NOT NULL,
	"marked_by" varchar,
	"marked_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"contact_number" varchar(15),
	"school_id_number" varchar(50),
	"subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"availability" jsonb DEFAULT '{"monday":[],"tuesday":[],"wednesday":[],"thursday":[],"friday":[],"saturday":[]}'::jsonb NOT NULL,
	"max_load" integer DEFAULT 30 NOT NULL,
	"max_daily_periods" integer DEFAULT 6 NOT NULL,
	"school_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "teachers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "timetable_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timetable_entry_id" uuid NOT NULL,
	"change_type" varchar NOT NULL,
	"change_date" date NOT NULL,
	"original_teacher_id" uuid,
	"new_teacher_id" uuid,
	"original_room" varchar(100),
	"new_room" varchar(100),
	"reason" text NOT NULL,
	"change_source" varchar NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timetable_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"day" varchar NOT NULL,
	"period" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"room" varchar(100),
	"version_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timetable_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"periods_per_day" integer DEFAULT 8 NOT NULL,
	"working_days" jsonb DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday"]'::jsonb NOT NULL,
	"time_slots" jsonb DEFAULT '[{"period":1,"startTime":"07:30","endTime":"08:15"},{"period":2,"startTime":"08:15","endTime":"09:00"},{"period":3,"startTime":"09:00","endTime":"09:45"},{"period":4,"startTime":"09:45","endTime":"10:15"},{"period":5,"startTime":"10:15","endTime":"11:00","isBreak":true},{"period":6,"startTime":"11:00","endTime":"11:45"},{"period":7,"startTime":"11:45","endTime":"12:30"},{"period":8,"startTime":"12:30","endTime":"13:15"}]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timetable_validity_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timetable_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"version" varchar(10) NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar DEFAULT 'teacher' NOT NULL,
	"school_id" uuid,
	"teacher_id" uuid,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"password_changed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject_assignments" ADD CONSTRAINT "class_subject_assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject_assignments" ADD CONSTRAINT "class_subject_assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject_assignments" ADD CONSTRAINT "class_subject_assignments_assigned_teacher_id_teachers_id_fk" FOREIGN KEY ("assigned_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_original_teacher_id_teachers_id_fk" FOREIGN KEY ("original_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_substitute_teacher_id_teachers_id_fk" FOREIGN KEY ("substitute_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_timetable_entry_id_timetable_entries_id_fk" FOREIGN KEY ("timetable_entry_id") REFERENCES "public"."timetable_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_attendance" ADD CONSTRAINT "teacher_attendance_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_attendance" ADD CONSTRAINT "teacher_attendance_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_attendance" ADD CONSTRAINT "teacher_attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_changes" ADD CONSTRAINT "timetable_changes_timetable_entry_id_timetable_entries_id_fk" FOREIGN KEY ("timetable_entry_id") REFERENCES "public"."timetable_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_changes" ADD CONSTRAINT "timetable_changes_original_teacher_id_teachers_id_fk" FOREIGN KEY ("original_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_changes" ADD CONSTRAINT "timetable_changes_new_teacher_id_teachers_id_fk" FOREIGN KEY ("new_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_changes" ADD CONSTRAINT "timetable_changes_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_version_id_timetable_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."timetable_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_structures" ADD CONSTRAINT "timetable_structures_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_validity_periods" ADD CONSTRAINT "timetable_validity_periods_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;