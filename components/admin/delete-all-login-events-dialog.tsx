"use client";

import { DeleteAllRecordsDialog } from "@/components/admin/delete-all-records-dialog";
import { deleteAllLoginEventsAction } from "@/lib/logins/actions";

export function DeleteAllLoginEventsDialog() {
  return (
    <DeleteAllRecordsDialog
      title="로그인 이력 전체 삭제"
      triggerLabel="로그인 이력 전체 삭제"
      targetLabel="로그인 이력의 모든 기록"
      description="로그인 성공/실패 기록, IP, 브라우저 정보가 영구 삭제됩니다."
      successMessage={(deleted) => `${deleted}건의 로그인 이력을 삭제했습니다.`}
      action={deleteAllLoginEventsAction}
    />
  );
}
