"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Sparkles, TrendingUp } from "lucide-react";

export default function MLModelsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 pb-20 md:pb-0">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">ML Models</h1>
                    <Badge variant="outline" className="text-xs">
                      Coming Soon
                    </Badge>
                  </div>

                  {/* Placeholder Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/5 pointer-events-none" />
                      <CardHeader className="relative z-10">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <CardTitle>Sentiment Analysis</CardTitle>
                            <CardDescription>Reddit comment sentiment</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>Analyzes sentiment of Reddit comments to gauge market sentiment around stocks.</p>
                          <div className="pt-2">
                            <Badge variant="secondary" className="text-xs">Active</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                      <CardHeader className="relative z-10">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <BrainCircuit className="h-5 w-5 text-purple-500" />
                          </div>
                          <div>
                            <CardTitle>Stock Prediction</CardTitle>
                            <CardDescription>Price movement forecasting</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>Predicts short-term stock price movements based on sentiment and historical data.</p>
                          <div className="pt-2">
                            <Badge variant="outline" className="text-xs">In Development</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-500/5 pointer-events-none" />
                      <CardHeader className="relative z-10">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <CardTitle>Trend Detection</CardTitle>
                            <CardDescription>Emerging stock trends</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>Identifies emerging trends in social media discussion before they go mainstream.</p>
                          <div className="pt-2">
                            <Badge variant="outline" className="text-xs">Planned</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Info Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Machine Learning Pipeline</CardTitle>
                      <CardDescription>
                        Automated models for sentiment analysis and trend detection
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-sm text-muted-foreground">
                        <p>
                          This section will contain detailed information about ML models, training metrics,
                          performance analytics, and model management tools.
                        </p>
                        <ul className="list-disc list-inside space-y-2">
                          <li>Real-time sentiment scoring with confidence metrics</li>
                          <li>Historical model performance tracking</li>
                          <li>A/B testing for model improvements</li>
                          <li>Feature importance analysis</li>
                          <li>Model retraining schedules and versioning</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
          <MobileNav />
    </SidebarProvider>
  );
}
