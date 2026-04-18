"use client";

import { useCallback, useState } from "react";
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
  canRevealRrn: boolean;
  prevId: string | null;
  nextId: string | null;
  preservedParams: Record<string, string>;
  closeHref: string;
};

export function DetailDialog({
  customer: initialCustomer,
  agents,
  canEdit,
  canDelete,
  canEditAgent,
  canRevealRrn,
  prevId: initialPrevId,
  nextId: initialNextId,
  preservedParams,
  closeHref,
}: Props) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail>(initialCustomer);
  const [prevId, setPrevId] = useState<string | null>(initialPrevId);
  const [nextId, setNextId] = useState<string | null>(initialNextId);
  const [busy, setBusy] = useState(false);

  const queryString = new URLSearchParams(preservedParams).toString();
  const qs = queryString ? `?${queryString}` : "";

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

  return (
    <DialogPrimitive.Root open onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          aria-label="고객 상세"
          className="fixed top-1/2 left-1/2 z-50 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0"
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
            canRevealRrn={canRevealRrn}
            prevHref={prevId ? `/customers/${prevId}${qs}` : null}
            nextHref={nextId ? `/customers/${nextId}${qs}` : null}
            closeHref={closeHref}
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
