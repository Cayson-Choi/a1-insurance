import Image from "next/image";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/company";

type Variant = "horizontal" | "stacked" | "mark";

export function Logo({
  variant = "horizontal",
  className,
  priority,
}: {
  variant?: Variant;
  className?: string;
  priority?: boolean;
}) {
  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <Image
          src="/brand/aonefs-ci.gif"
          alt={COMPANY.nameKo}
          width={220}
          height={96}
          priority={priority}
          unoptimized
          className="h-24 w-auto"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/brand/aonefs-logo.png"
        alt={COMPANY.nameKo}
        width={200}
        height={32}
        priority={priority}
        unoptimized
        className={cn(
          "w-auto",
          variant === "mark" ? "h-6" : "h-8",
        )}
      />
    </div>
  );
}
