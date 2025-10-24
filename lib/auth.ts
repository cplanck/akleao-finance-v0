import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : undefined
  }),
  // JWT Configuration - use same secret as FastAPI
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET_KEY!,
  // Include custom user fields in session
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
      }
    }
  },
  session: {
    // Use JWT instead of session tokens
    jwt: {
      enabled: true,
      expiresIn: 60 * 60 * 24, // 24 hours (same as FastAPI)
    },
    // Cookie configuration
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24, // 24 hours
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scopes: ["openid", "email", "profile"],
      // Force account selection screen on every login
      authorizationParams: {
        prompt: "select_account",
        // Additional parameter to prevent auto-login
        max_age: "0",
      },
      mapProfileToUser: (profile) => {
        console.log("Google profile data:", profile);
        const user = {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture, // Map Google's 'picture' field to 'image'
          emailVerified: profile.email_verified,
        };
        console.log("Mapped user data:", user);
        return user;
      },
    },
  },
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:8001", // Add FastAPI backend
    "https://akleao-finance-v0.vercel.app",
    "https://akleao-finance-v0-pj4dlb12x-cplancks-projects.vercel.app"
  ],
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});
