import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : undefined
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scopes: ["openid", "email", "profile"],
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
    "https://akleao-finance-v0.vercel.app",
    "https://akleao-finance-v0-pj4dlb12x-cplancks-projects.vercel.app"
  ],
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});
