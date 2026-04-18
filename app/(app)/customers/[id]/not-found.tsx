import Link from "next/link";
import { UserX } from "lucide-react";

export default function CustomerNotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <UserX className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">고객을 찾을 수 없습니다</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          삭제되었거나 본인에게 배정되지 않은 고객일 수 있습니다.
        </p>
      </div>
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-brand text-brand-foreground text-sm font-medium hover:bg-brand-hover"
      >
        고객 목록으로
      </Link>
    </div>
  );
}
