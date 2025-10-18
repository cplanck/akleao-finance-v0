import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

// GET /api/admin/reddit-posts/[postId]/comments - Get comments for a specific post
export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { postId } = params;

    const response = await fetch(`${API_URL}/api/admin/reddit-posts/${postId}/comments`);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching post comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch post comments" },
      { status: 500 }
    );
  }
}
