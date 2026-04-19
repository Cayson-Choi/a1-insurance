"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
const DEBOUNCE_MS = 400;

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

  const [name, setName] = useState<string>(sp.get("name") ?? "");
  const [addr, setAddr] = useState<string>(sp.get("addr") ?? "");
  const [phone, setPhone] = useState<string>(sp.get("phone") ?? "");
  const [callResult, setCallResult] = useState<string>(sp.get("callResult") ?? "");
  const [agentId, setAgentId] = useState<string>(sp.get("agentId") ?? "");
  const [rrnFront, setRrnFront] = useState<string>(sp.get("rrnFront") ?? "");
  const [rrnBack, setRrnBack] = useState<string>(sp.get("rrnBack") ?? "");
  const [byFrom, setByFrom] = useState<string>(sp.get("byFrom") ?? "");
  const [byTo, setByTo] = useState<string>(sp.get("byTo") ?? "");

  const firstRenderRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback(
    (immediate: boolean) => {
      const next = new URLSearchParams();
      const nm = name.trim();
      const ad = addr.trim();
      const ph = phone.replace(/\D/g, "");
      const rf = rrnFront.replace(/\D/g, "").slice(0, 6);
      const rb = rrnBack.replace(/\D/g, "").slice(0, 7);
      const yf = byFrom.replace(/\D/g, "").slice(0, 4);
      const yt = byTo.replace(/\D/g, "").slice(0, 4);
      if (nm) next.set("name", nm);
      if (ad) next.set("addr", ad);
      if (ph) next.set("phone", ph);
      if (callResult) next.set("callResult", callResult);
      if (agentId) next.set("agentId", agentId);
      if (rf.length === 6) next.set("rrnFront", rf);
      if (rb.length === 7) next.set("rrnBack", rb);
      if (yf.length === 4) next.set("byFrom", yf);
      if (yt.length === 4) next.set("byTo", yt);
      const qs = next.toString();

      const run = () => {
        startTransition(() => {
          router.push(`/customers${qs ? `?${qs}` : ""}`);
        });
      };

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (immediate) run();
      else debounceRef.current = setTimeout(run, DEBOUNCE_MS);
    },
    [name, addr, phone, callResult, agentId, rrnFront, rrnBack, byFrom, byTo, router],
  );

  // 입력 변경 감지 → 자동 검색 (텍스트는 debounce, 드롭다운은 즉시)
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    commit(false);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, addr, phone, rrnFront, rrnBack, byFrom, byTo, commit]);

  useEffect(() => {
    if (firstRenderRef.current) return;
    commit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callResult, agentId]);

  function reset() {
    setName("");
    setAddr("");
    setPhone("");
    setCallResult("");
    setAgentId("");
    setRrnFront("");
    setRrnBack("");
    setByFrom("");
    setByTo("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(() => {
      router.push("/customers");
    });
  }

  const hasFilter =
    !!name || !!addr || !!phone || !!callResult || !!agentId || !!rrnFront || !!rrnBack || !!byFrom || !!byTo;

  return (
    <div className="flex flex-wrap items-end gap-2 md:gap-3 rounded-lg border bg-card p-3 md:p-4 shadow-sm">
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-36">
        <Label htmlFor="f-name" className="text-xs text-muted-foreground">
          이름
        </Label>
        <Input
          id="f-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-52">
        <Label htmlFor="f-addr" className="text-xs text-muted-foreground">
          주소
        </Label>
        <Input
          id="f-addr"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-32">
        <Label htmlFor="f-phone" className="text-xs text-muted-foreground">
          전화번호
        </Label>
        <Input
          id="f-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
          inputMode="numeric"
          className="h-9 font-mono tabular-nums"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-28">
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
        <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-36">
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
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-28">
        <Label htmlFor="f-rrn-front" className="text-xs text-muted-foreground">
          주민 앞 6
        </Label>
        <Input
          id="f-rrn-front"
          value={rrnFront}
          onChange={(e) => setRrnFront(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          className="h-9 font-mono tabular-nums"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-32">
        <Label htmlFor="f-rrn-back" className="text-xs text-muted-foreground">
          주민 뒤 7
        </Label>
        <Input
          id="f-rrn-back"
          value={rrnBack}
          onChange={(e) => setRrnBack(e.target.value.replace(/\D/g, "").slice(0, 7))}
          inputMode="numeric"
          maxLength={7}
          className="h-9 font-mono tabular-nums"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5 w-[calc(50%-0.25rem)] md:w-40">
        <Label className="text-xs text-muted-foreground">출생연도 범위</Label>
        <div className="flex items-center gap-1">
          <Input
            id="f-by-from"
            value={byFrom}
            onChange={(e) => setByFrom(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            placeholder="1960"
            className="h-9 font-mono tabular-nums"
            autoComplete="off"
            aria-label="출생연도 시작"
          />
          <span className="text-muted-foreground text-xs shrink-0">~</span>
          <Input
            id="f-by-to"
            value={byTo}
            onChange={(e) => setByTo(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            placeholder="1970"
            className="h-9 font-mono tabular-nums"
            autoComplete="off"
            aria-label="출생연도 종료"
          />
        </div>
      </div>

      <div className="flex items-end gap-1">
        <div
          className={`flex items-center justify-center h-9 w-6 text-muted-foreground transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}
          aria-live="polite"
          aria-label={pending ? "검색 중" : undefined}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
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
      {/* 자동 검색 동작 — 입력만 하면 결과 갱신. Enter 키는 불필요하지만 form이 아니므로 submit 이벤트 없음 */}
      <div className="sr-only" aria-hidden>
        <Search className="h-0 w-0" />
      </div>
    </div>
  );
}
