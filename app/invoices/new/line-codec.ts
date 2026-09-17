export type ParsedLine = { itemId: number; sizeId: number; quantity: number; lineKey: number };

export const MAX_LINES = 20;
export const MAX_QUANTITY = 9999;

/** "itemId:sizeId:quantity:lineKey" 인코딩 하나를 해석한다. 수량은 §5
 *  "0·음수 차단"을 여기서부터 막는다 — URL을 직접 조작해도 통과 못 한다.
 *  lineKey는 이 줄의 신원을 추적하는 값(추가될 때 한 번 생성, 이후 안 바뀜) —
 *  같은 품목이 여러 줄일 수 있어(§6) itemId만으로는 줄을 구분할 수 없다. */
export function parseLine(raw: string): ParsedLine | null {
  const parts = raw.split(":").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isSafeInteger)) return null;
  const [itemId, sizeId, quantity, lineKey] = parts;
  if (itemId <= 0 || sizeId <= 0 || lineKey <= 0) return null;
  if (quantity <= 0 || quantity > MAX_QUANTITY) return null;
  return { itemId, sizeId, quantity, lineKey };
}

export function encodeLine(line: ParsedLine): string {
  return `${line.itemId}:${line.sizeId}:${line.quantity}:${line.lineKey}`;
}
