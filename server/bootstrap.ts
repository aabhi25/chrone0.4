import { storage } from "./storage";
import { hashPassword } from "./auth";

/**
 * Bootstrap script to create the initial Super Admin user
 * This script should be run once during initial setup
 */
export async function createSuperAdmin() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    console.log("⚠️  Super Admin credentials not provided in environment variables");
    console.log("   Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to create initial admin");
    return;
  }

  try {
    // Check if super admin already exists
    const existingAdmin = await storage.getUserByEmail(superAdminEmail);
    if (existingAdmin) {
      console.log("✅ Super Admin already exists");
      return;
    }

    // Create the super admin user
    const hashedPassword = await hashPassword(superAdminPassword);
    const superAdmin = await storage.createUser({
      email: superAdminEmail,
      passwordHash: hashedPassword,
      role: "super_admin",
      firstName: "Super",
      lastName: "Admin",
      schoolId: null, // Super admins don't belong to a specific school
      teacherId: null
    });

    console.log("🎉 Super Admin created successfully!");
    console.log(`   Email: ${superAdmin.email}`);
    console.log("   You can now login with these credentials");
  } catch (error) {
    console.error("❌ Failed to create Super Admin:", error);
  }
}