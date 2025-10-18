import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

// GET /api/admin/comments - Get comments with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "50";
    const offset = searchParams.get("offset") || "0";
    const stock = searchParams.get("stock");
    const sentiment = searchParams.get("sentiment");

    const params = new URLSearchParams({
      limit,
      offset,
    });

    if (stock) params.append("stock", stock);
    if (sentiment) params.append("sentiment", sentiment);

    const response = await fetch(`${API_URL}/api/admin/comments?${params}`);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}
