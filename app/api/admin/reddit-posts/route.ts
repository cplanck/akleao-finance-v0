import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subreddit = searchParams.get("subreddit");
  const stock = searchParams.get("stock");
  const limit = searchParams.get("limit") || "50";
  const offset = searchParams.get("offset") || "0";

  try {
    // For now, we'll query the database directly via a simple SQL query
    // In production, you'd create proper API endpoints in the FastAPI backend
    const query = new URLSearchParams({
      limit,
      offset,
      ...(subreddit && { subreddit }),
      ...(stock && { stock }),
    });

    // Placeholder - we'll implement the actual backend endpoint next
    // For now, return mock data structure
    const response = {
      posts: [],
      total: 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching Reddit posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch Reddit posts" },
      { status: 500 }
    );
  }
}
