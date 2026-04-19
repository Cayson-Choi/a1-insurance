"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const ALL = "__all";

export function LoginFilterBar({
  actors,
}: {
  actors: Array<{ agentId: string; name: string | null }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [agentId, setAgentId] = useState<string>(sp.get("agentId") ?? "");
  const [success, setSuccess] = useState<string>(sp.get("success") ?? "");
  const [from, setFrom] = useState<string>(sp.get("from") ?? "");
  const [to, setTo] = useState<string>(sp.get("to") ?? "");

  function commit() {
    const next = new URLSearchParams();
    if (agentId) next.set("agentId", agentId);
    if (success) next.set("success", success);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    const qs = next.toString();
    startTransition(() => router.push(`/admin/logins${qs ? `?${qs}` : ""}`));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    commit();
  }

  function reset() {
    setAgentId("");
    setSuccess("");
    setFrom("");
    setTo("");
    startTransition(() => router.push("/admin/logins"));
  }

  const hasFilter = !!agentId || !!success || !!from || !!to;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-2 md:gap-3 rounded-lg border bg-card p-3 md:p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-48">
        <Label className="text-xs text-muted-foreground">사용자</Label>
        <Select
          value={agentId || ALL}
          onValueChange={(v) => setAgentId(!v || v === ALL ? "" : String(v))}
        >
          <SelectTrigger className="h-9 w-full">
            <span className="truncate">
              {agentId
                ? `${actors.find((a) => a.agentId === agentId)?.name ?? agentId} · ${agentId}`
                : "전체"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a.agentId} value={a.agentId}>
                {a.name ?? "(이름 없음)"} · {a.agentId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-32">
        <Label className="text-xs text-muted-foreground">결과</Label>
        <Select
          value={success || ALL}
          onValueChange={(v) => setSuccess(!v || v === ALL ? "" : String(v))}
        >
          <SelectTrigger className="h-9 w-full">
            <span>
              {success === "true" ? "성공만" : success === "false" ? "실패만" : "전체"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체</SelectItem>
            <SelectItem value="true">성공만</SelectItem>
            <SelectItem value="false">실패만</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-36">
        <Label htmlFor="f-from" className="text-xs text-muted-foreground">
          시작일
        </Label>
        <Input
          id="f-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 tabular-nums"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-36">
        <Label htmlFor="f-to" className="text-xs text-muted-foreground">
          종료일
        </Label>
        <Input
          id="f-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 tabular-nums"
        />
      </div>
      <div className="flex items-end gap-2">
        <Button
          type="submit"
          disabled={pending}
          className="h-9 bg-brand text-brand-foreground hover:bg-brand-hover"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          검색
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 text-muted-foreground"
          onClick={reset}
          disabled={!hasFilter || pending}
        >
          <X className="h-4 w-4" />
          초기화
        </Button>
      </div>
    </form>
  );
}
