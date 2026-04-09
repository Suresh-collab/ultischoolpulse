import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, color, style, ...props }, ref) => {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          className
        )}
        style={{
          backgroundColor: color ? `${color}20` : "var(--color-primary-light)",
          color: color || "var(--color-primary)",
          ...style,
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
