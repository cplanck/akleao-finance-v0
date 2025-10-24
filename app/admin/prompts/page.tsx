"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2, Play, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface AIPrompt {
  id: number;
  prompt_type: string;
  version: number;
  name: string | null;
  description: string | null;
  is_active: boolean;
  system_prompt: string;
  user_prompt_template: string;
  model: string;
  temperature: number;
  max_tokens: number | null;
  avg_cost_per_call: number | null;
  total_calls: number;
  total_cost: number;
  avg_tokens_used: number | null;
  success_rate: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  notes: string | null;
}

interface PromptFormData {
  prompt_type: string;
  version: number;
  name: string;
  description: string;
  system_prompt: string;
  user_prompt_template: string;
  model: string;
  temperature: number;
  max_tokens: number | null;
  notes: string;
}

export default function PromptsAdminPage() {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [selectedPromptType, setSelectedPromptType] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [selectedPostId, setSelectedPostId] = useState<string>("random");
  const [selectedCommentId, setSelectedCommentId] = useState<string>("random");

  useEffect(() => {
    setMounted(true);
  }, []);

  const [formData, setFormData] = useState<PromptFormData>({
    prompt_type: "comment_scoring",
    version: 1,
    name: "",
    description: "",
    system_prompt: "",
    user_prompt_template: "",
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: null,
    notes: "",
  });

  // Fetch all prompts
  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts", selectedPromptType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPromptType) params.append("prompt_type", selectedPromptType);
      const response = await fetch(`${API_URL}/api/admin/prompts/?${params}`);
      if (!response.ok) throw new Error("Failed to fetch prompts");
      return response.json() as Promise<AIPrompt[]>;
    },
  });

  // Fetch recent posts for testing
  const { data: recentPosts } = useQuery({
    queryKey: ["recent-posts"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/admin/reddit-posts/?limit=50&offset=0&sort_by=heat`);
      if (!response.ok) throw new Error("Failed to fetch posts");
      const data = await response.json();
      return data.posts as any[];
    },
  });

  // Fetch comments for selected post
  const { data: postComments } = useQuery({
    queryKey: ["post-comments", selectedPostId],
    queryFn: async () => {
      if (!selectedPostId || selectedPostId === "random") return [];
      const response = await fetch(`${API_URL}/api/admin/comments/?post_id=${selectedPostId}&limit=100`);
      if (!response.ok) throw new Error("Failed to fetch comments");
      const data = await response.json();
      return data.comments as any[];
    },
    enabled: !!selectedPostId && selectedPostId !== "random",
  });

  // Create prompt mutation
  const createPromptMutation = useMutation({
    mutationFn: async (data: PromptFormData) => {
      const response = await fetch(`${API_URL}/api/admin/prompts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create prompt");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
  });

  // Activate prompt mutation
  const activatePromptMutation = useMutation({
    mutationFn: async (promptId: number) => {
      const response = await fetch(`${API_URL}/api/admin/prompts/${promptId}/activate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to activate prompt");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  // Delete prompt mutation
  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: number) => {
      const response = await fetch(`${API_URL}/api/admin/prompts/${promptId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete prompt");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  // Test prompt mutation
  const testPromptMutation = useMutation({
    mutationFn: async (data: { system_prompt: string; user_prompt_template: string; model: string; temperature: number; sample_post_id?: string; sample_comment_id?: string }) => {
      const response = await fetch(`${API_URL}/api/admin/prompts/test/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to test prompt");
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
    },
  });

  const resetForm = () => {
    setFormData({
      prompt_type: "comment_scoring",
      version: 1,
      name: "",
      description: "",
      system_prompt: "",
      user_prompt_template: "",
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: null,
      notes: "",
    });
    setEditingPrompt(null);
  };

  const handleCreatePrompt = () => {
    createPromptMutation.mutate(formData);
  };

  const handleTestPrompt = () => {
    testPromptMutation.mutate({
      system_prompt: formData.system_prompt,
      user_prompt_template: formData.user_prompt_template,
      model: formData.model,
      temperature: formData.temperature,
    });
  };

  const promptTypeLabels: Record<string, string> = {
    comment_scoring: "Comment Scoring",
    post_analysis: "Post Analysis",
    cross_post_synthesis: "Cross-Post Synthesis",
  };

  if (!mounted) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 pb-20 md:pb-0">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-3 sm:px-4 lg:px-6 space-y-4 sm:space-y-6">
                <div>
                  <h1 className="text-3xl font-bold">Prompt Lab</h1>
                  <p className="text-muted-foreground">Manage and test AI prompts for sentiment analysis</p>
                </div>

              <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all" onClick={() => setSelectedPromptType(null)}>
            All Prompts
          </TabsTrigger>
          <TabsTrigger value="comment_scoring" onClick={() => setSelectedPromptType("comment_scoring")}>
            Comment Scoring
          </TabsTrigger>
          <TabsTrigger value="post_analysis" onClick={() => setSelectedPromptType("post_analysis")}>
            Post Analysis
          </TabsTrigger>
          <TabsTrigger value="cross_post_synthesis" onClick={() => setSelectedPromptType("cross_post_synthesis")}>
            Cross-Post Synthesis
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedPromptType || "all"} className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {prompts?.length || 0} prompt(s)
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Prompt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Prompt</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Prompt Type</Label>
                      <Select
                        value={formData.prompt_type}
                        onValueChange={(value) => setFormData({ ...formData, prompt_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comment_scoring">Comment Scoring</SelectItem>
                          <SelectItem value="post_analysis">Post Analysis</SelectItem>
                          <SelectItem value="cross_post_synthesis">Cross-Post Synthesis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Version</Label>
                      <Input
                        type="number"
                        value={formData.version}
                        onChange={(e) => setFormData({ ...formData, version: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Conservative Scoring v2"
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="What makes this prompt different?"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>System Prompt</Label>
                    <Textarea
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      placeholder="You are an expert at..."
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label>User Prompt Template (Jinja2)</Label>
                    <Textarea
                      value={formData.user_prompt_template}
                      onChange={(e) => setFormData({ ...formData, user_prompt_template: e.target.value })}
                      placeholder="Post: {{ post.title }}\nComment: {{ comment.content }}"
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Model</Label>
                      <Select
                        value={formData.model}
                        onValueChange={(value) => setFormData({ ...formData, model: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Temperature</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Max Tokens (optional)</Label>
                      <Input
                        type="number"
                        value={formData.max_tokens || ""}
                        onChange={(e) => setFormData({ ...formData, max_tokens: e.target.value ? parseInt(e.target.value) : null })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Internal notes about this prompt"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleTestPrompt} variant="outline" disabled={testPromptMutation.isPending}>
                      {testPromptMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Test Prompt
                        </>
                      )}
                    </Button>
                    <Button onClick={handleCreatePrompt} disabled={createPromptMutation.isPending}>
                      {createPromptMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Prompt"
                      )}
                    </Button>
                  </div>

                  {testResult && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Test Result</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <div className="text-xs font-semibold">Rendered Prompt:</div>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">{testResult.rendered_prompt}</pre>
                        </div>
                        <div>
                          <div className="text-xs font-semibold">AI Response:</div>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(testResult.ai_response, null, 2)}</pre>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <div>Tokens: {testResult.tokens_used}</div>
                          <div>Cost: ${testResult.cost_estimate.toFixed(6)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4">
              {prompts?.map((prompt) => (
                <Card key={prompt.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {prompt.name || `${promptTypeLabels[prompt.prompt_type]} v${prompt.version}`}
                          </CardTitle>
                          {prompt.is_active && (
                            <Badge variant="default" className="bg-green-500">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          <Badge variant="outline">{prompt.model}</Badge>
                        </div>
                        {prompt.description && (
                          <CardDescription>{prompt.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!prompt.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activatePromptMutation.mutate(prompt.id)}
                            disabled={activatePromptMutation.isPending}
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePromptMutation.mutate(prompt.id)}
                          disabled={prompt.is_active || deletePromptMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Total Calls</div>
                        <div className="font-semibold">{prompt.total_calls.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Cost</div>
                        <div className="font-semibold">${prompt.total_cost.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Cost</div>
                        <div className="font-semibold">
                          {prompt.avg_cost_per_call ? `$${prompt.avg_cost_per_call.toFixed(6)}` : "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Tokens</div>
                        <div className="font-semibold">{prompt.avg_tokens_used || "-"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Success Rate</div>
                        <div className="font-semibold">
                          {prompt.success_rate ? `${prompt.success_rate.toFixed(1)}%` : "-"}
                        </div>
                      </div>
                    </div>

                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold">View Prompts & Test</summary>
                      <Tabs defaultValue="prompts" className="mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="prompts">Prompts</TabsTrigger>
                          <TabsTrigger value="test">Test</TabsTrigger>
                        </TabsList>

                        <TabsContent value="prompts" className="space-y-4 mt-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-2">System Prompt</div>
                              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap border">
                                {prompt.system_prompt}
                              </pre>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-2">User Prompt Template</div>
                              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap border">
                                {prompt.user_prompt_template}
                              </pre>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="test" className="space-y-4 mt-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Test Post (optional)</Label>
                                <Select value={selectedPostId} onValueChange={setSelectedPostId}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Random post" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="random">Random post</SelectItem>
                                    {recentPosts?.map((post: any) => (
                                      <SelectItem key={post.id} value={post.id}>
                                        {post.primary_stock} - {post.title.slice(0, 40)}...
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Test Comment (optional)</Label>
                                <Select value={selectedCommentId} onValueChange={setSelectedCommentId} disabled={selectedPostId === "random"}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder={selectedPostId !== "random" ? "Random comment" : "Select post first"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="random">Random comment</SelectItem>
                                    {postComments?.map((comment: any) => (
                                      <SelectItem key={comment.id} value={comment.id}>
                                        {comment.author}: {comment.content.slice(0, 50)}...
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {selectedPostId !== "random" && (
                              <details className="border rounded-md">
                                <summary className="cursor-pointer font-semibold text-xs p-3 bg-muted/50">View Selected Post</summary>
                                <div className="p-3 space-y-2 text-xs">
                                  {(() => {
                                    const selectedPost = recentPosts?.find((p: any) => p.id === selectedPostId);
                                    if (!selectedPost) return null;
                                    return (
                                      <>
                                        <div>
                                          <span className="text-muted-foreground">Stock:</span> <Badge variant="outline" className="ml-1">{selectedPost.primary_stock}</Badge>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Title:</span> <span className="ml-1">{selectedPost.title}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Score:</span> <span className="ml-1">{selectedPost.score} upvotes</span>
                                        </div>
                                        {selectedPost.selftext && (
                                          <div>
                                            <span className="text-muted-foreground">Content:</span>
                                            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">{selectedPost.selftext}</pre>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </details>
                            )}

                            {selectedCommentId !== "random" && (
                              <details className="border rounded-md">
                                <summary className="cursor-pointer font-semibold text-xs p-3 bg-muted/50">View Selected Comment</summary>
                                <div className="p-3 space-y-2 text-xs">
                                  {(() => {
                                    const selectedComment = postComments?.find((c: any) => c.id === selectedCommentId);
                                    if (!selectedComment) return null;
                                    return (
                                      <>
                                        <div>
                                          <span className="text-muted-foreground">Author:</span> <span className="ml-1">u/{selectedComment.author}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Score:</span> <span className="ml-1">{selectedComment.score} upvotes</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Content:</span>
                                          <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">{selectedComment.content}</pre>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </details>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                testPromptMutation.mutate({
                                  system_prompt: prompt.system_prompt,
                                  user_prompt_template: prompt.user_prompt_template,
                                  model: prompt.model,
                                  temperature: prompt.temperature,
                                  sample_post_id: selectedPostId !== "random" ? selectedPostId : undefined,
                                  sample_comment_id: selectedCommentId !== "random" ? selectedCommentId : undefined,
                                });
                              }}
                              disabled={testPromptMutation.isPending}
                            >
                              {testPromptMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Testing...
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Test Prompt
                                </>
                              )}
                            </Button>

                            {testResult && (
                              <div className="space-y-3 pt-3 border-t">
                                <div className="text-xs font-semibold">Test Results</div>

                                <details className="border rounded-md">
                                  <summary className="cursor-pointer font-semibold text-xs p-3 bg-muted/50">Rendered Prompt</summary>
                                  <div className="p-3">
                                    <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-48 whitespace-pre">{testResult.rendered_prompt}</pre>
                                  </div>
                                </details>

                                <details className="border rounded-md" open>
                                  <summary className="cursor-pointer font-semibold text-xs p-3 bg-muted/50">AI Response</summary>
                                  <div className="p-3">
                                    <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-48 whitespace-pre">{JSON.stringify(testResult.ai_response, null, 2)}</pre>
                                  </div>
                                </details>

                                <div className="flex gap-4 text-xs text-muted-foreground px-3">
                                  <div>Tokens: {testResult.tokens_used}</div>
                                  <div>Cost: ${testResult.cost_estimate.toFixed(6)}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
