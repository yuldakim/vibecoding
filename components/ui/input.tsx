import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
};

/** label을 필수 prop으로 받아 라벨 없는 입력창을 구조적으로 막는다. */
export function Input({ id, label, className = "", ...props }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-lg">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={`h-14 w-full rounded-lg border border-border px-4 text-lg ${className}`}
      />
    </div>
  );
}
