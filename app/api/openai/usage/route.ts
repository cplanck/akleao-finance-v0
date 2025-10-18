import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { query } from "@/lib/db";

// GET /api/openai/usage - Get OpenAI usage statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has an API key
    const keyResult = await query<{ encrypted_key: string }>(
      "SELECT encrypted_key FROM user_api_keys WHERE user_id = $1",
      [session.user.id]
    );

    const has_api_key = keyResult.length > 0;

    // Get usage statistics
    const usageResult = await query<{
      total_requests: number;
      total_tokens: number;
      estimated_cost: number;
      last_used: string | null;
    }>(
      `SELECT
        COALESCE(SUM(request_count), 0)::int as total_requests,
        COALESCE(SUM(tokens_used), 0)::int as total_tokens,
        COALESCE(SUM(estimated_cost), 0)::numeric as estimated_cost,
        MAX(last_request_at) as last_used
       FROM openai_usage
       WHERE user_id = $1`,
      [session.user.id]
    );

    // Get last 30 days statistics
    const usage30dResult = await query<{
      requests_30d: number;
      tokens_30d: number;
      cost_30d: number;
    }>(
      `SELECT
        COALESCE(SUM(request_count), 0)::int as requests_30d,
        COALESCE(SUM(tokens_used), 0)::int as tokens_30d,
        COALESCE(SUM(estimated_cost), 0)::numeric as cost_30d
       FROM openai_usage
       WHERE user_id = $1 AND last_request_at >= NOW() - INTERVAL '30 days'`,
      [session.user.id]
    );

    const usage = usageResult[0] || {
      total_requests: 0,
      total_tokens: 0,
      estimated_cost: 0,
      last_used: null,
    };

    const usage30d = usage30dResult[0] || {
      requests_30d: 0,
      tokens_30d: 0,
      cost_30d: 0,
    };

    return NextResponse.json({
      has_api_key,
      total_requests: usage.total_requests,
      total_tokens: usage.total_tokens,
      estimated_cost: Number(usage.estimated_cost),
      last_used: usage.last_used,
      requests_30d: usage30d.requests_30d,
      tokens_30d: usage30d.tokens_30d,
      cost_30d: Number(usage30d.cost_30d),
    });
  } catch (error) {
    console.error("Error fetching OpenAI usage:", error);
    return NextResponse.json({ error: "Failed to fetch usage statistics" }, { status: 500 });
  }
}

// Helper function to track OpenAI usage (for internal use)
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
