import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUserWithPerms } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelUploader } from "@/components/admin/excel-uploader";

export const metadata: Metadata = {
  title: "엑셀 업/다운로드",
};

export default async function AdminExcelPage() {
  const me = await requireUserWithPerms();
  if (me.role !== "admin" && !me.canCreate) redirect("/customers");
  const knownAgentIds = (await db.query.users.findMany({
    columns: { agentId: true },
  })).map((row) => row.agentId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">엑셀 업/다운로드</h1>
        <p className="text-sm text-muted-foreground">
          기존 `고객명부.xlsx` 포맷(28컬럼) 그대로 주고받습니다. 업로드는 <b>고객코드 → 주민번호 → 이름+전화</b> 순 upsert — 엑셀의 빈 셀은 기존 값 보존, 엑셀에 없는 기존 고객은 유지됩니다.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-brand" />
              업로드
            </CardTitle>
            <CardDescription>
              먼저 &lsquo;미리보기&rsquo;로 파일 검증 후 &lsquo;업로드 실행&rsquo;으로 DB에 반영하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExcelUploader knownAgentIds={knownAgentIds} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-brand" />
              다운로드
            </CardTitle>
            <CardDescription>
              전체 고객 또는 현재 검색 조건에 맞는 고객만 엑셀로 내려받을 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1.5">
              <div>• 헤더: 고객코드No, 담당자, 이름 등 <b>28컬럼</b></div>
              <div>• 정렬 기준: DB 등록일 내림차순</div>
            </div>
            <div className="flex gap-2 pt-2">
              <a
                href="/api/customers/export"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-brand text-brand-foreground text-sm font-medium hover:bg-brand-hover transition"
              >
                <Download className="h-4 w-4" />
                전체 다운로드
              </a>
              <Link
                href="/customers"
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md border text-sm font-medium hover:bg-accent transition"
              >
                검색 페이지로 이동
              </Link>
            </div>
            <div className="text-[11px] text-muted-foreground">
              💡 검색 필터 건 상태에서 다운로드하려면 고객 목록에서 필터 적용 후 같은 쿼리로 URL을 `/api/customers/export?...`로 호출하시면 됩니다.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
