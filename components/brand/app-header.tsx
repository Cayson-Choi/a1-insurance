"use client";

import Link from "next/link";
import { LogOut, Menu, Shield, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/auth/actions";
import type { SessionUser } from "@/lib/auth/rbac";
import { COMPANY } from "@/lib/company";

const NAV = [
  { href: "/customers", label: "고객 목록" },
] as const;

const ADMIN_NAV = [
  { href: "/admin/users", label: "사용자 관리" },
  { href: "/admin/excel", label: "엑셀 업/다운로드" },
  { href: "/admin/audit", label: "변경 이력" },
] as const;

export function AppHeader({ user }: { user: SessionUser }) {
  const isAdmin = user.role === "admin";
  const nav = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center gap-3 md:gap-6 px-3 md:px-6">
        {/* 모바일 햄버거 메뉴 */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="메뉴 열기"
            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-60">
            <DropdownMenuGroup>
              {nav.map((n) => (
                <DropdownMenuItem
                  key={n.href}
                  nativeButton={false}
                  render={<Link href={n.href} />}
                  className="cursor-pointer text-sm"
                >
                  {n.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Link href="/customers" className="shrink-0" aria-label={COMPANY.nameKo}>
          <Logo variant="horizontal" priority />
        </Link>

        <span className="hidden md:inline-block text-sm font-semibold text-foreground/80">
          {COMPANY.appName}
        </span>

        <nav className="ml-4 hidden md:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="사용자 메뉴"
              className="inline-flex items-center gap-1.5 md:gap-2 h-9 px-2 md:px-3 rounded-md text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">{user.name ?? user.agentId}</span>
              {isAdmin ? (
                <Badge className="bg-brand text-brand-foreground hover:bg-brand text-[10px] px-1.5 h-4 gap-0.5">
                  <Shield className="h-2.5 w-2.5" />
                  관리자
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                  {user.agentId}
                </Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span>{user.name ?? "사용자"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ID {user.agentId} · {isAdmin ? "관리자" : "담당자"}
                  </span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <DropdownMenuItem
                  variant="destructive"
                  nativeButton
                  render={<button type="submit" />}
                  className="w-full cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
