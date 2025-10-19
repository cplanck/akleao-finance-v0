"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileText, Loader2, CheckCircle2, AlertCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ResearchReportViewer } from "@/components/research-report-viewer";

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
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [reportId, setReportId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existingReports, setExistingReports] = useState<any[]>([]);

  // Fetch existing reports when symbol changes
  useEffect(() => {
    const fetchExistingReports = async () => {
      try {
        setLoadingExisting(true);
        const response = await fetch(`${API_URL}/api/research/list/${symbol}`);

        if (response.ok) {
          const data = await response.json();
          setExistingReports(data.reports || []);

          // Auto-select the most recent completed report
          const completedReport = data.reports?.find((r: any) => r.status === "completed");
          if (completedReport) {
            setReportId(completedReport.id);
            setShowReport(true);
          } else {
            setReportId(null);
            setShowReport(false);
          }
        }
      } catch (err) {
        console.error("Error fetching existing reports:", err);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchExistingReports();
  }, [symbol]);

  const generateReport = async () => {
    try {
      setIsGenerating(true);
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

      // Connect to SSE stream
      const eventSource = new EventSource(`${API_URL}/api/research/stream/${data.id}`);

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
            eventSource.close();

            if (onReportComplete && update.report_id) {
              onReportComplete(update.report_id);
            }
          } else if (update.type === "error") {
            setError(update.message || "An error occurred");
            setIsGenerating(false);
            eventSource.close();
          }
        } catch (err) {
          console.error("Error parsing SSE message:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
        setError("Connection lost. Please refresh to see report status.");
        setIsGenerating(false);
        eventSource.close();
      };

    } catch (err: any) {
      console.error("Error generating report:", err);
      setError(err.message || "Failed to generate report");
      setIsGenerating(false);
    }
  };

  return (
    <>
    <div className="space-y-4">
        {loadingExisting && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Checking for existing reports...</span>
          </div>
        )}

        {!loadingExisting && !isGenerating && !reportId && (
          <Button onClick={generateReport} className="w-full" size="lg">
            <FileText className="mr-2 h-4 w-4" />
            Generate Research Report for {symbol}
          </Button>
        )}

        {!loadingExisting && !isGenerating && reportId && (
          <Button
            onClick={generateReport}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <FileText className="mr-2 h-3 w-3" />
            Generate New Report
          </Button>
        )}

        {isGenerating && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{status}</span>
              <Badge variant="secondary">{progress}%</Badge>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              This may take 1-2 minutes. AI is researching {symbol} across the web...
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-xs text-destructive/80">{error}</p>
            </div>
          </div>
        )}

        {!loadingExisting && !isGenerating && reportId && !error && existingReports.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/50 bg-primary/10 p-2">
            <CheckCircle2 className="h-3 w-3 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium">
                {existingReports.length} report{existingReports.length > 1 ? 's' : ''} available
              </p>
              <p className="text-[10px] text-muted-foreground">
                Showing most recent report for {symbol}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Report Viewer */}
      {showReport && reportId && (
        <div className="mt-6">
          <ResearchReportViewer reportId={reportId} />
        </div>
      )}
    </>
  );
}
