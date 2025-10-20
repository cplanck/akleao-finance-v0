import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { postId } = await params;

    // Verify user is authenticated
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const strategy = searchParams.get("strategy") || "direct";

    // Forward request to backend API with user_id
    const response = await fetch(
      `${API_GATEWAY_URL}/api/admin/reddit-posts/${postId}/analyze?strategy=${strategy}&user_id=${session.user.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating post analysis:", error);
    return NextResponse.json(
      { error: "Failed to generate post analysis" },
      { status: 500 }
    );
  }
}
