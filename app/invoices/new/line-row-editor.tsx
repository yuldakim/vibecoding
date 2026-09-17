"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SizeSelect } from "@/components/size-select/size-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Size } from "@/lib/sizes/queries";
import { encodeLine, MAX_QUANTITY } from "./line-codec";

type Props = {
  baseUrl: string; // 예: "/invoices/new?clientId=3&q=..&itemQ=.." (line 파라미터는 안 실려 있음)
  /** 이 줄을 뺀 나머지 줄들의 "itemId:sizeId:quantity:lineKey" 인코딩(원래
   *  순서 그대로). 저장 시 `index` 위치에 다시 끼워 넣어 줄 순서를 지킨다 —
   *  그냥 맨 뒤에 붙이면 다른 LineRowEditor 인스턴스가 엉뚱한 줄의 상태를
   *  들고 있게 된다(React가 위치로 컴포넌트를 재사용하기 때문). */
  otherLines: string[];
  index: number;
  itemId: number;
  itemName: string;
  sizeId: number;
  quantity: number;
  lineKey: number;
  sizes: Size[];
};

/** 사이즈·수량은 즉시 서버에 저장되지 않는다(T-041이 나중에 영속화) — 저장을
 *  누르면 URL의 line= 목록만 갱신된다. 수량은 0·음수·과도하게 큰 값을 거부한다(§5). */
export function LineRowEditor({
  baseUrl,
  otherLines,
  index,
  itemId,
  itemName,
  sizeId,
  quantity,
  lineKey,
  sizes,
}: Props) {
  const router = useRouter();
  const [selectedSizeId, setSelectedSizeId] = useState(sizeId);
  const [qtyInput, setQtyInput] = useState(String(quantity));
  const [error, setError] = useState("");

  function buildUrl(lines: string[]) {
    const [path, query] = baseUrl.split("?");
    const params = new URLSearchParams(query ?? "");
    for (const l of lines) params.append("line", l);
    return `${path}?${params.toString()}`;
  }

  function save() {
    const qty = Number(qtyInput);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QUANTITY) {
      setError(`수량은 1~${MAX_QUANTITY}장 사이의 정수여야 합니다.`);
      return;
    }
    setError("");
    const encoded = encodeLine({ itemId, sizeId: selectedSizeId, quantity: qty, lineKey });
    const next = [...otherLines];
    next.splice(index, 0, encoded);
    router.push(buildUrl(next));
  }

  function remove() {
    router.push(buildUrl(otherLines));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{itemName}</span>
        <Button variant="danger" onClick={remove}>
          삭제
        </Button>
      </div>
      <SizeSelect sizes={sizes} initialSelectedId={selectedSizeId} onSelect={(s) => setSelectedSizeId(s.id)} />
      <div className="flex flex-wrap items-end gap-3">
        <Input
          id={`qty-${lineKey}`}
          label="수량(장)"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_QUANTITY}
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
        />
        <Button onClick={save}>저장</Button>
      </div>
      {error && <p className="text-lg text-danger">{error}</p>}
    </div>
  );
}
