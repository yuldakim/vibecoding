import { createServiceClient } from "@/lib/supabase/server";

export type Size = {
  id: number;
  name: string;
  is_default: boolean;
  sort_order: number;
};

/**
 * 사용 빈도순 정렬은 아직 의미가 없다 — 송장(T-009)·송장 줄(T-037)이 없어
 * 사이즈 사용 이력을 셀 데이터가 없다. 지금은 sort_order, name으로만 정렬한다.
 */
export async function getSizes(): Promise<Size[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sizes")
    .select("id, name, is_default, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
