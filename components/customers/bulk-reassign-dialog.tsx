"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { Loader2, UserCog } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { bulkReassignAction } from "@/lib/customers/actions";

const UNASSIGN = "__unassigned";

export function BulkReassignDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
  agents,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  selectedIds: string[];
  agents: Array<{ agentId: string; name: string }>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [targetAgent, setTargetAgent] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const target = targetAgent === UNASSIGN ? null : targetAgent;
    startTransition(async () => {
      const res = await bulkReassignAction(selectedIds, target);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const label =
        res.newAgentId === null
          ? "미배정"
          : `${agents.find((a) => a.agentId === res.newAgentId)?.name ?? res.newAgentId}(${res.newAgentId})`;
      toast.success(`${res.updated}건의 담당자를 ${label}(으)로 변경했습니다.`, {
        duration: 5000,
      });
      onOpenChange(false);
      setTargetAgent("");
      onDone();
      router.refresh();
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <UserCog className="h-5 w-5 text-brand" />
            <DialogPrimitive.Title className="text-base font-semibold">
              담당자 일괄 변경
            </DialogPrimitive.Title>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="rounded-md bg-muted/50 px-3 py-2">
              선택된 고객: <b>{selectedCount}</b>건
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                새 담당자<span className="ml-1 text-destructive">*</span>
              </Label>
              <Select
                value={targetAgent || ""}
                onValueChange={(v) => setTargetAgent(v ? String(v) : "")}
              >
                <SelectTrigger className="h-10 w-full">
                  <span>
                    {targetAgent === ""
                      ? "선택"
                      : targetAgent === UNASSIGN
                        ? "미배정"
                        : `${agents.find((a) => a.agentId === targetAgent)?.name ?? targetAgent} · ${targetAgent}`}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGN}>미배정 (담당자 해제)</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.agentId} value={a.agentId}>
                      {a.name} · {a.agentId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
              이 작업은 <b>되돌릴 수 없습니다</b>. 변경 이력에 {selectedCount}건의 기록이 남습니다.
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-sidebar/40 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button
              type="button"
              className="bg-brand text-brand-foreground hover:bg-brand-hover"
              onClick={submit}
              disabled={pending || !targetAgent}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCog className="h-4 w-4" />
              )}
              {selectedCount}건 변경
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
