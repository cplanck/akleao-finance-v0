"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, TrendingUp } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Stock {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  mention_count: number;
}

interface StocksResponse {
  stocks: Stock[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchStocks(offset = 0, limit = 100): Promise<StocksResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${API_URL}/api/admin/stocks?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch stocks");
  }
  return response.json();
}

export default function StocksPage() {
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stocks", offset],
    queryFn: () => fetchStocks(offset, limit),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tracked Stocks</h1>
        <div className="text-sm text-muted-foreground">
          {data && `${data.total.toLocaleString()} total symbols`}
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-16" /> : data?.total}
              </div>
              <div className="text-sm text-muted-foreground">Total Stocks</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  data?.stocks.filter((s) => s.mention_count > 0).length
                )}
              </div>
              <div className="text-sm text-muted-foreground">With Mentions</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  Math.round(
                    (data?.stocks.reduce((sum, s) => sum + s.mention_count, 0) || 0) /
                      (data?.stocks.filter((s) => s.mention_count > 0).length || 1)
                  )
                )}
              </div>
              <div className="text-sm text-muted-foreground">Avg Mentions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stocks Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead className="text-right">Mentions</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(20)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : data && data.stocks.length > 0 ? (
                data.stocks.map((stock) => (
                  <TableRow key={stock.symbol}>
                    <TableCell>
                      <div className="font-mono font-semibold">${stock.symbol}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">{stock.name || "—"}</div>
                    </TableCell>
                    <TableCell>
                      {stock.sector ? (
                        <Badge variant="outline" className="text-xs">
                          {stock.sector}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm text-muted-foreground">
                        {stock.industry || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {stock.mention_count > 0 && (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                        <span className="font-medium">{stock.mention_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {stock.mention_count > 0 && (
                        <Link href={`/admin/posts?stock=${stock.symbol}`}>
                          <Button variant="outline" size="sm">
                            View Posts
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No stocks found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= data.total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
