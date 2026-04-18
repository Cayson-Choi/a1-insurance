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
import { CALL_RESULTS } from "@/lib/excel/column-map";

const ALL = "__all";

export function SearchBar({
  agents,
  showAgentFilter,
}: {
  agents: Array<{ agentId: string; name: string }>;
  showAgentFilter: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  // controlled state — 초기값은 현재 URL 쿼리에서 읽는다
  const [name, setName] = useState<string>(sp.get("name") ?? "");
  const [addr, setAddr] = useState<string>(sp.get("addr") ?? "");
  const [callResult, setCallResult] = useState<string>(sp.get("callResult") ?? "");
  const [agentId, setAgentId] = useState<string>(sp.get("agentId") ?? "");
  const [rrnFront, setRrnFront] = useState<string>(sp.get("rrnFront") ?? "");
  const [rrnBack, setRrnBack] = useState<string>(sp.get("rrnBack") ?? "");

  function commit() {
    const next = new URLSearchParams();
    const nm = name.trim();
    const ad = addr.trim();
    const rf = rrnFront.replace(/\D/g, "").slice(0, 6);
    const rb = rrnBack.replace(/\D/g, "").slice(0, 7);
    if (nm) next.set("name", nm);
    if (ad) next.set("addr", ad);
    if (callResult) next.set("callResult", callResult);
    if (agentId) next.set("agentId", agentId);
    if (rf.length === 6) next.set("rrnFront", rf);
    if (rb.length === 7) next.set("rrnBack", rb);
    const qs = next.toString();
    startTransition(() => {
      router.push(`/customers${qs ? `?${qs}` : ""}`);
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    commit();
  }

  function reset() {
    setName("");
    setAddr("");
    setCallResult("");
    setAgentId("");
    setRrnFront("");
    setRrnBack("");
    startTransition(() => {
      router.push("/customers");
    });
  }

  const hasFilter =
    !!name || !!addr || !!callResult || !!agentId || !!rrnFront || !!rrnBack;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1.5 w-48">
        <Label htmlFor="f-name" className="text-xs text-muted-foreground">
          이름
        </Label>
        <Input
          id="f-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          className="h-9"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-64">
        <Label htmlFor="f-addr" className="text-xs text-muted-foreground">
          주소
        </Label>
        <Input
          id="f-addr"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="서울시 종로구"
          className="h-9"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-36">
        <Label className="text-xs text-muted-foreground">통화결과</Label>
        <Select
          value={callResult || ALL}
          onValueChange={(v) => setCallResult(!v || v === ALL ? "" : String(v))}
        >
          <SelectTrigger className="h-9 w-full">
            <span className="truncate">{callResult || "전체"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체</SelectItem>
            {CALL_RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showAgentFilter ? (
        <div className="flex flex-col gap-1.5 w-44">
          <Label className="text-xs text-muted-foreground">담당자</Label>
          <Select
            value={agentId || ALL}
            onValueChange={(v) => setAgentId(!v || v === ALL ? "" : String(v))}
          >
            <SelectTrigger className="h-9 w-full">
              <span className="truncate">
                {agentId
                  ? `${agents.find((a) => a.agentId === agentId)?.name ?? agentId} · ${agentId}`
                  : "전체"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.agentId} value={a.agentId}>
                  {a.name} · {a.agentId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5 w-28">
        <Label htmlFor="f-rrn-front" className="text-xs text-muted-foreground">
          주민 앞 6
        </Label>
        <Input
          id="f-rrn-front"
          value={rrnFront}
          onChange={(e) => setRrnFront(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          placeholder="901201"
          className="h-9 font-mono tabular-nums"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-32">
        <Label htmlFor="f-rrn-back" className="text-xs text-muted-foreground">
          주민 뒤 7
        </Label>
        <Input
          id="f-rrn-back"
          value={rrnBack}
          onChange={(e) => setRrnBack(e.target.value.replace(/\D/g, "").slice(0, 7))}
          inputMode="numeric"
          maxLength={7}
          placeholder="1234567"
          className="h-9 font-mono tabular-nums"
          autoComplete="off"
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
