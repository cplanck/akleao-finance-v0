import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { query } from "@/lib/db";
import OpenAI from "openai";

// GET /api/openai/usage - Get OpenAI usage statistics
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

    // Get usage statistics from local DB
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

    // Get last 30 days statistics from local DB
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

    // Fetch real usage from OpenAI API if we have an admin key
    let openai_actual_spend = null;
    let openai_current_month_spend = null;
    let openai_total_tokens_30d = null;

    // Use user's admin key if available, otherwise fall back to env OPENAI_API_KEY
    const { getDecryptedApiKey } = await import("../key/route");
    const userAdminKey = await getDecryptedApiKey(session.user.id, 'admin');
    const adminKeyToUse = userAdminKey || process.env.OPENAI_API_KEY;

    if (adminKeyToUse) {
      try {
        // Get current date info for filtering
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Convert to Unix timestamp (seconds)
        const startTimeMonth = Math.floor(firstDayOfMonth.getTime() / 1000);
        const startTime30d = Math.floor(thirtyDaysAgo.getTime() / 1000);
        const endTime = Math.floor(now.getTime() / 1000);

        // Fetch all three endpoints in parallel for better performance
        const [monthCostsResponse, allTimeCostsResponse, usageResponse] = await Promise.all([
          // Fetch costs for current month
          fetch(
            `https://api.openai.com/v1/organization/costs?start_time=${startTimeMonth}&end_time=${endTime}&bucket_width=1d`,
            {
              headers: {
                Authorization: `Bearer ${adminKeyToUse}`,
                "Content-Type": "application/json",
              },
            }
          ),
          // Fetch costs for last 30 days
          fetch(
            `https://api.openai.com/v1/organization/costs?start_time=${startTime30d}&end_time=${endTime}&bucket_width=1d`,
            {
              headers: {
                Authorization: `Bearer ${adminKeyToUse}`,
                "Content-Type": "application/json",
              },
            }
          ),
          // Fetch token usage for last 30 days
          fetch(
            `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime30d}&end_time=${endTime}&bucket_width=1d`,
            {
              headers: {
                Authorization: `Bearer ${adminKeyToUse}`,
                "Content-Type": "application/json",
              },
            }
          )
        ]);

        // Process current month costs
        if (monthCostsResponse.ok) {
          const costsData = await monthCostsResponse.json();
          console.log("OpenAI Costs Response:", JSON.stringify(costsData, null, 2));

          // Sum up all the costs from the data buckets
          if (costsData.data && Array.isArray(costsData.data)) {
            let monthTotal = 0;
            costsData.data.forEach((bucket: any) => {
              if (bucket.results && Array.isArray(bucket.results)) {
                bucket.results.forEach((result: any) => {
                  if (result.amount && result.amount.value) {
                    monthTotal += parseFloat(result.amount.value);
                  }
                });
              }
            });
            openai_current_month_spend = monthTotal;
          }
        } else {
          const errorText = await monthCostsResponse.text();
          console.error("OpenAI Costs API error:", monthCostsResponse.status, errorText);
        }

        // Process 30-day costs
        if (allTimeCostsResponse.ok) {
          const costsData = await allTimeCostsResponse.json();

          // Sum up all the costs
          if (costsData.data && Array.isArray(costsData.data)) {
            let total = 0;
            costsData.data.forEach((bucket: any) => {
              if (bucket.results && Array.isArray(bucket.results)) {
                bucket.results.forEach((result: any) => {
                  if (result.amount && result.amount.value) {
                    total += parseFloat(result.amount.value);
                  }
                });
              }
            });
            openai_actual_spend = total;
          }
        }

        // Process token usage
        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          console.log("OpenAI Usage Response:", JSON.stringify(usageData, null, 2));

          // Sum up tokens
          if (usageData.data && Array.isArray(usageData.data)) {
            let totalTokens = 0;
            usageData.data.forEach((bucket: any) => {
              if (bucket.results && Array.isArray(bucket.results)) {
                bucket.results.forEach((result: any) => {
                  // Add both input and output tokens
                  if (result.input_tokens) totalTokens += result.input_tokens;
                  if (result.output_tokens) totalTokens += result.output_tokens;
                });
              }
            });
            openai_total_tokens_30d = totalTokens;
          }
        }
      } catch (openaiError) {
        console.error("Error fetching OpenAI usage:", openaiError);
        // Continue with local DB data if OpenAI API fails
      }
    }

    return NextResponse.json({
      has_api_key,
      has_admin_key,
      total_requests: usage.total_requests,
      total_tokens: usage.total_tokens,
      estimated_cost: Number(usage.estimated_cost),
      last_used: usage.last_used,
      requests_30d: usage30d.requests_30d,
      tokens_30d: usage30d.tokens_30d,
      cost_30d: Number(usage30d.cost_30d),
      // Add OpenAI actual data
      openai_actual_spend,
      openai_current_month_spend,
      openai_total_tokens_30d,
      // Indicate if we need admin key
      needs_admin_key: !has_admin_key && (!openai_current_month_spend && !openai_actual_spend),
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
