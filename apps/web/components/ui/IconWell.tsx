import { cn } from "@/lib/cn";

export function IconWell({
  children,
  variant = "inset",
  className,
}: {
  children: React.ReactNode;
  variant?: "inset" | "accent";
  className?: string;
}) {
  return (
    <div
      className={cn(variant === "accent" ? "icon-well-dark" : "icon-well", className)}
      aria-hidden
    >
      {children}
    </div>
  );
}
