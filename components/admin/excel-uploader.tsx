"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import {
  Loader2,
  UploadCloud,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BATCH_ROW_LIMIT = 20_000;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
  autoCreateAgentCount: number;
  willUpdate: number;
  willInsert: number;
  matchedCode: number;
  matchedRrn: number;
  matchedNamePhone: number;
  previewSample: PreviewSampleRow[];
  headerErrors?: string[];
};

type ApplyResult = {
  ok: boolean;
  total: number;
  existingTotal: number;
  updated: number;
  unchanged: number;
  inserted: number;
  untouched: number;
  matchedCode: number;
  matchedRrn: number;
  matchedNamePhone: number;
  skipped: number;
  invalidCount: number;
  unknownAgentCount: number;
  autoCreateAgentCount: number;
  createdAgentCount: number;
};

type UploadChunk = {
  file: File;
  rowCount: number;
  index: number;
  totalChunks: number;
};

type UploadOutcome =
  | { ok: true; payload: PreviewResult | ApplyResult }
  | { ok: false; error: string; headerErrors?: string[] };

type ExcelJSImport = typeof import("exceljs");

async function loadExcelJs(): Promise<ExcelJSImport> {
  return import("exceljs");
}

async function splitWorkbookFile(file: File): Promise<UploadChunk[]> {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("시트를 찾을 수 없습니다.");

  const rows: unknown[][] = [];
  let headerValues: unknown[] | null = null;
  sheet.eachRow({ includeEmpty: false }, (row: import("exceljs").Row, rowNumber: number) => {
    if (rowNumber === 1) {
      headerValues = [...(row.values as unknown[])];
      return;
    }
    rows.push([...((row.values as unknown[]) ?? [])]);
  });

  if (!headerValues) throw new Error("헤더를 찾을 수 없습니다.");

  const totalChunks = Math.max(1, Math.ceil(rows.length / BATCH_ROW_LIMIT));
  const chunks: UploadChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * BATCH_ROW_LIMIT;
    const end = Math.min(rows.length, start + BATCH_ROW_LIMIT);
    const chunkWb = new ExcelJS.Workbook();
    const chunkSheet = chunkWb.addWorksheet(sheet.name || "Sheet1");
    chunkSheet.addRow(headerValues);
    for (const values of rows.slice(start, end)) {
      chunkSheet.addRow(values);
    }
    const buffer = await chunkWb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: XLSX_MIME });
    const chunkFile = new File(
      [blob],
      file.name.replace(/\.xlsx$/i, `.${String(i + 1).padStart(2, "0")}.xlsx`),
      { type: XLSX_MIME },
    );
    chunks.push({
      file: chunkFile,
      rowCount: end - start,
      index: i + 1,
      totalChunks,
    });
  }

  return chunks;
}

