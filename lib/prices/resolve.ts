import { createServiceClient } from "../supabase/server.ts";

export type ResolvedPrice = {
  /** null이면 미정 — §12 단가 미정 목록으로 보낸다. */
  unitPrice: number | null;
  source: "line_exception" | "monthly" | "undefined";
};

type ResolveParams = {
  clientId: number;
  itemId: number;
  sizeId: number;
  /** 실제 납품일(YYYY-MM-DD, Postgres date 컬럼에서 그대로 읽은 값). 정산월이
   *  아니라 이 날짜의 달로 단가를 찾는다 — 이월 송장(§17)도 이 규칙 그대로면
   *  자동으로 맞는 달 단가가 잡힌다. */
  deliveryDate: string;
  /** 줄 예외 단가(§11). `settlement_lines.override_unit_price`를 그대로 넘긴다. */
  lineExceptionPrice?: number | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 송장 줄의 적용 단가를 찾는다. 우선순위: 줄 예외 단가 > 그 달 기본 단가 >
 * 미정(도메인-불변식.md "단가"). 품목이 합쳐졌으면(T-033) 최종 품목의
 * 단가표를 쓴다 — final_item_id() RPC로 합치기 체인을 끝까지 따라간다.
 *
 * DB 조회가 실패하면 조용히 "미정"이나 원래 품목 단가로 넘어가지 않고
 * 예외를 던진다 — 정산 금액의 기반 함수라, 실패를 삼키면 틀린 금액이
 * 정상 결과와 구분되지 않은 채로 나간다.
 */
export async function resolveLinePrice(
  supabase: ReturnType<typeof createServiceClient>,
  params: ResolveParams,
): Promise<ResolvedPrice> {
  if (params.lineExceptionPrice !== undefined && params.lineExceptionPrice !== null) {
    if (!Number.isInteger(params.lineExceptionPrice)) {
      throw new Error(`lineExceptionPrice는 정수(원)여야 합니다: ${params.lineExceptionPrice}`);
    }
    return { unitPrice: params.lineExceptionPrice, source: "line_exception" };
  }
  if (!DATE_RE.test(params.deliveryDate)) {
    throw new Error(`deliveryDate는 YYYY-MM-DD 형식이어야 합니다: ${params.deliveryDate}`);
  }

  const { data: finalIdData, error: finalIdError } = await supabase.rpc("final_item_id", {
    p_item_id: params.itemId,
  });
  if (finalIdError) throw new Error(`품목 합치기 정보를 확인하지 못했습니다: ${finalIdError.message}`);
  const finalItemId = finalIdData as number;

  const priceMonth = `${params.deliveryDate.slice(0, 7)}-01`;

  const { data, error } = await supabase
    .from("monthly_prices")
    .select("unit_price")
    .eq("client_id", params.clientId)
    .eq("item_id", finalItemId)
    .eq("size_id", params.sizeId)
    .eq("price_month", priceMonth)
    .maybeSingle();
  if (error) throw new Error(`단가를 조회하지 못했습니다: ${error.message}`);

  // 행이 아예 없는 경우와, 행은 있는데 값이 미정(null)인 경우를 같은
  // "undefined"로 합친다 — 둘 다 §12 단가 미정 목록으로 가야 할 같은
  // 상태인데 source로 구분하면 호출자가 한쪽을 놓치기 쉽다.
  if (!data || data.unit_price === null) return { unitPrice: null, source: "undefined" };
  return { unitPrice: data.unit_price, source: "monthly" };
}
