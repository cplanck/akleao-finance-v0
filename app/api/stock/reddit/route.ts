import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const limit = searchParams.get("limit") || "10";

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    // Fetch Reddit posts for this stock from the backend
    const response = await fetch(
      `${API_URL}/api/admin/reddit-posts?stock=${symbol}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      posts: data.posts || [],
      total: data.total || 0,
    });
  } catch (error) {
    console.error("Error fetching Reddit data:", error);
    return NextResponse.json(
      { error: "Failed to fetch Reddit data", posts: [], total: 0 },
      { status: 500 }
    );
  }
}
