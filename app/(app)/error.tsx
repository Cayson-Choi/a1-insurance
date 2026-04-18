"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">문제가 발생했습니다</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          일시적인 오류일 수 있습니다. 다시 시도하거나 관리자에게 문의해주세요.
        </p>
      </div>
      {error.digest ? (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground">
          오류 ID: {error.digest}
        </div>
      ) : null}
      <div className="flex justify-center gap-2">
        <Button
          type="button"
          onClick={reset}
          className="bg-brand text-brand-foreground hover:bg-brand-hover"
        >
          <RotateCw className="h-4 w-4" />
          다시 시도
        </Button>
      </div>
    </div>
  );
}
