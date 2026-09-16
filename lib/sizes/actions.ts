"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import type { Size } from "./queries";

const SELECT_COLS = "id, name, is_default, sort_order";

/** 제로폭 문자 제거 + 공백 정규화. 대소문자·NFC 정규화는 DB의 name_normalized(생성 컬럼)가 맡는다. */
function cleanName(rawName: string): string {
  return rawName
    .replace(/[​-‍﻿]/g, "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * 공백류·유니코드 정규화(NFC)·대소문자 차이만 있는 이름은 새로 만들지 않고
 * 기존 사이즈를 재사용한다. 앱 계층의 조회-후-삽입은 동시 요청에서 경합이
 * 생기므로, 중복 방지의 최종 근거는 DB의 `sizes_name_normalized_key`
 * unique 인덱스다 — 여기서는 upsert(ignoreDuplicates)로 그 제약에 원자적으로
 * 기댄다.
 */
export async function addSize(rawName: string): Promise<Size> {
  const name = cleanName(rawName);
  if (!name) throw new Error("사이즈 이름을 입력하세요.");

  const supabase = createServiceClient();

  const { data: inserted, error: insertError } = await supabase
    .from("sizes")
    .upsert({ name }, { onConflict: "name_normalized", ignoreDuplicates: true })
    .select(SELECT_COLS);
  if (insertError) throw insertError;
  if (inserted?.length) {
    revalidatePath("/sizes");
    return inserted[0];
  }

  // 충돌(이미 있는 이름) — DB가 계산한 것과 같은 정규화 키로 기존 행을 찾는다.
  const key = name.toLowerCase();
  const { data: existing, error: findError } = await supabase
    .from("sizes")
    .select(SELECT_COLS)
    .eq("name_normalized", key)
    .single();
  if (findError) throw findError;
  return existing;
}
