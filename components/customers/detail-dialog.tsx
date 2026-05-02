"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { DetailForm } from "@/components/customers/detail-form";
import type { CustomerDetail, DetailContext } from "@/lib/customers/get-detail";

type Agent = { agentId: string; name: string };

type Props = {
  customer: CustomerDetail;
  agents: Agent[];
  canEdit: boolean;
  canDelete: boolean;
  canEditAgent: boolean;
  canDownloadImage: boolean;
  prevId: string | null;
  nextId: string | null;
  prevPage: number;
  nextPage: number;
  preservedParams: Record<string, string>;
  closeHref: string;
  currentUserName: string;
};

export function DetailDialog({
  customer: initialCustomer,
  agents,
  canEdit,
  canDelete,
  canEditAgent,
  canDownloadImage,
  prevId: initialPrevId,
  nextId: initialNextId,
  prevPage: initialPrevPage,
  nextPage: initialNextPage,
  preservedParams,
  closeHref,
  currentUserName,
}: Props) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail>(initialCustomer);
  const [prevId, setPrevId] = useState<string | null>(initialPrevId);
  const [nextId, setNextId] = useState<string | null>(initialNextId);
  const [prevPage, setPrevPage] = useState<number>(initialPrevPage);
  const [nextPage, setNextPage] = useState<number>(initialNextPage);
  const [busy, setBusy] = useState(false);

  // 모달 진입 시점의 page 를 추적 — 페이지 경계 넘어갈 때 router.replace 트리거 판정용.
  const initialCurrentPage = (() => {
    const v = Number(preservedParams.page);
    return Number.isFinite(v) && v >= 1 ? v : 1;
  })();
  const currentPageRef = useRef<number>(initialCurrentPage);
  // 모달 진입 시점의 모든 search params (sort, dir 등) 를 freeze.
  // 모달 안에서 일어나는 server action 응답이 preservedParams prop 을 바꿔도 영향 안 받게 ref 로 보존.
  const initialParamsRef = useRef<Record<string, string>>({ ...preservedParams });

  // preservedParams 에 새 page 를 끼워 넣어 검색 파라미터 객체 생성.
  // prev/next href 빌드용 + fetchCustomerAction 호출 시 사용.
  function paramsWithPage(page: number): Record<string, string> {
    const out = { ...preservedParams };
    if (page <= 1) delete out.page;
    else out.page = String(page);
    return out;
  }

  // 데스크톱(md+)에서만 드래그 이동 — 모바일은 풀스크린이라 의미 없음.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      // 데스크톱에서 모바일 폭으로 전환되면 드래그 오프셋 리셋 — 의도된 외부 동기화.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOffset({ x: 0, y: 0 });
      return;
    }

    let drag: { sx: number; sy: number; bx: number; by: number } | null = null;

    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const handle = target.closest("[data-drag-handle]");
      if (!handle) return;
      // 버튼·입력·드롭다운 트리거 등 인터랙티브 요소 위에서는 드래그 시작 안 함
      if (
        target.closest(
          "button, input, textarea, select, a, [role='combobox'], [role='button'], [role='menuitem']",
        )
      ) {
        return;
      }
      e.preventDefault();
      drag = {
        sx: e.clientX,
        sy: e.clientY,
        bx: offsetRef.current.x,
        by: offsetRef.current.y,
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "move";
    }
    function onMouseMove(e: MouseEvent) {
      if (!drag) return;
      e.preventDefault();
      setOffset({ x: drag.bx + (e.clientX - drag.sx), y: drag.by + (e.clientY - drag.sy) });
    }
    function onMouseUp() {
      if (!drag) return;
      drag = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDesktop]);

  const close = useCallback(() => {
    // 항상 모달 진입 시점의 params (sort, dir 등) 를 보존 + 사용자가 마지막으로 본 page 적용.
    // initialParamsRef 로 freeze 해서 모달 내부 서버 액션이 preservedParams prop 을 바꿔도 영향 없음.
    const currentPage = currentPageRef.current;
    const params = new URLSearchParams(initialParamsRef.current);
    if (currentPage <= 1) params.delete("page");
    else params.set("page", String(currentPage));
    const qs = params.toString();
    const targetUrl = `/customers${qs ? `?${qs}` : ""}`;
    // window.location.assign 으로 강제 full navigation — router.push/replace 가 parallel route 의
    // intercepting modal 이 활성인 상태에서 confused 해서 닫지 못하는 경우 회피.
    // (Next.js 16.2 에서도 router.replace 로 닫히지 않는 회귀 재현됨 — 풀 리로드 유지)
    if (typeof window !== "undefined") {
      window.location.assign(targetUrl);
    } else {
      router.push(targetUrl);
    }
  }, [router]);

  const go = useCallback(
    async (targetId: string | null, targetPage: number) => {
      if (!targetId || busy) return;
      setBusy(true);
      try {
        const nextParams = { ...preservedParams };
        if (targetPage <= 1) delete nextParams.page;
        else nextParams.page = String(targetPage);
        const qs = new URLSearchParams(nextParams).toString();
        // 일반 GET API 호출 — server action auto-revalidate 부작용 회피.
        const r = await fetch(`/api/customers/${targetId}/context${qs ? `?${qs}` : ""}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!r.ok) {
          toast.error(r.status === 404 ? "고객을 찾을 수 없습니다." : "조회 실패");
          return;
        }
        const data = (await r.json()) as
          | { ok: true; customer: CustomerDetail; context: DetailContext }
          | { ok: false; error: string };
        if (!data.ok) {
          toast.error(data.error);
          return;
        }
        setCustomer(data.customer);
        setPrevId(data.context.prevId);
        setNextId(data.context.nextId);
        setPrevPage(data.context.prevPage);
        setNextPage(data.context.nextPage);

        currentPageRef.current = targetPage;
        // ── 최종안: 모달 깜빡임 0 우선 ─────────────────────────────
        // Next.js parallel route + intercepting modal 구조에서는 modal 을 깜빡임 없이 유지하면서
        // children slot(/customers list) 을 동시에 갱신하는 것이 안정적으로 불가능.
        // 또한 window.history.replaceState 로 URL bar 만 갱신하면 Next.js 내부 URL 과 어긋나
        // 닫기 시 router.push 가 navigation loop 에 빠짐.
        // 따라서:
        //   - 모달 안에서 이전/다음: state 로 콘텐츠만 전환. URL bar 는 진입 시점 그대로 유지.
        //   - 사용자가 모달 닫을 때 close 함수에서 currentPage 로 navigate → list 가 그 시점에 갱신.
        // 부수효과: URL bar 가 실제 보이는 고객 id 와 다름 (URL 공유 시 진입 시점 고객으로 열림).
        // 다음 단계로 페이지가 정확히 갱신되는 것이 더 중요하므로 이 trade-off 수용.
      } finally {
        setBusy(false);
      }
    },
    [preservedParams, busy],
  );

  function handleOpenChange(open: boolean) {
    if (!open) close();
  }

  const popupStyle: React.CSSProperties | undefined = isDesktop
    ? { transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }
    : undefined;

  return (
    <DialogPrimitive.Root open onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-transparent"
        />
        <DialogPrimitive.Popup
          aria-label="고객 상세"
          style={popupStyle}
          className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 z-50 w-full md:max-w-5xl overflow-hidden md:rounded-xl border-0 md:border bg-popover text-popover-foreground shadow-2xl ring-0 md:ring-1 md:ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 md:data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0"
        >
          {/*
            Key by customer.id → 내부 폼(입력창·useState) 깔끔 리셋,
            바깥 Dialog.Popup·Backdrop은 그대로 유지되어 번쩍임 없음
          */}
          <DetailForm
            key={customer.id}
            customer={customer}
            agents={agents}
            canEdit={canEdit}
            canDelete={canDelete}
            canEditAgent={canEditAgent}
            canDownloadImage={canDownloadImage}
            prevHref={
              prevId
                ? `/customers/${prevId}?${new URLSearchParams(paramsWithPage(prevPage)).toString()}`
                : null
            }
            nextHref={
              nextId
                ? `/customers/${nextId}?${new URLSearchParams(paramsWithPage(nextPage)).toString()}`
                : null
            }
            closeHref={closeHref}
            currentUserName={currentUserName}
            variant="modal"
            onClose={close}
            onPrev={() => go(prevId, prevPage)}
            onNext={() => go(nextId, nextPage)}
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
