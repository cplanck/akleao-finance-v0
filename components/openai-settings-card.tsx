"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Brain,
  Key,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface KeyStatus {
  has_api_key: boolean;
  has_admin_key: boolean;
}

interface OpenAIUsage {
  has_api_key: boolean;
  has_admin_key: boolean;
  total_requests: number;
  total_tokens: number;
  estimated_cost: number;
  last_used: string | null;
  requests_30d: number;
  tokens_30d: number;
  cost_30d: number;
  openai_actual_spend: number | null;
  openai_current_month_spend: number | null;
  openai_total_tokens_30d: number | null;
  needs_admin_key?: boolean;
}

async function fetchKeyStatus(): Promise<KeyStatus> {
  const response = await fetch("/api/openai/keys/status");
  if (!response.ok) {
    throw new Error("Failed to fetch key status");
  }
  return response.json();
}

async function fetchOpenAIUsage(): Promise<OpenAIUsage> {
  const response = await fetch("/api/openai/usage");
  if (!response.ok) {
    throw new Error("Failed to fetch OpenAI usage");
  }
  return response.json();
}

export function OpenAISettingsCard() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [isEditingRegular, setIsEditingRegular] = useState(false);
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);

  // Fast query for key status (loads instantly)
  const { data: keyStatus, isLoading: isLoadingKeyStatus } = useQuery({
    queryKey: ["openai-key-status"],
    queryFn: fetchKeyStatus,
    enabled: !!session,
  });

  // Slower query for usage stats (loads OpenAI data)
  const { data: usage, isLoading: isLoadingUsage } = useQuery({
    queryKey: ["openai-usage"],
    queryFn: fetchOpenAIUsage,
    enabled: !!session && !!keyStatus?.has_api_key, // Only fetch if user has keys
    refetchInterval: 60000, // Refetch every minute
  });

  const saveRegularKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await fetch("/api/openai/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, key_type: "regular" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save API key");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openai-key-status"] });
      queryClient.invalidateQueries({ queryKey: ["openai-usage"] });
      setApiKey("");
      setIsEditingRegular(false);
      setShowApiKey(false);
    },
  });

  const saveAdminKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await fetch("/api/openai/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_key: key, key_type: "admin" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save admin API key");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openai-key-status"] });
      queryClient.invalidateQueries({ queryKey: ["openai-usage"] });
      setAdminKey("");
      setIsEditingAdmin(false);
      setShowAdminKey(false);
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/openai/key", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openai-key-status"] });
      queryClient.invalidateQueries({ queryKey: ["openai-usage"] });
      setApiKey("");
      setIsEditingRegular(false);
    },
  });

  const handleSaveRegularKey = () => {
    if (apiKey.trim()) {
      saveRegularKeyMutation.mutate(apiKey.trim());
    }
  };

  const handleSaveAdminKey = () => {
    if (adminKey.trim()) {
      saveAdminKeyMutation.mutate(adminKey.trim());
    }
  };

  const handleDeleteKey = () => {
    if (confirm("Are you sure you want to remove your OpenAI API key?")) {
      deleteKeyMutation.mutate();
    }
  };

  if (!session) {
    return (
      <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            OpenAI Integration
          </CardTitle>
          <CardDescription>Sign in to configure OpenAI settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/sign-in")} variant="outline" className="w-full">
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group">
      {/* Ambient gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              OpenAI Integration
            </CardTitle>
            <CardDescription className="mt-1">
              Configure your OpenAI API key for ML features
            </CardDescription>
          </div>
          {isLoadingKeyStatus ? (
            <Skeleton className="h-6 w-24" />
          ) : keyStatus?.has_api_key ? (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="outline">
              <XCircle className="h-3 w-3 mr-1" />
              Not Configured
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 relative z-10">
        {/* API Keys Management - Compact Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="api-keys" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">API Keys</span>
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingKeyStatus ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <>
                      {keyStatus?.has_api_key && (
                        <Badge variant="outline" className="text-[10px]">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                          Regular
                        </Badge>
                      )}
                      {keyStatus?.has_admin_key && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                          Admin
                        </Badge>
                      )}
                      {!keyStatus?.has_api_key && !keyStatus?.has_admin_key && (
                        <Badge variant="outline" className="text-[10px]">
                          <XCircle className="h-2.5 w-2.5 mr-1" />
                          Not Configured
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              {/* Regular API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Regular API Key</span>
                    <Badge variant="outline" className="text-[10px]">For API Calls</Badge>
                  </div>
                  {!isLoadingKeyStatus && keyStatus?.has_api_key && !isEditingRegular && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingRegular(true)}
                      className="h-7 text-xs"
                    >
                      Update
                    </Button>
                  )}
                </div>

                {isLoadingKeyStatus ? (
                  <Skeleton className="h-9 w-full" />
                ) : (!keyStatus?.has_api_key || isEditingRegular) ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        placeholder="sk-..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="pr-10 h-9 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveRegularKey}
                        disabled={!apiKey.trim() || saveRegularKeyMutation.isPending}
                        className="flex-1 h-8 text-xs"
                      >
                        {saveRegularKeyMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        Save
                      </Button>
                      {isEditingRegular && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingRegular(false);
                            setApiKey("");
                            setShowApiKey(false);
                          }}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                    {saveRegularKeyMutation.isError && (
                      <p className="text-xs text-destructive">
                        {saveRegularKeyMutation.error?.message || "Failed to save API key"}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-2 rounded-md bg-muted/30 border border-primary/5">
                    <p className="text-xs text-muted-foreground">Configured</p>
                  </div>
                )}
              </div>

              {/* Admin API Key */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Admin API Key</span>
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
                      For Usage Stats
                    </Badge>
                  </div>
                  {!isLoadingKeyStatus && keyStatus?.has_admin_key && !isEditingAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingAdmin(true)}
                      className="h-7 text-xs"
                    >
                      Update
                    </Button>
                  )}
                </div>

                {isLoadingKeyStatus ? (
                  <Skeleton className="h-9 w-full" />
                ) : (!keyStatus?.has_admin_key || isEditingAdmin) ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        type={showAdminKey ? "text" : "password"}
                        placeholder="sk-proj-admin-..."
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        className="pr-10 h-9 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminKey(!showAdminKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showAdminKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveAdminKey}
                        disabled={!adminKey.trim() || saveAdminKeyMutation.isPending}
                        className="flex-1 h-8 text-xs"
                      >
                        {saveAdminKeyMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        Save
                      </Button>
                      {isEditingAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingAdmin(false);
                            setAdminKey("");
                            setShowAdminKey(false);
                          }}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                    {saveAdminKeyMutation.isError && (
                      <p className="text-xs text-destructive">
                        {saveAdminKeyMutation.error?.message || "Failed to save admin API key"}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      <a href="https://platform.openai.com/settings/organization/admin-keys" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                        Create admin key
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="p-2 rounded-md bg-muted/30 border border-primary/5">
                    <p className="text-xs text-muted-foreground">Configured</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Usage Stats */}
        {keyStatus?.has_api_key && (
          <>
            {/* Admin Key Notice */}
            {usage?.needs_admin_key && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <Key className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                      Admin API Key Required
                    </p>
                    <p className="text-xs text-muted-foreground">
                      To view real-time usage from OpenAI, you need an <strong>Admin API Key</strong> instead of a regular API key.
                      Create one at <a href="https://platform.openai.com/settings/organization/admin-keys" target="_blank" rel="noopener noreferrer" className="underline text-primary">platform.openai.com/settings/organization/admin-keys</a>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* OpenAI Account Statistics */}
            {(usage?.openai_actual_spend !== null || usage?.openai_current_month_spend !== null || usage?.openai_total_tokens_30d !== null) && (
              <div className="pt-4 border-t border-primary/10">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  OpenAI Account Usage (Last 30 Days)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {usage?.openai_current_month_spend !== null && (
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm border border-primary/10 hover:border-primary/20 transition-all duration-300">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
                        <DollarSign className="h-3 w-3" />
                        Current Month
                      </div>
                      {isLoadingUsage ? (
                        <Skeleton className="h-6 w-16" />
                      ) : (
                        <p className="text-lg font-bold text-primary">
                          ${usage?.openai_current_month_spend?.toFixed(4)}
                        </p>
                      )}
                    </div>
                  )}

                  {usage?.openai_actual_spend !== null && (
                    <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm border border-green-500/10 hover:border-green-500/20 transition-all duration-300">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
                        <DollarSign className="h-3 w-3" />
                        Last 30 Days
                      </div>
                      {isLoadingUsage ? (
                        <Skeleton className="h-6 w-16" />
                      ) : (
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          ${usage?.openai_actual_spend?.toFixed(4)}
                        </p>
                      )}
                    </div>
                  )}

                  {usage?.openai_total_tokens_30d !== null && (
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-500/10 hover:border-blue-500/20 transition-all duration-300">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
                        <Brain className="h-3 w-3" />
                        Total Tokens
                      </div>
                      {isLoadingUsage ? (
                        <Skeleton className="h-6 w-16" />
                      ) : (
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {usage?.openai_total_tokens_30d?.toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Help Text */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Your API key is encrypted and stored securely. It will only be
            used for ML features like stock analysis and predictions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
