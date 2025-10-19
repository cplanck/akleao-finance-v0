"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileText, Loader2, CheckCircle2, AlertCircle, Eye, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ResearchReportViewer } from "@/components/research-report-viewer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface ResearchGeneratorProps {
  symbol: string;
  onReportComplete?: (reportId: number) => void;
}

interface StreamUpdate {
  type: string;
  message?: string;
  percentage?: number;
  section?: string;
  content?: string;
  report_id?: number;
}

export function ResearchGenerator({ symbol, onReportComplete }: ResearchGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingSymbol, setGeneratingSymbol] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [reportId, setReportId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existingReports, setExistingReports] = useState<any[]>([]);
  const [eventSourceRef, setEventSourceRef] = useState<EventSource | null>(null);

  // Helper function to connect to SSE stream
  const connectToSSE = (reportId: number) => {
    // Close existing connection if any
    if (eventSourceRef) {
      eventSourceRef.close();
    }

    const eventSource = new EventSource(`${API_URL}/api/research/stream/${reportId}`);
    setEventSourceRef(eventSource);

    eventSource.onmessage = (event) => {
      try {
        const update: StreamUpdate = JSON.parse(event.data);

        if (update.type === "progress") {
          setProgress(update.percentage || 0);
          setStatus(update.message || "Generating...");
        } else if (update.type === "section") {
          setStatus(`Writing ${update.section} section...`);
        } else if (update.type === "complete") {
          setProgress(100);
          setStatus("Report completed!");
          setIsGenerating(false);
          setGeneratingSymbol(null);
          setShowReport(true);
          eventSource.close();
          setEventSourceRef(null);

          // Refresh the reports list
          fetch(`${API_URL}/api/research/list/${symbol}`)
            .then(res => res.json())
            .then(data => setExistingReports(data.reports || []))
            .catch(err => console.error("Error refreshing reports:", err));

          if (onReportComplete && update.report_id) {
            onReportComplete(update.report_id);
          }
        } else if (update.type === "error") {
          setError(update.message || "An error occurred");
          setIsGenerating(false);
          setGeneratingSymbol(null);
          eventSource.close();
          setEventSourceRef(null);
        }
      } catch (err) {
        console.error("Error parsing SSE message:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      setError("Connection lost. Please refresh to see report status.");
      setIsGenerating(false);
      setGeneratingSymbol(null);
      eventSource.close();
      setEventSourceRef(null);
    };
  };

  // Fetch existing reports when symbol changes
  useEffect(() => {
    const fetchExistingReports = async () => {
      try {
        setLoadingExisting(true);
        const response = await fetch(`${API_URL}/api/research/list/${symbol}`);

        if (response.ok) {
          const data = await response.json();
          setExistingReports(data.reports || []);

          // Check if there's a report currently generating for this stock
          const generatingReport = data.reports?.find((r: any) => r.status === "generating" || r.status === "pending");

          if (generatingReport) {
            // This stock has a report being generated
            setIsGenerating(true);
            setGeneratingSymbol(symbol);
            setReportId(generatingReport.id);
            setProgress(generatingReport.progress_percentage || 0);
            setStatus(generatingReport.status === "pending" ? "Queued..." : "Generating...");

            // Connect to SSE stream for this report
            connectToSSE(generatingReport.id);
          } else {
            // No generating report, check for completed reports
            const completedReport = data.reports?.find((r: any) => r.status === "completed");
            if (completedReport) {
              setReportId(completedReport.id);
              setShowReport(true);
            } else {
              setReportId(null);
              setShowReport(false);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching existing reports:", err);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchExistingReports();

    // Reset error when symbol changes
    setError(null);

    // Cleanup SSE connection when symbol changes
    return () => {
      if (eventSourceRef) {
        eventSourceRef.close();
        setEventSourceRef(null);
      }
    };
  }, [symbol]);

  const generateReport = async () => {
    try {
      setIsGenerating(true);
      setGeneratingSymbol(symbol);
      setProgress(0);
      setStatus("Initializing research...");
      setError(null);

      // Call API to generate report (via Next.js API route for auth)
      const response = await fetch(`/api/research/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stock_symbol: symbol,
          report_type: "deep_dive",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate report");
      }

      const data = await response.json();
      setReportId(data.id);
      setStatus("Report queued. Starting generation...");

      // Connect to SSE stream using shared function
      connectToSSE(data.id);

    } catch (err: any) {
      console.error("Error generating report:", err);
      setError(err.message || "Failed to generate report");
      setIsGenerating(false);
      setGeneratingSymbol(null);
    }
  };

  const selectReport = (id: number) => {
    setReportId(id);
    setShowReport(true);
  };

  const completedReports = existingReports.filter((r: any) => r.status === "completed");
  const hasGeneratingReport = existingReports.some((r: any) => r.status === "generating" || r.status === "pending");

  // Only show generating UI if we're generating for THIS symbol
  const showGeneratingUI = isGenerating && generatingSymbol === symbol;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="space-y-2 shrink-0">
        {loadingExisting && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Checking for existing reports...</span>
          </div>
        )}

        {!loadingExisting && !showGeneratingUI && !reportId && (
          <Button onClick={generateReport} className="w-full" size="sm">
            <FileText className="mr-2 h-3 w-3" />
            Generate Research Report for {symbol}
          </Button>
        )}

        {!loadingExisting && !showGeneratingUI && !hasGeneratingReport && reportId && (
          <div className="flex items-center gap-2">
            <Button
              onClick={generateReport}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <FileText className="mr-2 h-3 w-3" />
              Generate New Report
            </Button>

            {completedReports.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="mr-1 h-3 w-3" />
                    {completedReports.length}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {completedReports.map((report: any) => (
                    <DropdownMenuItem
                      key={report.id}
                      onClick={() => selectReport(report.id)}
                      className="text-xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {report.id === reportId && "✓ "}
                          Report from {new Date(report.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(report.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {showGeneratingUI && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{status}</span>
              <Badge variant="secondary" className="text-[10px] h-4">{progress}%</Badge>
            </div>
            <Progress value={progress} className="h-1.5" />
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              This may take 1-2 minutes. AI is researching {symbol} across the web...
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2">
            <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-destructive">Error</p>
              <p className="text-[10px] text-destructive/80">{error}</p>
            </div>
          </div>
        )}

        {!loadingExisting && !showGeneratingUI && reportId && !error && completedReports.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/50 bg-primary/10 p-1.5">
            <CheckCircle2 className="h-3 w-3 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[10px] font-medium">
                {completedReports.length} report{completedReports.length > 1 ? 's' : ''} available
              </p>
              <p className="text-[9px] text-muted-foreground">
                Showing {completedReports.length > 1 ? 'selected' : 'most recent'} report for {symbol}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Report Viewer - Takes remaining height with scroll */}
      {showReport && reportId && (
        <div className="flex-1 overflow-hidden mt-3">
          <ResearchReportViewer reportId={reportId} />
        </div>
      )}
    </div>
  );
}
