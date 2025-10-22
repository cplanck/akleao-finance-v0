import { NextRequest, NextResponse } from "next/server";

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();

    // Forward request to backend API
    const response = await fetch(`${API_GATEWAY_URL}/api/reddit/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error tracking subreddit:", error);
    return NextResponse.json(
      { error: "Failed to track subreddit" },
      { status: 500 }
    );
  }
}
