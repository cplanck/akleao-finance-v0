import { query } from "@/lib/db";
import crypto from "crypto";

// Encryption helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-cbc";

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

// Helper function to get decrypted API key
export async function getDecryptedApiKey(userId: string, keyType: 'regular' | 'admin' = 'regular'): Promise<string | null> {
  try {
    const column = keyType === 'admin' ? 'encrypted_admin_key' : 'encrypted_key';
    const result = await query<{ encrypted_key?: string; encrypted_admin_key?: string }>(
      `SELECT ${column} FROM user_api_keys WHERE user_id = $1`,
      [userId]
    );

    if (result.length === 0) {
      return null;
    }

    const encryptedKey = keyType === 'admin' ? result[0].encrypted_admin_key : result[0].encrypted_key;

    if (!encryptedKey) {
      return null;
    }

    return decrypt(encryptedKey);
  } catch (error) {
    console.error("Error getting decrypted API key:", error);
    return null;
  }
}

// Helper function to track OpenAI usage
export async function trackOpenAIUsage(
  userId: string,
  tokens: number,
  cost: number
): Promise<void> {
  try {
    await query(
      `INSERT INTO openai_usage (user_id, request_count, tokens_used, estimated_cost, last_request_at)
       VALUES ($1, 1, $2, $3, NOW())
       ON CONFLICT (user_id, DATE(last_request_at))
       DO UPDATE SET
         request_count = openai_usage.request_count + 1,
         tokens_used = openai_usage.tokens_used + $2,
         estimated_cost = openai_usage.estimated_cost + $3,
         last_request_at = NOW()`,
      [userId, tokens, cost]
    );
  } catch (error) {
    console.error("Error tracking OpenAI usage:", error);
  }
}
