import { Button } from "@/components/ui/button";
import type { PriceConflict } from "./price-impact";
import { mergeItems } from "./actions";

type Props = {
  clientId: number;
  finalItem: { id: number; name: string };
  usageByItem: { id: number; name: string; usageCount: number }[];
  priceConflicts: PriceConflict[];
  selectedIds: number[];
};

function formatPrice(price: number | null): string {
  return price === null ? "미정" : `${price.toLocaleString()}원`;
}

/** 합치기 미리보기 — 영향받는 송장 수와, 확정 송장에 이미 적용된 단가가 최종 품목과 달라지는 달을 보여준다. */
export function MergePreview({ clientId, finalItem, usageByItem, priceConflicts, selectedIds }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <p className="text-lg">
        최종 품목: <strong>{finalItem.name}</strong>
      </p>
      <ul className="text-lg">
        {usageByItem.map((u) => (
          <li key={u.id}>
            {u.name} — 과거 송장 {u.usageCount}건
          </li>
        ))}
      </ul>

      {priceConflicts.length > 0 && (
        <div className="rounded-lg bg-danger/10 p-3">
          <p className="text-lg text-danger">
            이미 확정된 송장의 단가가 최종 품목과 다릅니다. 합치면 정산 시 이 금액으로 계산됩니다.
          </p>
          <ul className="text-lg text-danger">
            {priceConflicts.map((c, i) => (
              <li key={i}>
                {c.itemName} · {c.sizeName} · {c.month.slice(0, 7)}: {formatPrice(c.sourcePrice)} →{" "}
                {formatPrice(c.finalPrice)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-lg text-danger">되돌릴 수 없습니다. 확인 후 진행하세요.</p>
      <form action={mergeItems}>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="finalItemId" value={finalItem.id} />
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="itemIds" value={id} />
        ))}
        <Button type="submit" variant="danger">
          지금 합치기
        </Button>
      </form>
    </div>
  );
}
