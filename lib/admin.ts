import { auth } from "./auth";
import { headers } from "next/headers";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Check if the current user is an admin
 * This should be called in Server Components or API routes
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.email) {
      return false;
    }

    // Query database to check if user has admin role
    const result = await pool.query(
      'SELECT role FROM "user" WHERE email = $1',
      [session.user.email]
    );

    return result.rows[0]?.role === "admin";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Require admin access - throws error if not admin
 * Use this at the top of admin pages/routes
 */
export async function requireAdmin() {
  const adminStatus = await isAdmin();

  if (!adminStatus) {
    throw new Error("Unauthorized: Admin access required");
  }
}

/**
 * Get user role from database
 */
export async function getUserRole(email: string): Promise<string | null> {
  try {
    const result = await pool.query(
      'SELECT role FROM "user" WHERE email = $1',
      [email]
    );
    return result.rows[0]?.role || null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}
