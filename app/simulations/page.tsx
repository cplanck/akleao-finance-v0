"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, TrendingUp, TrendingDown, X, XCircle, DoorOpen, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";
import { PositionPerformanceChart } from "@/components/position-performance-chart";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Position {
  id: number;
  stock_symbol: string;
  shares: number;
  entry_price: number;
  entry_date: string;
  exit_date: string | null;
  exit_price: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface PerformanceData {
  date: string;
  stock_value: number;
  spy_value: number;
  stock_return_pct: number;
  spy_return_pct: number;
  alpha: number;
}

async function fetchPositions(activeOnly: boolean = false): Promise<Position[]> {
  const params = activeOnly ? "?active_only=true" : "";
  const res = await fetch(`${API_URL}/api/positions${params}`);
  if (!res.ok) throw new Error("Failed to fetch positions");
  return res.json();
}

async function fetchPerformance(positionId: number): Promise<PerformanceData[]> {
  const res = await fetch(`${API_URL}/api/positions/${positionId}/performance`);
  if (!res.ok) throw new Error("Failed to fetch performance");
  return res.json();
}

async function createPosition(data: any): Promise<Position> {
  const res = await fetch(`${API_URL}/api/positions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create position");
  return res.json();
}

async function closePosition(positionId: number, exitPrice: number, exitDate: string): Promise<Position> {
  const res = await fetch(`${API_URL}/api/positions/${positionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exit_price: exitPrice,
      exit_date: exitDate,
      is_active: false,
    }),
  });
  if (!res.ok) throw new Error("Failed to close position");
  return res.json();
}

