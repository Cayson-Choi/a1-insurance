"use client";

import { DeleteAllRecordsDialog } from "@/components/admin/delete-all-records-dialog";
import { deleteAllAuditLogsAction } from "@/lib/audit/actions";

export function DeleteAllAuditLogsDialog() {
  return (
    <DeleteAllRecordsDialog
      title="변경 이력 전체 삭제"
      triggerLabel="변경 이력 전체 삭제"
      targetLabel="변경 이력의 모든 기록"
      description="고객 변경, 사용자 관리, 엑셀 등록 등 모든 변경 이력이 영구 삭제됩니다."
      successMessage={(deleted) => `${deleted}건의 변경 이력을 삭제했습니다.`}
      action={deleteAllAuditLogsAction}
    />
  );
}
