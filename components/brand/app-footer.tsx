import { COMPANY } from "@/lib/company";

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-sidebar/60 text-xs text-muted-foreground">
      <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">{COMPANY.nameKo}</div>
          <div>
            대표이사 {COMPANY.ceo} · 사업자등록번호 {COMPANY.bizRegNo}
          </div>
          <div>
            {COMPANY.addresses.join(" / ")} · TEL {COMPANY.tels.join(" / ")}
          </div>
        </div>
        <div className="text-right">
          <div>{COMPANY.slogan}</div>
          <div>© {year} {COMPANY.nameKo}. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
