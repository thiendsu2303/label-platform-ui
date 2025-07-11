"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Zap, LayoutDashboard, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  onNavigation?: (href: string) => boolean
}

export function AppHeader({ onNavigation }: AppHeaderProps) {
  const pathname = usePathname()

  const handleLinkClick = (href: string, e: React.MouseEvent) => {
    if (onNavigation) {
      const canNavigate = onNavigation(href)
      if (!canNavigate) {
        e.preventDefault()
      }
    }
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      <div className="flex h-16 items-center px-4">
        {/* Logo và Tiêu đề chính */}
        <div className="flex items-center gap-2 mr-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold">UI Annotator</h1>
        </div>

        {/* Liên kết điều hướng chung */}
        <nav className="flex items-center space-x-2 flex-1">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              "text-muted-foreground hover:text-foreground",
              pathname === "/main" && "text-foreground font-semibold",
            )}
          >
            <Link href="/main" onClick={(e) => handleLinkClick("/main", e)}>
              <ImageIcon className="mr-2 h-4 w-4" />
              Annotate
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              "text-muted-foreground hover:text-foreground",
              pathname === "/dashboard" && "text-foreground font-semibold",
            )}
          >
            <Link href="/dashboard" onClick={(e) => handleLinkClick("/dashboard", e)}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
