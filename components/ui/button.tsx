import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-primary hover:bg-primary-hover text-white",
  secondary: "border border-border text-foreground hover:bg-black/5",
  danger: "bg-danger hover:bg-danger-hover text-white",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    // type="button"이 기본값 — 안 넘기면 <button>의 HTML 기본값(submit)이 되어
    // form 안의 모든 버튼이 제출 버튼이 된다(스프레드보다 앞에 둬야 호출자가
    // type="submit"으로 덮어쓸 수 있다).
    <button
      type="button"
      {...props}
      className={`h-14 min-w-11 rounded-lg px-6 text-lg font-semibold disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
    />
  );
}
