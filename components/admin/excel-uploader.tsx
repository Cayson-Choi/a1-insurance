"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UploadCloud, CheckCircle2, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type PreviewSampleRow = {
  rowNumber: number;
  name: string;
  agentId: string | null;
  phone1: string | null;
  address: string | null;
  callResult: string | null;
  errors: string[];
};

type PreviewResult = {
  ok: boolean;
  total: number;
  invalidCount: number;
  unknownAgentCount: number;
  previewSample: PreviewSampleRow[];
  headerErrors?: string[];
};

type ApplyResult = {
  ok: boolean;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  invalidCount: number;
  unknownAgentCount: number;
  rrnBackEncrypted?: number;
  rrnFrontHashed?: number;
};

export function ExcelUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "preview" | "apply">("idle");

  async function request(targetMode: "preview" | "apply") {
    if (!file) {
      toast.error("엑셀 파일을 선택하세요.");
      return;
    }
    setMode(targetMode);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/customers/import?mode=${targetMode}`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "업로드 실패");
        if (json.headerErrors) setPreview({ ...json, ok: false, previewSample: [] });
        return;
      }
      if (targetMode === "preview") {
        setPreview(json as PreviewResult);
        toast.success(`미리보기 완료 (${json.total}건)`);
      } else {
        const r = json as ApplyResult;
        const rrnMsg =
          r.rrnBackEncrypted || r.rrnFrontHashed
            ? ` · 주민번호 암호화 ${r.rrnBackEncrypted ?? 0}건 · 앞자리 해시 ${r.rrnFrontHashed ?? 0}건`
            : "";
        toast.success(
          `적용 완료: 신규 ${r.inserted}건 · 갱신 ${r.updated}건 · 건너뜀 ${r.skipped}건${rrnMsg}`,
          { duration: 6000 },
        );
        setPreview(null);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        startTransition(() => router.refresh());
      }
    } catch (e) {
      console.error(e);
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setMode("idle");
    }
  }

  return (
    <div className="space-y-4">
      <label
        htmlFor="xlsx-file"
        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card p-8 cursor-pointer hover:bg-accent/50 transition"
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <div className="text-sm font-medium">
          {file ? file.name : "엑셀 파일(.xlsx) 선택"}
        </div>
        <div className="text-xs text-muted-foreground">
          28컬럼 포맷 · 최대 10MB · 고객코드No 기준 upsert
        </div>
        <input
          ref={inputRef}
          id="xlsx-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
          }}
        />
      </label>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => request("preview")}
          disabled={!file || mode !== "idle"}
        >
          {mode === "preview" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          미리보기
        </Button>
        <Button
          type="button"
          className="bg-brand text-brand-foreground hover:bg-brand-hover"
          onClick={() => {
            if (!preview?.ok) {
              toast.error("먼저 '미리보기'로 파일을 검증하세요.");
              return;
            }
            if (
              !window.confirm(
                `총 ${preview.total}건을 DB에 반영합니다. 계속할까요?\n· 고객코드No 일치: 기존 데이터 갱신\n· 일치 없음: 신규 추가\n· 이 동작은 되돌릴 수 없습니다.`,
              )
            )
              return;
            request("apply");
          }}
          disabled={!preview?.ok || mode !== "idle" || pending}
        >
          {mode === "apply" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          업로드 실행
        </Button>
      </div>

      {preview?.headerErrors?.length ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="font-semibold flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-4 w-4" /> 헤더 오류
          </div>
          <ul className="list-disc pl-5">
            {preview.headerErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview?.ok ? (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <Stat label="총 행" value={preview.total} />
            <Stat label="오류 행" value={preview.invalidCount} danger={preview.invalidCount > 0} />
            <Stat label="미등록 담당자" value={preview.unknownAgentCount} danger={preview.unknownAgentCount > 0} />
          </div>
          {preview.unknownAgentCount > 0 ? (
            <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs">
              ⚠ 엑셀의 담당자ID 중 사용자 DB에 없는 값이 있습니다. 해당 행은 담당자 <b>미배정</b>으로 저장됩니다. 사용자 관리 페이지에서 먼저 등록하는 걸 권장합니다.
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">이름</th>
                  <th className="px-2 py-1.5">담당자ID</th>
                  <th className="px-2 py-1.5">연락처</th>
                  <th className="px-2 py-1.5">주소</th>
                  <th className="px-2 py-1.5">통화결과</th>
                  <th className="px-2 py-1.5">오류</th>
                </tr>
              </thead>
              <tbody>
                {preview.previewSample.map((r) => (
                  <tr key={r.rowNumber} className="border-t">
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{r.rowNumber}</td>
                    <td className="px-2 py-1.5 font-medium">{r.name}</td>
                    <td className="px-2 py-1.5 font-mono">{r.agentId ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono">{r.phone1 ?? "—"}</td>
                    <td className="px-2 py-1.5 max-w-60 truncate">{r.address ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.callResult ?? "—"}</td>
                    <td className="px-2 py-1.5 text-destructive">
                      {r.errors.length ? r.errors.join(", ") : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground">* 앞 10건만 미리 표시합니다.</div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          "text-base font-bold tabular-nums " +
          (danger ? "text-destructive" : "text-foreground")
        }
      >
        {value.toLocaleString("ko-KR")}
      </span>
    </div>
  );
}
