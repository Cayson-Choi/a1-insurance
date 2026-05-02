"use client";

import { DeleteAllRecordsDialog } from "@/components/admin/delete-all-records-dialog";
import { deleteAllCustomersAction } from "@/lib/customers/actions";

export function DeleteAllCustomersDialog() {
  return (
    <DeleteAllRecordsDialog
      title="고객 전체 삭제"
      triggerLabel="고객 전체 삭제"
      targetLabel="고객 목록의 모든 고객 데이터"
      description="고객 정보, 주민번호 암호문, 메모 등 모든 고객 데이터가 영구 삭제됩니다. 변경 이력에는 전체 삭제 기록 1건이 남습니다."
      successMessage={(deleted) => `${deleted}건의 고객 데이터를 삭제했습니다.`}
      action={deleteAllCustomersAction}
      className="h-9 px-3 text-sm"
    />
  );
}
