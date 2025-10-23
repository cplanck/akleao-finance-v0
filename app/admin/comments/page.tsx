"use client";

import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentsDataTable } from "@/components/comments-data-table";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface RedditComment {
  id: string;
  post_id: string;
  post_title: string;
  subreddit: string;
  author: string;
  content: string;
  score: number;
  mentioned_stocks: string | string[] | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  created_at: string;
}

interface CommentsResponse {
  comments: RedditComment[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchComments(
  stock?: string
): Promise<CommentsResponse> {
  const params = new URLSearchParams({
    limit: "200",
    offset: "0",
  });
  if (stock) params.append("stock", stock);

  const response = await fetch(`${API_URL}/api/admin/comments?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch comments");
  }
  return response.json();
}

function CommentsPageContent() {
  const searchParams = useSearchParams();
  const initialStock = searchParams.get("stock") || "";

  const [stockFilter, setStockFilter] = useState(initialStock);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-comments", stockFilter],
    queryFn: () => fetchComments(stockFilter),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reddit Comments</h1>
        <div className="text-sm text-muted-foreground">
          {data && `${data.total.toLocaleString()} total comments`}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="w-[250px]">
              <label className="text-sm font-medium mb-2 block">Stock Symbol</label>
              <Input
                placeholder="e.g., AAPL"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          {stockFilter && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setStockFilter("")}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Comments Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.comments ? (
            <CommentsDataTable data={data.comments} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No comments found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CommentsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 pb-20 md:pb-0">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <Suspense fallback={<div>Loading...</div>}>
                  <CommentsPageContent />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
          <MobileNav />
    </SidebarProvider>
  );
}
