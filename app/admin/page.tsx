"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";
import { AdminDashboard } from "@/components/admin-dashboard";

export default function AdminPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 pb-20 md:pb-0">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-3 sm:px-4 lg:px-6 space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl sm:text-3xl font-bold">Admin Overview</h1>
                </div>
                <AdminDashboard />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
