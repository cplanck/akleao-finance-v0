import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

// GET /api/admin/summary - Get admin summary data
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_URL}/api/admin/summary`);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching admin summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin summary" },
      { status: 500 }
    );
  }
}
