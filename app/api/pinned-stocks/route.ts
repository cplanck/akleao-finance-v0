import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { query } from "@/lib/db";

// GET /api/pinned-stocks - Get user's pinned stocks
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pinnedStocks = await query<{ symbol: string; position: number; pinned_at: Date }>(
      "SELECT symbol, position, pinned_at FROM pinned_stocks WHERE user_id = $1 ORDER BY position ASC",
      [session.user.id]
    );

    return NextResponse.json({ pinnedStocks });
  } catch (error) {
    console.error("Error fetching pinned stocks:", error);
    return NextResponse.json(
      { error: "Failed to fetch pinned stocks" },
      { status: 500 }
    );
  }
}

// POST /api/pinned-stocks - Pin a stock
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { symbol } = await request.json();

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    // Get the current max position
    const maxPositionResult = await query<{ max_position: number }>(
      "SELECT COALESCE(MAX(position), -1) as max_position FROM pinned_stocks WHERE user_id = $1",
      [session.user.id]
    );

    const nextPosition = (maxPositionResult[0]?.max_position ?? -1) + 1;

    // Insert the pinned stock
    await query(
      "INSERT INTO pinned_stocks (user_id, symbol, position) VALUES ($1, $2, $3) ON CONFLICT (user_id, symbol) DO NOTHING",
      [session.user.id, symbol.toUpperCase(), nextPosition]
    );

    return NextResponse.json({ success: true, symbol: symbol.toUpperCase() });
  } catch (error) {
    console.error("Error pinning stock:", error);
    return NextResponse.json({ error: "Failed to pin stock" }, { status: 500 });
  }
}

// DELETE /api/pinned-stocks - Unpin a stock
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    // Delete the pinned stock
    await query(
      "DELETE FROM pinned_stocks WHERE user_id = $1 AND symbol = $2",
      [session.user.id, symbol.toUpperCase()]
    );

    // Reorder remaining pins
    await query(
      `UPDATE pinned_stocks
       SET position = subquery.new_position
       FROM (
         SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 as new_position
         FROM pinned_stocks
         WHERE user_id = $1
       ) AS subquery
       WHERE pinned_stocks.id = subquery.id`,
      [session.user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unpinning stock:", error);
    return NextResponse.json({ error: "Failed to unpin stock" }, { status: 500 });
  }
}
