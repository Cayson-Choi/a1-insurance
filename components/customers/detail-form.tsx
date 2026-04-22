"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, ImageDown, Loader2, PhoneCall, Save, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CallResultBadge } from "@/components/customers/call-result-badge";
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog";
import { CALL_RESULTS } from "@/lib/excel/column-map";
import { formatPhone } from "@/lib/format";
import type { CustomerDetail } from "@/lib/customers/get-detail";
import { updateCustomerAction } from "@/lib/customers/actions";

const NONE_RESULT = "__none";
const NONE_AGENT = "__none";

function toDateInput(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function toDateTimeLocal(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.valueOf())) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd}T${hh}:${mi}`;
}

const FS_UNSAFE = /[\\/:*?"<>|\s]+/g;

function sanitizeForFilename(s: string): string {
  return s.replace(FS_UNSAFE, "");
}

function birthYY(birthDate: string): string {
  const m = /^(\d{4})/.exec(birthDate);
  return m ? m[1].slice(2) : "";
}

// 첫 두 토큰(시·도 + 시·군·구)을 결합. "시"·"군"·"구" 접미사는 제거.
// 예) "충북 청주시 흥덕구 …" → "충북청주", "서울특별시 강남구 …" → "서울강남"
function simpleAddress(addr: string): string {
  if (!addr) return "";
  const tokens = addr.trim().split(/\s+/);
  const stripSuffix = (t: string) =>
    t.replace(/(특별시|광역시|특별자치시|특별자치도|시|군|구)$/u, "");
  const region = stripSuffix(tokens[0] ?? "");
  const area = stripSuffix(tokens[1] ?? "");
  return region + area;
}

function buildImageFilename(name: string, birthDate: string, address: string): string {
  const safeName = sanitizeForFilename(name) || "고객";
  const yy = birthYY(birthDate);
  const addr = sanitizeForFilename(simpleAddress(address));
  return `${safeName}${yy}${addr}.png`;
}

type Props = {
  customer: CustomerDetail;
  agents: Array<{ agentId: string; name: string }>;
  canEdit: boolean;
  canDelete: boolean;
  canEditAgent: boolean;
  canDownloadImage: boolean;
  prevHref: string | null;
  nextHref: string | null;
  closeHref: string;
  currentUserName: string;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  variant?: "modal" | "page";
};

export function DetailForm({
  customer,
  agents,
  canEdit,
  canDelete,
  canEditAgent,
  canDownloadImage,
  prevHref,
  nextHref,
  closeHref,
  currentUserName,
  onClose,
  onPrev,
  onNext,
  variant = "modal",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [savingImage, setSavingImage] = useState(false);
  const [callResult, setCallResult] = useState<string>(customer.callResult ?? "");
  const [agentId, setAgentId] = useState<string>(customer.agentId ?? "");

  function close() {
    if (onClose) onClose();
    else router.push(closeHref);
  }

  function goPrev() {
    if (onPrev) onPrev();
    else if (prevHref) router.push(prevHref);
  }
  function goNext() {
    if (onNext) onNext();
    else if (nextHref) router.push(nextHref);
  }

  // React 19의 <form action={fn}> 은 성공 시 uncontrolled 입력을 defaultValue로 자동 리셋한다.
  // 사용자가 비운 값(예: 메모)이 저장은 되지만 화면에선 원래 값으로 되돌아가는 문제를 막기 위해
  // onSubmit + preventDefault로 처리한다.
  // 필드 이름(코드) → 한글 라벨 — 에러 토스트에 어떤 필드에서 실패했는지 표시용
  const FIELD_LABELS: Record<string, string> = {
    name: "이름",
    phone1: "연락처",
    job: "직업",
    address: "원주소",
    addressDetail: "방문주소",
    birthDate: "생년월일",
    callResult: "통화결과",
    dbCompany: "보험사",
    dbProduct: "보험상품명",
    dbPremium: "DB 보험료",
    subCategory: "소분류",
    dbStartAt: "가입일",
    dbEndAt: "DB 만기일",
    dbRegisteredAt: "DB 등록일",
    reservationAt: "예약일시",
    memo: "메모",
    rrnBack: "주민번호 뒷자리",
    branch: "지사",
    hq: "본부",
    team: "소속팀",
    agentId: "담당자",
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFieldErrors({});
    startTransition(async () => {
      const res = await updateCustomerAction(customer.id, formData);
      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        // 어떤 필드에서 무엇이 문제인지 토스트에 표시 (스크롤 아래 필드라도 사용자가 즉시 인지)
        const firstErrorField = res.fieldErrors ? Object.keys(res.fieldErrors)[0] : undefined;
        const firstErrorMsg = firstErrorField ? res.fieldErrors?.[firstErrorField]?.[0] : undefined;
        const description = firstErrorField
          ? `${FIELD_LABELS[firstErrorField] ?? firstErrorField}: ${firstErrorMsg ?? "형식 오류"}`
          : undefined;
        toast.error(res.error, description ? { description } : undefined);
        return;
      }
      toast.success("고객 정보가 저장되었습니다.");
      router.refresh();
    });
  }

  function currentPhone(): string {
    return (phoneRef.current?.value ?? customer.phone1 ?? "").trim();
  }

  async function copyPhone() {
    const raw = currentPhone();
    if (!raw) {
      toast.error("연락처가 비어있습니다.");
      return;
    }
    const formatted = formatPhone(raw) || raw;
    try {
      await navigator.clipboard.writeText(formatted);
      toast.success(`복사됨: ${formatted}`);
    } catch {
      toast.error("클립보드 접근이 차단되어 복사하지 못했습니다.");
    }
  }

  function insertMemoStamp(e: React.MouseEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const ta = e.currentTarget;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const stamp = `${yyyy}.${mm}.${dd} ${hh}:${mi} (${currentUserName}) : `;

    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    // 직전이 줄 끝이 아니면 자동 줄바꿈으로 구분
    const needsBreak = before.length > 0 && !before.endsWith("\n");
    const insert = (needsBreak ? "\n" : "") + stamp;

    ta.value = before + insert + after;
    const caret = (before + insert).length;
    ta.selectionStart = ta.selectionEnd = caret;
    ta.focus();
  }

  function callPhone() {
    const raw = currentPhone();
    if (!raw) {
      toast.error("연락처가 비어있습니다.");
      return;
    }
    const digits = raw.replace(/[^\d+]/g, "");
    if (!digits) {
      toast.error("유효한 전화번호가 아닙니다.");
      return;
    }
    // tel: URI → Phone Link (Windows) / FaceTime (Mac) / 기본 전화앱 (Mobile)
    window.location.href = `tel:${digits}`;
  }

  async function saveImage() {
    const node = captureRef.current;
    if (!node) return;
    setSavingImage(true);
    try {
      if (formRef.current) {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      const htmlToImage = await import("html-to-image");
      // 스크롤 컨테이너 전체 콘텐츠를 캡처하도록 scrollHeight/Width 로 강제 확장
      const fullWidth = node.scrollWidth;
      const fullHeight = node.scrollHeight;
      const dataUrl = await htmlToImage.toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        width: fullWidth,
        height: fullHeight,
        style: {
          width: `${fullWidth}px`,
          height: `${fullHeight}px`,
          maxHeight: "none",
          overflow: "visible",
          transform: "none",
        },
        // data-skip-capture 속성이 붙은 노드는 이미지에서 제외 (지사/본부/소속팀 등)
        filter: (n) => {
          if (n.nodeType === 1) {
            const el = n as Element;
            if (el.hasAttribute?.("data-skip-capture")) return false;
          }
          return true;
        },
      });
      const fd = formRef.current ? new FormData(formRef.current) : null;
      const name = String(fd?.get("name") ?? customer.name ?? "").trim();
      const birthDate = String(fd?.get("birthDate") ?? toDateInput(customer.birthDate)).trim();
      const address = String(fd?.get("address") ?? customer.address ?? "").trim();
      const filename = buildImageFilename(name, birthDate, address);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
      toast.success("이미지가 저장되었습니다.");
    } catch (e) {
      console.error(e);
      toast.error("이미지 저장에 실패했습니다.");
    } finally {
      setSavingImage(false);
    }
  }

  // handler refs — 재마운트/재렌더 시에도 최신 함수가 바인딩되도록
  const closeRef = useRef(close);
  const goPrevRef = useRef(goPrev);
  const goNextRef = useRef(goNext);
  closeRef.current = close;
  goPrevRef.current = goPrev;
  goNextRef.current = goNext;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // editable element? (input/textarea) 에서는 기본 동작 유지할지 체크
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }
      // Ctrl+← / Ctrl+→ — 입력창 안이라도 팝업 네비를 우선
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          goPrevRef.current();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          goNextRef.current();
          return;
        }
      }
      void isEditable;
    }
    // capture 단계 — 입력창 default 동작(단어 단위 커서 이동) 보다 먼저 캐치
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const err = (key: string) => fieldErrors[key]?.[0];

  return (
    <div
      className={cn(
        "flex flex-col",
        variant === "modal" ? "h-[100dvh] md:h-auto md:max-h-[92dvh]" : "",
      )}
    >
      {/* Toolbar */}
      <div
        data-drag-handle={variant === "modal" ? "" : undefined}
        className={cn(
          "flex items-center justify-between gap-2 border-b bg-sidebar/60 px-3 md:px-4 py-2 md:py-3 overflow-x-auto",
          variant === "modal" && "md:cursor-move md:select-none",
        )}
      >
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={!prevHref}
            aria-label="이전 고객"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">이전</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={!nextHref}
            aria-label="다음 고객"
          >
            <span className="hidden sm:inline">다음</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {canDownloadImage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={saveImage}
              disabled={savingImage}
              aria-label="이미지 저장"
            >
              {savingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageDown className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">이미지 저장</span>
            </Button>
          ) : null}
          {canDelete ? (
            <DeleteCustomerDialog
              customerId={customer.id}
              customerName={customer.name}
              onDeleted={close}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 h-9 px-2 md:px-3 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition"
                title="고객 삭제"
                aria-label="고객 삭제"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">삭제</span>
              </button>
            </DeleteCustomerDialog>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="bg-brand text-brand-foreground hover:bg-brand-hover"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={pending}
            aria-label="저장"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">저장</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={close}
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">닫기</span>
          </Button>
        </div>
      </div>

      {/* Body (captured for image save) */}
      <div
        ref={captureRef}
        className="flex-1 overflow-y-auto bg-background px-3 md:px-5 py-4 md:py-5"
      >
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          {/* Left: 기본 정보 */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              고객 정보
            </h2>

            {canEditAgent ? (
              <Field label="담당자" error={err("agentId")}>
                <Select
                  value={agentId || NONE_AGENT}
                  onValueChange={(v) => setAgentId(!v || v === NONE_AGENT ? "" : String(v))}
                >
                  <SelectTrigger className="h-10 w-full">
                    <span>
                      {agentId
                        ? `${agents.find((a) => a.agentId === agentId)?.name ?? agentId} · ${agentId}`
                        : "미배정"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_AGENT}>미배정</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.agentId} value={a.agentId}>
                        {a.name} · {a.agentId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="agentId" value={agentId} />
              </Field>
            ) : (
              <ReadOnly
                label="담당자"
                value={customer.agentName ?? customer.agentId ?? "미배정"}
              />
            )}

            {/* 이미지 저장 시 제외되는 조직 정보 — data-skip-capture 플래그로 html-to-image filter 에서 걸러짐 */}
            <div className="grid grid-cols-3 gap-3" data-skip-capture>
              <Field label="지사" error={err("branch")}>
                <Input
                  name="branch"
                  defaultValue={customer.branch ?? ""}
                  className="h-10"
                  placeholder="수유센터"
                  readOnly={!canEdit}
                />
              </Field>
              <Field label="본부" error={err("hq")}>
                <Input
                  name="hq"
                  defaultValue={customer.hq ?? ""}
                  className="h-10"
                  placeholder="동의콜파트"
                  readOnly={!canEdit}
                />
              </Field>
              <Field label="소속팀" error={err("team")}>
                <Input
                  name="team"
                  defaultValue={customer.team ?? ""}
                  className="h-10"
                  placeholder="곽영서팀"
                  readOnly={!canEdit}
                />
              </Field>
            </div>

            <Field label="이름" error={err("name")} required>
              <Input
                name="name"
                defaultValue={customer.name}
                autoFocus
                required
                className="h-10"
                readOnly={!canEdit}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="생년월일" error={err("birthDate")}>
                <Input
                  type="date"
                  name="birthDate"
                  defaultValue={toDateInput(customer.birthDate)}
                  className="h-10 tabular-nums"
                  readOnly={!canEdit}
                />
              </Field>
              <Field label="주민번호 뒷자리 (7)" error={err("rrnBack")}>
                <Input
                  name="rrnBack"
                  defaultValue={customer.rrnBack ?? ""}
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="예: 1234567"
                  className="h-10 font-mono tabular-nums"
                  autoComplete="off"
                  readOnly={!canEdit}
                />
              </Field>
            </div>

            <Field label="연락처" error={err("phone1")}>
              <div className="flex items-center gap-2">
                <Input
                  ref={phoneRef}
                  name="phone1"
                  defaultValue={customer.phone1 ?? ""}
                  placeholder="010-0000-0000"
                  className="h-10 font-mono tabular-nums flex-1"
                  inputMode="tel"
                  readOnly={!canEdit}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0"
                  onClick={callPhone}
                  title="전화 걸기 (Phone Link / 기본 전화앱 실행)"
                  aria-label="전화 걸기"
                >
                  <PhoneCall className="h-4 w-4" />
                  전화
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0"
                  onClick={copyPhone}
                  title="전화번호 복사"
                  aria-label="전화번호 복사"
                >
                  <Copy className="h-4 w-4" />
                  복사
                </Button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                현재 저장: {formatPhone(customer.phone1) || "없음"}
              </div>
            </Field>

            <Field label="원주소" error={err("address")}>
              <Input
                name="address"
                defaultValue={customer.address ?? ""}
                placeholder="시/도 구/군 동/읍 …"
                className="h-10"
                readOnly={!canEdit}
              />
            </Field>
            <Field label="방문주소" error={err("addressDetail")}>
              <Input
                name="addressDetail"
                defaultValue={customer.addressDetail ?? ""}
                placeholder="상세 주소, 건물명·동·호 등"
                className="h-10"
              />
            </Field>

            <Field label="직업" error={err("job")}>
              <Input
                name="job"
                defaultValue={customer.job ?? ""}
                className="h-10"
                readOnly={!canEdit}
              />
            </Field>
          </section>

          {/* Right: 상품·예약·담당자 */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              보험 / 상담 정보
            </h2>

            <Field label="통화결과">
              <Select
                value={callResult || NONE_RESULT}
                onValueChange={(v) => setCallResult(!v || v === NONE_RESULT ? "" : String(v))}
              >
                <SelectTrigger className="h-10 w-full">
                  <span>{callResult || "미분류"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_RESULT}>미분류</SelectItem>
                  {CALL_RESULTS.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="flex items-center gap-2">
                        <CallResultBadge value={r} />
                        {r}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="callResult" value={callResult} />
            </Field>

            <Field label="보험사" error={err("dbCompany")}>
              <Input
                name="dbCompany"
                defaultValue={customer.dbCompany ?? ""}
                className="h-10"
                readOnly={!canEdit}
              />
            </Field>
            <Field label="보험상품명" error={err("dbProduct")}>
              <Input
                name="dbProduct"
                defaultValue={customer.dbProduct ?? ""}
                className="h-10"
                readOnly={!canEdit}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="가입일" error={err("dbStartAt")}>
                <Input
                  type="date"
                  name="dbStartAt"
                  defaultValue={toDateInput(customer.dbStartAt)}
                  className="h-10 tabular-nums"
                  readOnly={!canEdit}
                />
              </Field>
              <Field label="DB 만기일" error={err("dbEndAt")}>
                <Input
                  type="date"
                  name="dbEndAt"
                  defaultValue={toDateInput(customer.dbEndAt)}
                  className="h-10 tabular-nums"
                  readOnly={!canEdit}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="DB 보험료" error={err("dbPremium")}>
                <Input
                  type="text"
                  name="dbPremium"
                  /* DB numeric(14,2) → Number 정규화 후 천단위 쉼표 (엑셀 형식과 동일).
                   * 저장 시 zod(optionalNumeric) 가 쉼표를 자동 제거. blur 에서도 재포맷. */
                  defaultValue={
                    customer.dbPremium
                      ? Number(customer.dbPremium).toLocaleString("ko-KR")
                      : ""
                  }
                  onBlur={(e) => {
                    const raw = e.currentTarget.value.replace(/,/g, "").trim();
                    if (!raw) return;
                    const n = Number(raw);
                    if (!Number.isFinite(n)) return;
                    e.currentTarget.value = n.toLocaleString("ko-KR");
                  }}
                  inputMode="numeric"
                  placeholder="55,000"
                  className="h-10 tabular-nums"
                  readOnly={!canEdit}
                />
              </Field>
              <Field label="소분류" error={err("subCategory")}>
                <Input
                  name="subCategory"
                  defaultValue={customer.subCategory ?? ""}
                  className="h-10"
                  readOnly={!canEdit}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="예약일시" error={err("reservationAt")}>
                <Input
                  type="datetime-local"
                  name="reservationAt"
                  defaultValue={toDateTimeLocal(customer.reservationAt)}
                  className="h-10 tabular-nums"
                  readOnly={!canEdit}
                />
              </Field>
              <div />
            </div>

            <Field label="메모" error={err("memo")}>
              <Textarea
                name="memo"
                defaultValue={customer.memo ?? ""}
                rows={12}
                placeholder="상담 내용, 특이사항 등을 입력하세요. (마우스 오른쪽 클릭: 일시·담당자 자동 입력)"
                onContextMenu={insertMemoStamp}
                className="min-h-[260px]"
              />
            </Field>
          </section>
        </form>
      </div>

      <div className="border-t bg-sidebar/40 px-4 py-2 text-[11px] text-muted-foreground">
        <span>단축키: Esc 닫기 · Ctrl+S 저장 · Ctrl+← / Ctrl+→ 이전/다음</span>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}

function ReadOnly({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm text-foreground">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

