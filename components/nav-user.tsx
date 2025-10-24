"use client"

import {
  BellIcon,
  CreditCardIcon,
  LogOutIcon,
  MoreVerticalIcon,
  UserCircleIcon,
  Moon,
  Sun,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "@/lib/auth-client"
import { useTheme } from "next-themes"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

export function NavUser() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { setTheme, theme } = useTheme()

  const handleSignOut = async () => {
    await signOut()
    router.push("/sign-in")
  }

  if (isPending) {
    return null
  }

  if (!session) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Button
            onClick={() => router.push("/sign-in")}
            className="w-full"
            variant="outline"
          >
            Sign In
          </Button>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const user = session.user

  // Get user initials for avatar fallback
  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Use Vercel avatar service as fallback if no image is provided
  const getVercelAvatarUrl = (identifier?: string) => {
    if (!identifier) return undefined;
    // Use the user's name or email as the identifier
    return `https://avatar.vercel.sh/${encodeURIComponent(identifier)}`;
  };

  // Use Google image or fallback to Vercel avatar
  const avatarUrl = user.image || getVercelAvatarUrl(user.name || user.email);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatarUrl} alt={user.name} />
                <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <MoreVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatarUrl} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <UserCircleIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {theme === "light" ? (
                    <Sun className="h-4 w-4" />
                  ) : theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span>Theme</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="backdrop-blur-xl bg-card/95 border-primary/10">
                  <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className="group transition-all duration-300 cursor-pointer"
                  >
                    <Sun className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:rotate-45 group-hover:scale-110 group-hover:text-accent-foreground" />
                    <span className="font-medium">Light</span>
                    {theme === "light" && (
                      <span className="ml-auto text-primary text-xs font-bold transition-colors duration-300 group-hover:text-accent-foreground">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className="group transition-all duration-300 cursor-pointer"
                  >
                    <Moon className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:-rotate-12 group-hover:scale-110 group-hover:text-accent-foreground" />
                    <span className="font-medium">Dark</span>
                    {theme === "dark" && (
                      <span className="ml-auto text-primary text-xs font-bold transition-colors duration-300 group-hover:text-accent-foreground">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className="group transition-all duration-300 cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:scale-110 group-hover:text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium">System</span>
                    {theme === "system" && (
                      <span className="ml-auto text-primary text-xs font-bold transition-colors duration-300 group-hover:text-accent-foreground">✓</span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
