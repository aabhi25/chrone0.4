import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { loginSchema } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Define custom user type with all fields
interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  role: "super_admin" | "admin" | "teacher";
  schoolId?: string | null;
  teacherId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      schoolId: user.schoolId 
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware to authenticate requests
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const user = await storage.getUser(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    req.user = user as AuthUser;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ message: "Authentication failed" });
  }
}

// Middleware to check user roles
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}

// Middleware to check school access (for non-super admins)
export function requireSchoolAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Super admins can access any school
  if (req.user.role === "super_admin") {
    return next();
  }

  // Check if user belongs to the school they're trying to access
  const schoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;
  
  if (schoolId && req.user.schoolId !== schoolId) {
    return res.status(403).json({ message: "Access denied to this school" });
  }

  next();
}

// Login endpoint
export async function login(req: Request, res: Response) {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const authUser = user as AuthUser;
    const isValidPassword = await comparePasswords(password, authUser.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user's school is active (skip for super admin)
    if (authUser.role !== "super_admin" && authUser.schoolId) {
      const school = await storage.getSchool(authUser.schoolId);
      if (!school || !school.isActive) {
        return res.status(403).json({ 
          message: "Account access is currently unavailable. Please contact support." 
        });
      }
    }

    const token = generateToken(authUser);
    
    // Don't send password hash in response
    const { passwordHash, ...userWithoutPassword } = authUser;
    
    res.json({
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
}

// Get current user endpoint
export async function getCurrentUser(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Don't send password hash
  const { passwordHash, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
}

// Register endpoint for creating school admin accounts
export async function registerSchoolAdmin(req: Request, res: Response) {
  try {
    // Only super admins can create school admin accounts
    if (!req.user || req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Access denied. Super Admin required." });
    }

    const { email, password, firstName, lastName, schoolId } = req.body;
    
    if (!email || !password || !schoolId) {
      return res.status(400).json({ message: "Email, password, and school ID are required" });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Create school admin user
    const hashedPassword = await hashPassword(password);
    const newUser = await storage.createUser({
      email,
      passwordHash: hashedPassword,
      role: "admin",
      schoolId,
      firstName: firstName || null,
      lastName: lastName || null,
      teacherId: null
    });

    // Don't send password hash in response
    const { passwordHash, ...userWithoutPassword } = newUser as any;
    
    res.status(201).json({
      message: "School admin account created successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
}

// Setup authentication routes
export function setupCustomAuth(app: any): void {
  app.post("/api/auth/login", login);
  app.post("/api/auth/register-school-admin", authenticateToken, registerSchoolAdmin);
}

// Export middleware
export const authMiddleware = authenticateToken;