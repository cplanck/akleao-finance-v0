"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, ExternalLink, MessageSquare, Eye, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content: string | null;
  author: string;
  url: string;
  score: number;
  num_comments: number;
  initial_num_comments: number;
  mentioned_stocks: string | string[]; // Can be array or JSON string
  primary_stock: string | null;
  posted_at: string;  // When posted on Reddit
  created_at: string;  // When we first indexed it
  track_comments: boolean;
  track_until: string | null;
  last_comment_scrape_at: string | null;
  comment_scrape_count: number;
}

interface PostsDataTableProps {
  data: RedditPost[];
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Never";

  // Backend returns UTC timestamps without 'Z' suffix, so add it
  const utcDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  const date = new Date(utcDateString);

  // Check if date is valid
  if (isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Handle future dates (small tolerance for clock skew)
  if (seconds < -5) {
    return "Just now";
  }

  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function PostsDataTable({ data }: PostsDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const columns: ColumnDef<RedditPost>[] = [
    {
      id: "row_number",
      header: "#",
      cell: ({ row }) => {
        // Calculate row number based on current page and row index
        const pageIndex = table.getState().pagination.pageIndex;
        const pageSize = table.getState().pagination.pageSize;
        return (
          <div className="text-sm text-muted-foreground font-mono w-8">
            {pageIndex * pageSize + row.index + 1}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Title
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const post = row.original;
        // Backend returns UTC timestamps without 'Z' suffix, so add it
        const trackUntilUTC = post.track_until?.endsWith('Z') ? post.track_until : `${post.track_until}Z`;
        const isTracking = post.track_comments && post.track_until && new Date(trackUntilUTC) > new Date();
        const commentGrowth = post.num_comments - post.initial_num_comments;
        const hasNewComments = commentGrowth > 0;

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="font-medium">{post.title}</div>
              {isTracking && (
                <Badge variant="outline" className="text-xs gap-1 bg-blue-50 text-blue-700 border-blue-200">
                  <Eye className="h-3 w-3" />
                  Tracking
                </Badge>
              )}
              {hasNewComments && (
                <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
                  <TrendingUp className="h-3 w-3" />
                  +{commentGrowth} new
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              r/{post.subreddit}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "primary_stock",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Ticker
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const stock = row.getValue("primary_stock") as string | null;
        return stock ? (
          <Badge variant="default" className="font-mono">
            ${stock}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "num_comments",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Comments
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const comments = row.getValue("num_comments") as number;
        return (
          <div className="flex items-center gap-1 text-sm">
            <MessageSquare className="h-3 w-3" />
            {comments.toLocaleString()}
          </div>
        );
      },
    },
    {
      accessorKey: "posted_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Posted
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return <div className="text-sm text-muted-foreground">{formatTimeAgo(row.getValue("posted_at"))}</div>;
      },
    },
    {
      accessorKey: "num_comments",
      id: "comment_growth",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Activity
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const post = row.original;
        const commentGrowth = post.num_comments - post.initial_num_comments;

        if (commentGrowth === 0) {
          return <div className="text-sm text-muted-foreground">—</div>;
        }

        return (
          <div className="flex items-center gap-1 text-sm font-medium text-green-600">
            <TrendingUp className="h-3 w-3" />
            +{commentGrowth}
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        const growthA = rowA.original.num_comments - rowA.original.initial_num_comments;
        const growthB = rowB.original.num_comments - rowB.original.initial_num_comments;
        return growthA - growthB;
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            First Crawled
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return <div className="text-sm text-muted-foreground">{formatTimeAgo(row.getValue("created_at"))}</div>;
      },
    },
    {
      accessorKey: "last_comment_scrape_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Crawled
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const lastCrawled = row.getValue("last_comment_scrape_at") as string | null;
        const post = row.original;
        // Backend returns UTC timestamps without 'Z' suffix, so add it
        const trackUntilUTC = post.track_until?.endsWith('Z') ? post.track_until : `${post.track_until}Z`;
        const isTracking = post.track_comments && post.track_until && new Date(trackUntilUTC) > new Date();

        if (!isTracking) {
          return <div className="text-sm text-muted-foreground">—</div>;
        }

        if (!lastCrawled) {
          return <div className="text-sm text-muted-foreground italic">Pending</div>;
        }

        return <div className="text-sm text-muted-foreground">{formatTimeAgo(lastCrawled)}</div>;
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Filter by title..."
          value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("title")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto hidden md:flex">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            const post = row.original;
            const trackUntilUTC = post.track_until?.endsWith('Z') ? post.track_until : `${post.track_until}Z`;
            const isTracking = post.track_comments && post.track_until && new Date(trackUntilUTC) > new Date();
            const commentGrowth = post.num_comments - post.initial_num_comments;
            const hasNewComments = commentGrowth > 0;

            return (
              <Link key={row.id} href={`/posts/${post.id}`}>
                <div className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors">
                  {/* Title and badges */}
                  <div className="space-y-2">
                    <div className="font-medium text-sm leading-tight">{post.title}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">r/{post.subreddit}</Badge>
                      {post.primary_stock && (
                        <Badge variant="default" className="text-xs font-mono">
                          ${post.primary_stock}
                        </Badge>
                      )}
                      {isTracking && (
                        <Badge variant="outline" className="text-xs gap-1 bg-blue-50 text-blue-700 border-blue-200">
                          <Eye className="h-3 w-3" />
                          Tracking
                        </Badge>
                      )}
                      {hasNewComments && (
                        <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
                          <TrendingUp className="h-3 w-3" />
                          +{commentGrowth}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {post.num_comments.toLocaleString()}
                    </div>
                    <span>•</span>
                    <span>{formatTimeAgo(post.posted_at)}</span>
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No results.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => window.location.href = `/posts/${row.original.id}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
          {table.getPageCount() > 1 && (
            <span className="ml-2">
              (Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()})
            </span>
          )}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
