"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Brain, Zap, ExternalLink } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Analysis {
  id: number;
  post_id: string;
  post_title: string;
  subreddit: string;
  stock_symbol: string | null;
  strategy_used: "preprocessed" | "direct";
  comments_included: number;
  executive_summary: string;
  sentiment_breakdown: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  thread_quality_score: number;
  tokens_used: number;
  cost_estimate: number;
  created_at: string;
}

interface AnalysesResponse {
  analyses: Analysis[];
  total: number;
}

async function fetchAnalyses(): Promise<AnalysesResponse> {
  const res = await fetch(`${API_URL}/api/admin/analyses?limit=100`);
  if (!res.ok) throw new Error("Failed to fetch analyses");
  return res.json();
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString + (dateString.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function getSentimentIndicator(sentiment: { bullish: number; bearish: number; neutral: number }) {
  if (sentiment.bullish > sentiment.bearish) {
    return (
      <Badge variant="outline" className="text-green-700 bg-green-500/20 border-green-500/40">
        <TrendingUp className="h-3 w-3 mr-1" />
        {sentiment.bullish}% Bullish
      </Badge>
    );
  } else if (sentiment.bearish > sentiment.bullish) {
    return (
      <Badge variant="outline" className="text-red-700 bg-red-500/20 border-red-500/40">
        <TrendingDown className="h-3 w-3 mr-1" />
        {sentiment.bearish}% Bearish
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className="text-gray-700 bg-gray-500/20 border-gray-500/40">
        {sentiment.neutral}% Neutral
      </Badge>
    );
  }
}

export default function AIAnalysesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-analyses"],
    queryFn: fetchAnalyses,
  });

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 pb-20 md:pb-0">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-3 sm:px-4 lg:px-6 space-y-4 sm:space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Brain className="h-8 w-8" />
                    AI Analyses
                  </h1>
                  {data && (
                    <div className="text-sm text-muted-foreground">
                      {data.total.toLocaleString()} total analyses
                    </div>
                  )}
                </div>

                {/* Content Card */}
                <Card>
                  <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8 text-red-500">
                  Failed to load analyses
                </div>
              ) : data && data.analyses.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stock</TableHead>
                        <TableHead>Post</TableHead>
                        <TableHead>Sentiment</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.analyses.map((analysis) => (
                        <TableRow key={analysis.id}>
                          <TableCell>
                            {analysis.stock_symbol ? (
                              <Badge variant="default" className="font-semibold">
                                ${analysis.stock_symbol}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="space-y-1">
                              <div className="font-medium text-sm truncate">
                                {analysis.post_title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                r/{analysis.subreddit} • {analysis.comments_included} comments
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getSentimentIndicator(analysis.sentiment_breakdown)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {analysis.thread_quality_score}/100
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {analysis.strategy_used === "preprocessed" ? (
                                <>
                                  <Brain className="h-3 w-3 mr-1" />
                                  Preprocessed
                                </>
                              ) : (
                                <>
                                  <Zap className="h-3 w-3 mr-1" />
                                  Direct
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            ${analysis.cost_estimate.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatTimeAgo(analysis.created_at)}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/posts?post=${analysis.post_id}`}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No AI analyses yet</p>
                  <p className="text-sm mt-1">Generate your first analysis from the Posts page</p>
                </div>
              )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
