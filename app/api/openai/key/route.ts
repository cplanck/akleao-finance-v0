import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { query } from "@/lib/db";
import crypto from "crypto";

// Encryption helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-cbc";

function encrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// POST /api/openai/key - Save encrypted OpenAI API key
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { api_key, admin_key, key_type } = await request.json();

    // Validate based on key_type
    if (key_type === "admin") {
      if (!admin_key || !admin_key.startsWith("sk-")) {
        return NextResponse.json({ error: "Invalid admin API key format" }, { status: 400 });
      }

      // Encrypt the admin API key
      const encryptedAdminKey = encrypt(admin_key);

      // Store or update the encrypted admin key
      await query(
        `INSERT INTO user_api_keys (user_id, encrypted_admin_key, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET encrypted_admin_key = $2, updated_at = NOW()`,
        [session.user.id, encryptedAdminKey]
      );

      return NextResponse.json({ success: true, message: "Admin API key saved successfully" });
    } else {
      // Regular API key
      if (!api_key || !api_key.startsWith("sk-")) {
        return NextResponse.json({ error: "Invalid API key format" }, { status: 400 });
      }

      // Encrypt the API key
      const encryptedKey = encrypt(api_key);

      // Store or update the encrypted key
      await query(
        `INSERT INTO user_api_keys (user_id, encrypted_key, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET encrypted_key = $2, updated_at = NOW()`,
        [session.user.id, encryptedKey]
      );

      return NextResponse.json({ success: true, message: "API key saved successfully" });
    }
  } catch (error) {
    console.error("Error saving OpenAI API key:", error);
    return NextResponse.json({ error: "Failed to save API key" }, { status: 500 });
  }
}

// DELETE /api/openai/key - Remove OpenAI API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await query("DELETE FROM user_api_keys WHERE user_id = $1", [session.user.id]);

    return NextResponse.json({ success: true, message: "API key removed successfully" });
  } catch (error) {
    console.error("Error deleting OpenAI API key:", error);
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
}
