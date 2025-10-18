import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

// GET /api/admin/recent-comments - Get recent comments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "20";

    const response = await fetch(`${API_URL}/api/admin/recent-comments?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching recent comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent comments" },
      { status: 500 }
    );
  }
}
