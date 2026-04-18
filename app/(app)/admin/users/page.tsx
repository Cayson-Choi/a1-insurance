import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/rbac";
import { listAllUsers } from "@/lib/users/queries";
import { UserTable } from "@/components/admin/user-table";
import { UserFormDialog } from "@/components/admin/user-form-dialog";

export const metadata: Metadata = {
  title: "사용자 관리",
};

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const rows = await listAllUsers();

  const adminCount = rows.filter((r) => r.role === "admin").length;
  const agentCount = rows.filter((r) => r.role === "agent").length;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">사용자 관리</h1>
          <p className="text-sm text-muted-foreground">
            담당자·관리자 계정을 관리합니다. 관리자 <b>{adminCount}</b>명 · 담당자 <b>{agentCount}</b>명
          </p>
        </div>
        <UserFormDialog mode="create">
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-brand text-brand-foreground text-sm font-medium hover:bg-brand-hover transition"
          >
            <UserPlus className="h-4 w-4" />
            사용자 추가
          </button>
        </UserFormDialog>
      </div>

      <UserTable rows={rows} currentAgentId={me.agentId} />

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        💡 <b>초기 비밀번호</b>는 사용자에게 안전한 채널로 전달하세요. 사용자는 처음 로그인 후 관리자에게 재설정을 요청할 수 있습니다.
      </div>
    </div>
  );
}
