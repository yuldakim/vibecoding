"use client";

import { useState, useTransition } from "react";
import { upsertMonthlyPrice } from "./actions";

type Props = {
  clientId: number;
  itemId: number;
  sizeId: number;
  priceMonth: string;
  initialValue: number | null;
};

/**
 * 콤마(화면 표시용으로 우리가 넣은 것)만 떼어내고, 남은 문자가 숫자가
 * 아니면 입력을 통째로 거부한다(null). 소수점·음수·글자를 조용히 다른
 * 정수로 바꿔버리면 안 된다 — "3,000.00" 붙여넣기가 300000으로 저장되는
 * 사고가 여기서 났었다.
 */
function parseDigits(raw: string): string | null {
  const withoutCommas = raw.replace(/,/g, "");
  if (withoutCommas !== "" && !/^\d+$/.test(withoutCommas)) return null;
  return withoutCommas;
}

function formatDisplay(digits: string): string {
  return digits === "" ? "" : Number(digits).toLocaleString();
}

export function PriceCell({ clientId, itemId, sizeId, priceMonth, initialValue }: Props) {
  const [value, setValue] = useState(formatDisplay(initialValue == null ? "" : String(initialValue)));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, startTransition] = useTransition();

  function handleChange(raw: string) {
    const digits = parseDigits(raw);
    if (digits === null) {
      setStatus("error");
      setErrorMsg("숫자만 입력하세요.");
      return;
    }
    setStatus("idle");
    setValue(formatDisplay(digits));
  }

  function save() {
    const digitsOnly = value.replace(/,/g, "");
    startTransition(async () => {
      const result = await upsertMonthlyPrice(clientId, itemId, sizeId, priceMonth, digitsOnly);
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={save}
        placeholder="미정"
        className={`h-14 w-28 rounded-lg border px-2 text-lg ${
          value === "" ? "border-danger text-danger placeholder:text-danger" : "border-border"
        }`}
      />
      {pending && <span className="text-sm text-zinc-600">저장 중…</span>}
      {!pending && status === "saved" && <span className="text-sm text-primary">저장됨</span>}
      {!pending && status === "error" && <span className="text-sm text-danger">{errorMsg}</span>}
    </div>
  );
}
