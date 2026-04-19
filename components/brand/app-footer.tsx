import { COMPANY } from "@/lib/company";

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-sidebar/60 text-xs text-muted-foreground">
      <div className="mx-auto max-w-screen-2xl px-3 md:px-6 py-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">{COMPANY.appName}</div>
          <div>{COMPANY.tagline}</div>
        </div>
        <div className="md:text-right">
          <div>© {year} {COMPANY.nameEn}. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
