import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

// GET /api/admin/scraper-runs - Get recent scraper runs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "10";

    const response = await fetch(`${API_URL}/api/admin/scraper-runs?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching scraper runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch scraper runs" },
      { status: 500 }
    );
  }
}
