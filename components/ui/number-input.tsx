import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  id: string;
  label: string;
};

/** 수량·금액용 숫자 입력. type=text + inputMode=numeric으로 스피너 화살표 없이 큰 숫자 키패드만 띄운다. */
export function NumberInput({ id, label, className = "", ...props }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-lg">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        {...props}
        className={`h-14 w-full rounded-lg border border-border px-4 text-lg ${className}`}
      />
    </div>
  );
}
