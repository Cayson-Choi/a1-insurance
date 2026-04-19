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
          src="/brand/jg-orm-logo.png"
          alt={COMPANY.nameKo}
          width={300}
          height={150}
          priority={priority}
          unoptimized
          className="h-32 w-auto"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/brand/jg-orm-logo.png"
        alt={COMPANY.nameKo}
        width={200}
        height={100}
        priority={priority}
        unoptimized
        className={cn(
          "w-auto",
          variant === "mark" ? "h-8" : "h-10",
        )}
      />
    </div>
  );
}
