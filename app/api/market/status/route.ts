import { NextResponse } from "next/server";

const POLYGON_API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;

export async function GET() {
  try {
    // Get market status from Polygon.io
    const response = await fetch(
      `https://api.polygon.io/v1/marketstatus/now?apiKey=${POLYGON_API_KEY}`,
      {
        next: { revalidate: 60 }, // Cache for 1 minute
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch market status");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching market status:", error);
    return NextResponse.json(
      { error: "Failed to fetch market status" },
      { status: 500 }
    );
  }
}
