import Link from "next/link";
import {
  ArrowRight,
  Eye,
  FileSpreadsheet,
  Inbox,
  KeyRound,
  LogOut,
  PencilLine,
  ShieldAlert,
  UserMinus,
  UserPlus,
  Users,
  UserCog,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { diffFields } from "@/lib/audit/diff";
import type { AuditRow } from "@/lib/audit/queries";

const ACTION_META: Record<
  AuditRow["action"],
  { label: string; className: string; icon: typeof Eye }
> = {
  edit: {
    label: "편집",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: PencilLine,
  },
  agent_change: {
    label: "담당자 변경",
    className: "bg-brand-muted text-[#155e75] border-brand/30",
    icon: UserCog,
  },
  bulk_change: {
    label: "일괄 변경",
    className: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Users,
  },
  rrn_decrypt: {
    label: "주민번호 조회",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: Eye,
  },
  user_create: {
    label: "사용자 생성",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: UserPlus,
  },
  user_update: {
    label: "사용자 수정",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    icon: UserCog,
  },
  user_delete: {
    label: "사용자 삭제",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: UserMinus,
  },
  password_reset: {
    label: "비밀번호 리셋",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: KeyRound,
  },
  force_logout: {
    label: "강제 로그아웃",
    className: "bg-orange-50 text-orange-700 border-orange-200",
    icon: LogOut,
  },
  import: {
    label: "엑셀 일괄등록",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: FileSpreadsheet,
  },
};

// 미지정 액션 fallback (호환성).
const UNKNOWN_META = {
  label: "기타",
  className: "bg-slate-50 text-slate-700 border-slate-200",
  icon: ShieldAlert,
};

function Summary({ row }: { row: AuditRow }) {
  if (row.action === "rrn_decrypt") {
    return <span className="text-muted-foreground">주민번호 복호화 열람</span>;
  }
  if (row.action === "agent_change" || row.action === "bulk_change") {
    const b = (row.before as { agentId?: string } | null)?.agentId ?? "미배정";
    const a = (row.after as { agentId?: string } | null)?.agentId ?? "미배정";
    return (
      <span className="font-mono text-xs">
        {b} <ArrowRight className="inline h-3 w-3" /> {a}
      </span>
    );
  }
  if (row.action === "import") {
    const a = row.after as
      | { total?: number; updated?: number; inserted?: number }
      | null;
    return (
      <span className="text-xs">
        총 <b>{a?.total ?? 0}</b>건 — 신규 {a?.inserted ?? 0} · 갱신 {a?.updated ?? 0}
      </span>
    );
  }
  if (row.action === "user_create" || row.action === "user_delete") {
    const target = (row.after ?? row.before) as
      | { agentId?: string; name?: string; role?: string }
      | null;
    return (
      <span className="text-xs">
        {target?.name ?? "—"} · {target?.agentId ?? "—"}
        {target?.role ? ` (${target.role})` : ""}
      </span>
    );
  }
  if (row.action === "password_reset" || row.action === "force_logout") {
    const t = row.after as { agentId?: string; name?: string } | null;
    return (
      <span className="text-xs">
        대상: {t?.name ?? "—"} · {t?.agentId ?? "—"}
      </span>
    );
  }
  const changes = diffFields(row.before, row.after);
  if (!changes.length) {
    return <span className="text-muted-foreground">변경 내용 없음</span>;
  }
  const first = changes[0];
  const more = changes.length - 1;
  return (
    <span className="text-xs">
      <b>{first.label}</b>
      <span className="text-muted-foreground"> : </span>
      <span className="text-muted-foreground line-through">{first.before}</span>
      <span> → </span>
      <span>{first.after}</span>
      {more > 0 ? <span className="text-muted-foreground"> 외 {more}건</span> : null}
    </span>
  );
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 py-16 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium text-foreground">
          조건에 맞는 이력이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-44">일시</TableHead>
            <TableHead className="w-32">작업자</TableHead>
            <TableHead className="w-32">액션</TableHead>
            <TableHead className="w-40">대상 고객</TableHead>
            <TableHead>내용 요약</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const meta = ACTION_META[r.action] ?? UNKNOWN_META;
            const Icon = meta.icon;
            return (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums text-xs">
                  {formatDateTime(r.createdAt)}
                </TableCell>
                <TableCell className="text-sm">
                  <span className="font-medium">{r.actorName ?? "—"}</span>
                  <span className="ml-1 text-muted-foreground font-mono text-[11px]">
                    {r.actorAgentId}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`gap-1 text-xs ${meta.className}`}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.customerId ? (
                    <Link
                      href={`/customers/${r.customerId}`}
                      className="text-sm text-brand-accent hover:underline"
                    >
                      {r.customerName ?? r.customerId.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm max-w-xl">
                  <Summary row={r} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
