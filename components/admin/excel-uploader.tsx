"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
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
  existingCount: number;
  invalidCount: number;
  unknownAgentCount: number;
  previewSample: PreviewSampleRow[];
  headerErrors?: string[];
};

type ApplyResult = {
  ok: boolean;
  total: number;
  deletedCount: number;
  inserted: number;
  skipped: number;
  invalidCount: number;
  unknownAgentCount: number;
  rrnBackCount?: number;
  rrnFrontCount?: number;
};

export function ExcelUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "preview" | "apply">("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        toast.success(
          `교체 완료: 기존 ${r.deletedCount}건 삭제 · 신규 ${r.inserted}건 입력${
            r.skipped ? ` · 건너뜀 ${r.skipped}건` : ""
          }`,
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
      setConfirmOpen(false);
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
          28컬럼 포맷 · 최대 10MB · <b className="text-destructive">업로드 시 기존 고객 데이터 전부 교체</b>
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
          className="bg-destructive text-white hover:bg-destructive/90"
          onClick={() => {
            if (!preview?.ok) {
              toast.error("먼저 '미리보기'로 파일을 검증하세요.");
              return;
            }
            setConfirmOpen(true);
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
            <Stat label="기존 DB" value={preview.existingCount} />
            <Stat label="엑셀" value={preview.total} />
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

      {/* 교체 확인 다이얼로그 */}
      <DialogPrimitive.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <div className="flex items-center gap-2 border-b px-5 py-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogPrimitive.Title className="text-base font-semibold">
                전체 데이터 교체
              </DialogPrimitive.Title>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="rounded-md bg-muted/50 px-3 py-2 tabular-nums">
                현재 DB: <b>{preview?.existingCount?.toLocaleString("ko-KR") ?? "-"}</b>건 · 엑셀: <b>{preview?.total?.toLocaleString("ko-KR") ?? "-"}</b>건
              </div>
              <div className="text-muted-foreground">
                업로드를 실행하면 <b className="text-destructive">현재 DB 의 고객 데이터가 모두 삭제</b>되고 엑셀의 내용으로 완전히 교체됩니다.
              </div>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                <li>삭제 후 복구 불가 — 엑셀 백업 파일 보관 권장</li>
                <li>웹에서 최근 편집한 내용이 있다면 <b>손실</b>될 수 있음</li>
                <li>변경 이력(감사로그) 은 그대로 보존됨</li>
                <li>담당자·로그인 이력은 영향 없음</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={mode === "apply"}
              >
                취소
              </Button>
              <Button
                type="button"
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => request("apply")}
                disabled={mode === "apply"}
              >
                {mode === "apply" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                교체 실행
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
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
