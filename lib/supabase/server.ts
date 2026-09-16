import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role 키를 쓴다 — RLS를 우회하므로 서버 코드(API route, server action)에서만 부른다.
 * 클라이언트 컴포넌트나 브라우저로 전달되는 코드에서 import하지 않는다.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
