import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { query } from "@/lib/db";

// GET /api/openai/keys/status - Quickly check if API keys are configured
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has API keys
    const keyResult = await query<{ encrypted_key: string; encrypted_admin_key: string }>(
      "SELECT encrypted_key, encrypted_admin_key FROM user_api_keys WHERE user_id = $1",
      [session.user.id]
    );

    const has_api_key = keyResult.length > 0 && !!keyResult[0].encrypted_key;
    const has_admin_key = keyResult.length > 0 && !!keyResult[0].encrypted_admin_key;

    return NextResponse.json({
      has_api_key,
      has_admin_key,
    });
  } catch (error) {
    console.error("Error fetching key status:", error);
    return NextResponse.json({ error: "Failed to fetch key status" }, { status: 500 });
  }
}
