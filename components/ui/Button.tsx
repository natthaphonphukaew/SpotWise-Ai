import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm border px-4 py-2.5 text-[15px] font-medium leading-none transition-colors";
const variants: Record<Variant, string> = {
  primary: "border-ink bg-ink text-paper hover:bg-black",
  secondary: "border-ink text-ink hover:bg-ink/5",
  ghost: "border-transparent text-ink underline decoration-rule underline-offset-4 hover:decoration-ink",
};

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