async function deletePosition(positionId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/positions/${positionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete position");
}

export default function SimulationsPage() {
  const [showNewPositionDialog, setShowNewPositionDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "closed">("active");

  const queryClient = useQueryClient();

  const { data: positions, isLoading } = useQuery({
    queryKey: ["positions", activeFilter],
    queryFn: () => fetchPositions(activeFilter === "active"),
  });

  const filteredPositions = positions?.filter((p) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return p.is_active;
    return !p.is_active;
  });

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-1.5">
            <div className="flex flex-col gap-2 py-2 md:gap-3 md:py-3">
              <div className="px-3 lg:px-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Position Simulations</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Track hypothetical positions and compare performance vs SPY
                    </p>
                  </div>
                  <Button onClick={() => setShowNewPositionDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Position
                  </Button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2">
                  <Button
                    variant={activeFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={activeFilter === "active" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter("active")}
                  >
                    Active
                  </Button>
                  <Button
                    variant={activeFilter === "closed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter("closed")}
                  >
                    Closed
                  </Button>
                </div>

                {/* Positions Grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-48 w-full" />
                    ))}
                  </div>
                ) : filteredPositions && filteredPositions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPositions.map((position) => (
                      <PositionCard
                        key={position.id}
                        position={position}
                        onClick={() => setSelectedPosition(position)}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="p-12">
                    <div className="text-center text-muted-foreground">
                      <p className="text-lg font-medium">No positions found</p>
                      <p className="text-sm mt-2">Create your first position to get started</p>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* New Position Dialog */}
      <NewPositionDialog
        open={showNewPositionDialog}
        onClose={() => setShowNewPositionDialog(false)}
        onSuccess={() => {
          setShowNewPositionDialog(false);
          queryClient.invalidateQueries({ queryKey: ["positions"] });
        }}
      />

      {/* Position Details Dialog */}
      {selectedPosition && (
        <PositionDetailsDialog
          position={selectedPosition}
          onClose={() => setSelectedPosition(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["positions"] });
          }}
        />
      )}
    </SidebarProvider>
  );
}

function PositionCard({ position, onClick }: { position: Position; onClick: () => void }) {
  const initialValue = position.shares * position.entry_price;
  const entryDate = new Date(position.entry_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  // Fetch current stock price to calculate gain/loss
  const { data: quote } = useQuery({
    queryKey: ["stock-quote", position.stock_symbol],
    queryFn: async () => {
      const res = await fetch(`/api/stock/quote?symbol=${position.stock_symbol}`);
      if (!res.ok) throw new Error("Failed to fetch stock data");
      return res.json();
    },
    staleTime: 60000, // Cache for 1 minute
    enabled: position.is_active, // Only fetch for active positions
  });

  const currentPrice = position.is_active
    ? quote?.price
    : position.exit_price;

  const currentValue = currentPrice ? position.shares * currentPrice : initialValue;
  const totalGain = currentValue - initialValue;
  const totalGainPct = (totalGain / initialValue) * 100;

  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all duration-300"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <Link href={`/research?symbol=${position.stock_symbol}`} onClick={(e) => e.stopPropagation()}>
              <CardTitle className="text-lg hover:text-primary transition-colors">
                ${position.stock_symbol}
              </CardTitle>
            </Link>
            <p className="text-xs text-muted-foreground mt-1">
              {position.shares} shares @ ${position.entry_price.toFixed(2)}
            </p>
          </div>
          <Badge variant={position.is_active ? "default" : "secondary"} className="text-xs">
            {position.is_active ? "Active" : "Closed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Gain/Loss:</span>
            <div className="flex items-center gap-1">
              <span className={`font-mono font-semibold ${totalGain >= 0 ? "text-green-500" : "text-red-500"}`}>
                {totalGain >= 0 ? "+" : ""}${totalGain.toFixed(2)}
              </span>
              {currentPrice && (
                <span className={`font-mono text-[10px] ${totalGainPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                  ({totalGainPct >= 0 ? "+" : ""}{totalGainPct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Opened:</span>
            <span className="font-mono">{entryDate}</span>
          </div>
          {!position.is_active && position.exit_date && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Closed:</span>
              <span className="font-mono">
                {new Date(position.exit_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
              </span>
            </div>
          )}
        </div>
        {position.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {position.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NewPositionDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    stock_symbol: "",
    shares: "",
    entry_price: "",
    entry_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      stock_symbol: formData.stock_symbol.toUpperCase(),
      shares: parseFloat(formData.shares),
      entry_price: parseFloat(formData.entry_price),
      entry_date: `${formData.entry_date}T12:00:00`,
      notes: formData.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Position</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="stock_symbol">Stock Symbol</Label>
            <Input
              id="stock_symbol"
              value={formData.stock_symbol}
              onChange={(e) => setFormData({ ...formData, stock_symbol: e.target.value.toUpperCase() })}
              placeholder="AAPL"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shares">Shares</Label>
              <Input
                id="shares"
                type="number"
                step="0.01"
                value={formData.shares}
                onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                placeholder="100"
                required
              />
            </div>
            <div>
              <Label htmlFor="entry_price">Entry Price</Label>
              <Input
                id="entry_price"
                type="number"
                step="0.01"
                value={formData.entry_price}
                onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                placeholder="150.00"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="entry_date">Entry Date</Label>
            <Input
              id="entry_date"
              type="date"
              value={formData.entry_date}
              onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Reason for opening this position..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Position"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PositionDetailsDialog({
  position,
  onClose,
  onUpdate,
}: {
  position: Position;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [closeFormData, setCloseFormData] = useState({
    exit_price: "",
    exit_date: new Date().toISOString().split("T")[0],
  });

  const queryClient = useQueryClient();
  const initialValue = position.shares * position.entry_price;
  const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // Fetch current stock price
  const { data: currentQuote } = useQuery({
    queryKey: ["stock-quote", position.stock_symbol],
    queryFn: async () => {
      const res = await fetch(`/api/stock/quote?symbol=${position.stock_symbol}`);
      if (!res.ok) throw new Error("Failed to fetch stock data");
      return res.json();
    },
    staleTime: 5000,
    enabled: position.is_active,
  });

  // Close position mutation
  const closeMutation = useMutation({
    mutationFn: () => closePosition(
      position.id,
      parseFloat(closeFormData.exit_price),
      `${closeFormData.exit_date}T16:00:00` // Market close time
    ),
    onSuccess: () => {
      toast.success("Position Closed", {
        description: `${position.stock_symbol} position successfully closed`,
      });
      setShowCloseDialog(false);
      onUpdate();
      onClose();
    },
    onError: (error: Error) => {
      toast.error("Failed to Close Position", {
        description: error.message,
      });
    },
  });

  // Delete position mutation
  const deleteMutation = useMutation({
    mutationFn: () => deletePosition(position.id),
    onSuccess: () => {
      toast.success("Position Deleted", {
        description: `${position.stock_symbol} position permanently deleted`,
      });
      setShowDeleteDialog(false);
      onUpdate();
      onClose();
    },
    onError: (error: Error) => {
      toast.error("Failed to Delete Position", {
        description: error.message,
      });
    },
  });

  // Calculate actual gains
  const currentStockValue = latestData?.stockValue || initialValue;
  const currentSpyValue = latestData?.spyValue || initialValue;
  const stockGain = currentStockValue - initialValue;
  const spyGain = currentSpyValue - initialValue;
  const positionGainVsIndex = stockGain - spyGain;

  // Calculate narrative comparison
  const getNarrativeComparison = () => {
    if (!latestData) return null;

    const gainDifference = stockGain - spyGain;
    const isOutperforming = gainDifference > 0;
    const verb = isOutperforming ? "gained" : "lost";
    const comparisonVerb = isOutperforming ? "more than" : "less than";

    return {
      isOutperforming,
      verb,
      comparisonVerb,
      difference: Math.abs(gainDifference),
      percentDifference: latestData.alpha,
    };
  };

  const narrative = getNarrativeComparison();

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">${position.stock_symbol} Position</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant={position.is_active ? "default" : "secondary"}>
                  {position.is_active ? "Active" : "Closed"}
                </Badge>
                {position.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCloseDialog(true)}
                    className="text-xs"
                  >
                    <DoorOpen className="h-3 w-3 mr-1.5" />
                    Close Position
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          </DialogHeader>

        <div className="space-y-6">
          {/* Current Price Display */}
          {position.is_active && currentQuote && (
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground font-semibold mb-1">Current Stock Price</div>
                    <div className="text-3xl font-bold font-mono">${currentQuote.price.toFixed(2)}</div>
                    <div className={`text-sm font-mono mt-1 ${currentQuote.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {currentQuote.change >= 0 ? "+" : ""}{currentQuote.change.toFixed(2)} ({currentQuote.changePercent >= 0 ? "+" : ""}{currentQuote.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                  {currentQuote.marketSession && currentQuote.marketSession !== "regular" && (
                    <Badge variant="secondary" className="text-xs">
                      {currentQuote.marketSession === "post" ? "After Hours" : "Pre-Market"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Natural Language Performance Summary */}
          {narrative && (
            <Card className={`border ${narrative.isOutperforming ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
              <CardContent className="pt-4">
                <p className="text-sm text-foreground leading-relaxed">
                  This position has <span className="font-semibold">{narrative.verb} ${narrative.difference.toFixed(2)}</span> ({narrative.isOutperforming ? "+" : ""}{narrative.percentDifference.toFixed(2)}%)&nbsp;
                  <span className="font-semibold">{narrative.comparisonVerb}</span> an equivalent investment in <span className="font-semibold">SPY</span>.
                  {narrative.isOutperforming ? (
                    <> 🎯 Your position is <span className="font-semibold text-green-600 dark:text-green-400">outperforming</span> the market!</>
                  ) : (
                    <> The market is currently <span className="font-semibold text-red-600 dark:text-red-400">outperforming</span> this position.</>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Performance Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Initial Investment</div>
                <div className="text-xl font-bold font-mono">${initialValue.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Current Value</div>
                <div className="text-xl font-bold font-mono">${currentStockValue.toLocaleString()}</div>
                {latestData && (
                  <div className={`text-xs font-mono ${latestData.stockReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {latestData.stockReturn >= 0 ? "+" : ""}{latestData.stockReturn.toFixed(2)}%
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">If In SPY</div>
                <div className="text-xl font-bold font-mono">${currentSpyValue.toLocaleString()}</div>
                {latestData && (
                  <div className={`text-xs font-mono ${latestData.spyReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {latestData.spyReturn >= 0 ? "+" : ""}{latestData.spyReturn.toFixed(2)}%
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Gain vs Index</div>
                <div className={`text-xl font-bold font-mono ${positionGainVsIndex >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {positionGainVsIndex >= 0 ? "+" : ""}${positionGainVsIndex.toLocaleString()}
                </div>
                {latestData && (
                  <div className={`text-xs font-mono ${latestData.alpha >= 0 ? "text-green-500" : "text-red-500"}`}>
                    Alpha: {latestData.alpha >= 0 ? "+" : ""}{latestData.alpha.toFixed(2)}%
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <PositionPerformanceChart position={position} onDataUpdate={setChartData} />

          {/* Position Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Position Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares:</span>
                <span className="font-mono">{position.shares}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry Price:</span>
                <span className="font-mono">${position.entry_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry Date:</span>
                <span className="font-mono">{new Date(position.entry_date).toLocaleDateString()}</span>
              </div>
              {!position.is_active && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exit Price:</span>
                    <span className="font-mono">${position.exit_price?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exit Date:</span>
                    <span className="font-mono">{position.exit_date ? new Date(position.exit_date).toLocaleDateString() : "N/A"}</span>
                  </div>
                </>
              )}
              {position.notes && (
                <div className="pt-2">
                  <span className="text-muted-foreground block mb-1">Notes:</span>
                  <p className="text-foreground leading-relaxed">{position.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>

    {/* Close Position Confirmation Dialog */}
    <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close Position</DialogTitle>
          <DialogDescription>
            Enter the exit price and date to close this position. The position will be kept in your history.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            closeMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="exit_price">Exit Price</Label>
            <Input
              id="exit_price"
              type="number"
              step="0.01"
              value={closeFormData.exit_price}
              onChange={(e) => setCloseFormData({ ...closeFormData, exit_price: e.target.value })}
              placeholder={currentQuote?.price.toFixed(2) || position.entry_price.toFixed(2)}
              required
            />
            {currentQuote && (
              <p className="text-xs text-muted-foreground mt-1">
                Current price: ${currentQuote.price.toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="exit_date">Exit Date</Label>
            <Input
              id="exit_date"
              type="date"
              value={closeFormData.exit_date}
              onChange={(e) => setCloseFormData({ ...closeFormData, exit_date: e.target.value })}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={closeMutation.isPending}>
              {closeMutation.isPending ? "Closing..." : "Close Position"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Delete Position Confirmation Dialog */}
    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Position</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete this position? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold">{position.stock_symbol}</p>
          <p className="text-xs text-muted-foreground">
            {position.shares} shares @ ${position.entry_price.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            Opened: {new Date(position.entry_date).toLocaleDateString()}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
