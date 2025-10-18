import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

export function SiteHeader() {
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 sm:h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center justify-between gap-1 px-3 sm:px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-1 sm:mx-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-sm sm:text-base font-bold bg-gradient-to-r from-blue-500 to-blue-400 bg-clip-text text-transparent">
            Akleao Finance
          </h1>
        </div>
        <Badge variant="outline" className="text-[10px] sm:text-xs">
          Beta
        </Badge>
      </div>
    </header>
  )
}
