"use client";

import { useState, useTransition } from "react";
import { SizeSelect } from "@/components/size-select/size-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateLine, deleteLine } from "./actions";
import { MAX_QUANTITY } from "./constants";
import type { Size } from "@/lib/sizes/queries";

type Props = {
  lineId: number;
  itemName: string;
  sizeId: number;
  quantity: number;
  sizes: Size[];
};

/** lineId는 DB가 부여한 실제 행 id라 재사용되지 않는다 — 목록이 줄어들거나
 *  순서가 바뀌어도 React key가 항상 같은 줄을 정확히 가리킨다(T-037에서
 *  URL 인코딩 방식일 때 겪었던 "다른 줄의 입력 상태가 섞이는" 버그의 원인
 *  중 하나였다). 다만 lineId만으로는 부족하다 — 이 줄 자신의 사이즈·수량이
 *  다른 기기/탭에서 바뀌면 이 컴포넌트는 리마운트되지 않고 옛 값을 계속
 *  보여준다. 그래서 부모(page.tsx)가 key에 sizeId·quantity를 같이 넣어서,
 *  서버 값이 실제로 바뀔 때만 리마운트되게 한다 — 이 컴포넌트 안에서는
 *  아무 것도 더 안 해도 된다. */
export function LineRow({ lineId, itemName, sizeId, quantity, sizes }: Props) {
  const [selectedSizeId, setSelectedSizeId] = useState(sizeId);
  const [qtyInput, setQtyInput] = useState(String(quantity));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // "저장"을 안 눌렀는데 화면 값이 실제 저장된 값과 다른 상태 — 이 경고가
  // 없으면 사장님/직원이 화면만 보고 저장된 줄 알고 넘어갈 수 있다.
  const isDirty = selectedSizeId !== sizeId || qtyInput !== String(quantity);

  function save() {
    const qty = Number(qtyInput);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QUANTITY) {
      setError(`수량은 1~${MAX_QUANTITY}장 사이의 정수여야 합니다.`);
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await updateLine(lineId, selectedSizeId, qty);
      if (!result.ok) setError(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteLine(lineId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{itemName}</span>
        <Button variant="danger" onClick={remove} disabled={pending}>
          삭제
        </Button>
      </div>
      <SizeSelect sizes={sizes} initialSelectedId={selectedSizeId} onSelect={(s) => setSelectedSizeId(s.id)} />
      <div className="flex flex-wrap items-end gap-3">
        <Input
          id={`qty-${lineId}`}
          label="수량(장)"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_QUANTITY}
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
        />
        <Button onClick={save} disabled={pending}>
          저장
        </Button>
        {isDirty && !pending && <span className="text-lg text-danger">아직 저장 안 됨</span>}
      </div>
      {error && <p className="text-lg text-danger">{error}</p>}
    </div>
  );
}
