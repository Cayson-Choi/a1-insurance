"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { DetailForm } from "@/components/customers/detail-form";
import { fetchCustomerAction } from "@/lib/customers/actions";
import type { CustomerDetail } from "@/lib/customers/get-detail";

type Agent = { agentId: string; name: string };

type Props = {
  customer: CustomerDetail;
  agents: Agent[];
  canEdit: boolean;
  canDelete: boolean;
  canEditAgent: boolean;
  prevId: string | null;
  nextId: string | null;
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
  prevId: initialPrevId,
  nextId: initialNextId,
  preservedParams,
  closeHref,
  currentUserName,
}: Props) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail>(initialCustomer);
  const [prevId, setPrevId] = useState<string | null>(initialPrevId);
  const [nextId, setNextId] = useState<string | null>(initialNextId);
  const [busy, setBusy] = useState(false);

  const queryString = new URLSearchParams(preservedParams).toString();
  const qs = queryString ? `?${queryString}` : "";

  // 데스크톱(md+)에서만 드래그 이동 — 모바일은 풀스크린이라 의미 없음
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
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
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(closeHref);
    }
  }, [router, closeHref]);

  const go = useCallback(
    async (targetId: string | null) => {
      if (!targetId || busy) return;
      setBusy(true);
      try {
        const res = await fetchCustomerAction(targetId, preservedParams);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setCustomer(res.customer);
        setPrevId(res.context.prevId);
        setNextId(res.context.nextId);
        // 브라우저 주소창만 조용히 갱신 — Next.js 라우터는 건드리지 않아
        // Dialog/Popup 이 절대 리렌더되지 않음 (깜빡임 0)
        if (typeof window !== "undefined") {
          window.history.replaceState(
            window.history.state,
            "",
            `/customers/${targetId}${qs}`,
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [preservedParams, qs, busy],
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
            prevHref={prevId ? `/customers/${prevId}${qs}` : null}
            nextHref={nextId ? `/customers/${nextId}${qs}` : null}
            closeHref={closeHref}
            currentUserName={currentUserName}
            variant="modal"
            onClose={close}
            onPrev={() => go(prevId)}
            onNext={() => go(nextId)}
            onSaved={(updated) => setCustomer(updated)}
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
