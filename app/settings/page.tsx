"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, signOut } from "@/lib/auth-client";
import { DatabaseIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";

// For now, hardcode admin user emails - this should come from a database in production
const ADMIN_EMAILS = ["cameronplanck@gmail.com"];

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 pb-20 md:pb-0">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
            </div>

            {/* Profile Card */}
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {session?.user ? (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
                        <AvatarFallback>
                          {session.user.name
                            ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase()
                            : session.user.email?.[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-lg font-semibold">{session.user.name || "User"}</p>
                        <p className="text-sm text-muted-foreground">{session.user.email}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="w-full sm:w-auto"
                      >
                        <LogOutIcon className="mr-2 h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Not signed in</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Access Card - Only shown for admin users */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Admin Access</CardTitle>
                  <CardDescription>Manage system data and settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/admin">
                    <Button variant="outline" className="w-full sm:w-auto">
                      <DatabaseIcon className="mr-2 h-4 w-4" />
                      Open Admin Panel
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* App Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
                <CardDescription>Application information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Environment</span>
                  <span className="font-medium">{process.env.NODE_ENV}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