async function uploadChunk(
  file: File,
  targetMode: "preview" | "apply",
): Promise<UploadOutcome> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/customers/import?mode=${targetMode}`, {
    method: "POST",
    body: fd,
  });
  const json = await res.json();
  if (!res.ok) {
    return { ok: false, error: json.error ?? "업로드 실패", headerErrors: json.headerErrors };
  }
  return { ok: true, payload: json as PreviewResult | ApplyResult };
}

function createPreviewAggregate(): PreviewResult {
  return {
    ok: true,
    total: 0,
    existingCount: 0,
    invalidCount: 0,
    unknownAgentCount: 0,
    autoCreateAgentCount: 0,
    willUpdate: 0,
    willInsert: 0,
    matchedCode: 0,
    matchedRrn: 0,
    matchedNamePhone: 0,
    previewSample: [],
  };
}

function mergePreviewAggregate(target: PreviewResult, part: PreviewResult): PreviewResult {
  target.total += part.total;
  target.existingCount ||= part.existingCount;
  target.invalidCount += part.invalidCount;
  target.unknownAgentCount += part.unknownAgentCount;
  target.autoCreateAgentCount += part.autoCreateAgentCount;
  target.willUpdate += part.willUpdate;
  target.willInsert += part.willInsert;
  target.matchedCode += part.matchedCode;
  target.matchedRrn += part.matchedRrn;
  target.matchedNamePhone += part.matchedNamePhone;
  if (target.previewSample.length < 10) {
    target.previewSample.push(
      ...part.previewSample.slice(0, Math.max(0, 10 - target.previewSample.length)),
    );
  }
  return target;
}

function createApplyAggregate(): ApplyResult {
  return {
    ok: true,
    total: 0,
    existingTotal: 0,
    updated: 0,
    unchanged: 0,
    inserted: 0,
    untouched: 0,
    matchedCode: 0,
    matchedRrn: 0,
    matchedNamePhone: 0,
    skipped: 0,
    invalidCount: 0,
    unknownAgentCount: 0,
    autoCreateAgentCount: 0,
    createdAgentCount: 0,
  };
}

function mergeApplyAggregate(target: ApplyResult, part: ApplyResult): ApplyResult {
  target.total += part.total;
  target.existingTotal ||= part.existingTotal;
  target.updated += part.updated;
  target.unchanged += part.unchanged;
  target.inserted += part.inserted;
  target.untouched ||= part.untouched;
  target.matchedCode += part.matchedCode;
  target.matchedRrn += part.matchedRrn;
  target.matchedNamePhone += part.matchedNamePhone;
  target.skipped += part.skipped;
  target.invalidCount += part.invalidCount;
  target.unknownAgentCount += part.unknownAgentCount;
  target.autoCreateAgentCount += part.autoCreateAgentCount;
  target.createdAgentCount += part.createdAgentCount;
  return target;
}

function createEmptyPreview(headerErrors: string[], errorMessage: string): PreviewResult {
  return {
    ok: false,
    total: 0,
    existingCount: 0,
    invalidCount: 0,
    unknownAgentCount: 0,
    autoCreateAgentCount: 0,
    willUpdate: 0,
    willInsert: 0,
    matchedCode: 0,
    matchedRrn: 0,
    matchedNamePhone: 0,
    previewSample: [],
    headerErrors: headerErrors.length ? headerErrors : [errorMessage],
  };
}

export function ExcelUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "preview" | "apply">("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function requestChunked(targetMode: "preview" | "apply") {
    if (!file) return;
    const chunks = await splitWorkbookFile(file);
    if (targetMode === "preview") {
      const aggregate = createPreviewAggregate();
      for (const chunk of chunks) {
        const result = await uploadChunk(chunk.file, "preview");
        if (!result.ok) {
          toast.error(result.error);
          if (result.headerErrors) {
            setPreview(createEmptyPreview(result.headerErrors, result.error));
          }
          return;
        }
        mergePreviewAggregate(aggregate, result.payload as PreviewResult);
      }
      setPreview(aggregate);
      toast.success(`미리보기 완료 (${aggregate.total.toLocaleString("ko-KR")}건)`);
      return;
    }

    const aggregate = createApplyAggregate();
    for (const chunk of chunks) {
      const result = await uploadChunk(chunk.file, "apply");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      mergeApplyAggregate(aggregate, result.payload as ApplyResult);
    }

    toast.success(
      `업로드 완료: 업데이트 ${aggregate.updated}건 · 신규 ${aggregate.inserted}건 · 담당자 생성 ${aggregate.createdAgentCount}명 · 기존 유지 ${aggregate.untouched}건`,
      { duration: 6000 },
    );
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => router.refresh());
  }

  async function request(targetMode: "preview" | "apply") {
    if (!file) {
      toast.error("엑셀 파일을 선택하세요.");
      return;
    }
    try {
      setMode(targetMode);
      await requestChunked(targetMode);
      return;
    } catch (e) {
      console.error(e);
      toast.error("?ㅽ듃?뚰겕 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
    } finally {
      setMode("idle");
      setConfirmOpen(false);
    }
    const fd = new FormData();
    fd.append("file", file as File);
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
          `업로드 완료: 업데이트 ${r.updated}건 · 신규 ${r.inserted}건 · 담당자 생성 ${r.createdAgentCount ?? 0}명 · 기존 유지 ${r.untouched}건`,
          { duration: 6000 },
        );
        setPreview(null);
        setFile(null);
        const input = inputRef.current;
        if (input) {
          input!.value = "";
        }
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
          28컬럼 포맷 · 최대 10MB ·{" "}
          <b className="text-brand-accent">
            Upsert (고객코드 → 주민번호 → 이름+전화 매칭 후 업데이트, 나머지는 신규 추가)
          </b>
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
            <Stat
              label="업데이트 예정"
              value={preview.willUpdate}
              tone="accent"
            />
            <Stat label="신규 예정" value={preview.willInsert} tone="accent" />
            <Stat
              label="기존 유지 예정"
              value={Math.max(0, preview.existingCount - preview.willUpdate)}
            />
            <Stat
              label="오류 행"
              value={preview.invalidCount}
              danger={preview.invalidCount > 0}
            />
            <Stat
              label="미등록 담당자"
              value={preview.unknownAgentCount}
              danger={preview.unknownAgentCount > 0}
            />
            <Stat
              label="담당자 생성 예정"
              value={preview.autoCreateAgentCount ?? 0}
              tone="accent"
            />
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
            <span>매칭 내역:</span>
            <span>고객코드 <b className="tabular-nums">{preview.matchedCode}</b>건</span>
            <span>주민번호 <b className="tabular-nums">{preview.matchedRrn}</b>건</span>
            <span>이름+전화 <b className="tabular-nums">{preview.matchedNamePhone}</b>건</span>
          </div>
          {(preview.autoCreateAgentCount ?? 0) > 0 ? (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 text-xs">
              엑셀에 있는 담당자ID 중 사용자 관리에 없는 담당자는 업로드 실행 시 자동 생성됩니다.
              최초 비밀번호는 <b>123456</b>이고, 기본 권한은 모두 꺼진 담당자 계정으로 생성됩니다.
            </div>
          ) : null}
          {preview.unknownAgentCount > 0 && (preview.autoCreateAgentCount ?? 0) === 0 ? (
            <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs">
              ⚠ 엑셀의 담당자ID 중 사용자 DB에 없는 값이 있습니다. 해당 행은 담당자{" "}
              <b>미배정</b>으로 저장됩니다. 사용자 관리 페이지에서 먼저 등록하는 걸 권장합니다.
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
                {preview.previewSample.map((r, index) => (
                  <tr key={`${index}-${r.rowNumber}`} className="border-t">
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
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

      {/* 업로드 확인 다이얼로그 */}
      <DialogPrimitive.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <div className="flex items-center gap-2 border-b px-5 py-3">
              <CheckCircle2 className="h-5 w-5 text-brand-accent" />
              <DialogPrimitive.Title className="text-base font-semibold">
                엑셀 업로드 확인
              </DialogPrimitive.Title>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="rounded-md bg-muted/50 px-3 py-2 tabular-nums space-y-1">
                <div>
                  현재 DB: <b>{preview?.existingCount?.toLocaleString("ko-KR") ?? "-"}</b>건 ·
                  엑셀: <b>{preview?.total?.toLocaleString("ko-KR") ?? "-"}</b>건
                </div>
                <div className="text-xs text-muted-foreground">
                  예상 결과 → 업데이트{" "}
                  <b className="text-brand-accent">
                    {preview?.willUpdate?.toLocaleString("ko-KR") ?? "-"}
                  </b>
                  건 · 신규{" "}
                  <b className="text-brand-accent">
                    {preview?.willInsert?.toLocaleString("ko-KR") ?? "-"}
                  </b>
                  건 · 기존 유지{" "}
                  <b>
                    {(preview
                      ? Math.max(0, preview.existingCount - preview.willUpdate)
                      : 0
                    ).toLocaleString("ko-KR")}
                  </b>
                  건
                </div>
              </div>
              <div className="text-muted-foreground">
                엑셀의 각 행은{" "}
                <b>고객코드 → 주민번호(앞+뒤) → 이름+전화1</b> 순서로 기존 고객과 매칭됩니다.
                매칭되면 <b>해당 필드만 업데이트</b>, 매칭되지 않으면 <b>신규 추가</b>.
              </div>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                <li>
                  엑셀의 <b>빈 셀</b>은 기존 값을 그대로 <b>보존</b>합니다 (덮어쓰지 않음)
                </li>
                <li>
                  웹 전용 필드(<b>메모 · 예약일시</b>)는 엑셀에 없어 항상 보존됩니다
                </li>
                <li>
                  엑셀에 없는 <b>기존 고객은 삭제되지 않고 그대로 유지</b>됩니다
                </li>
                <li>중간 실패 시 전체 롤백 — 부분 반영 없음</li>
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
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
                onClick={() => request("apply")}
                disabled={mode === "apply"}
              >
                {mode === "apply" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                업로드 실행
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

function Stat({
  label,
  value,
  danger,
  tone,
}: {
  label: string;
  value: number;
  danger?: boolean;
  tone?: "accent";
}) {
  const color = danger
    ? "text-destructive"
    : tone === "accent"
      ? "text-brand-accent"
      : "text-foreground";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-base font-bold tabular-nums ${color}`}>
        {value.toLocaleString("ko-KR")}
      </span>
    </div>
  );
}
