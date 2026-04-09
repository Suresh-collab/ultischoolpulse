import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white rounded-[var(--radius-md)] hover:bg-primary-hover",
        secondary:
          "bg-white border border-border text-text-primary rounded-[var(--radius-md)] hover:bg-primary-light",
        destructive:
          "bg-error text-white rounded-[var(--radius-md)] hover:bg-error/90",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        compact: "h-9 px-4 py-2 text-xs",
        large: "h-12 px-6 py-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
