-- lib/notifications/dedupe.ts의 shouldCreateNotification()은 앱 메모리에서만
-- 판정한다 — 두 경로(배치 작업과 사장님 화면 조작 등)가 동시에 판정하면
-- 둘 다 "없음"을 보고 둘 다 insert해 같은 미해결 알림이 중복 생성될 수 있다.
-- 유일성의 최종 근거는 DB가 맡는다(송장번호·sizes.name과 같은 원칙).
--
-- ref_type/ref_id는 nullable이라 순수 unique(kind, ref_type, ref_id)는
-- Postgres가 NULL을 서로 다른 값으로 취급해 막아주지 못한다(NULL = NULL은
-- unknown). coalesce로 NULL을 고정 값으로 바꿔 dedupe.ts의 "null===null"
-- 판정과 같은 결과가 나오게 한다.
do $$
begin
  if not exists (
    select 1 from pg_indexes where indexname = 'notifications_dedupe_key'
  ) then
    create unique index notifications_dedupe_key
      on notifications (kind, coalesce(ref_type, ''), coalesce(ref_id, -1))
      where not is_resolved;
  end if;
end;
$$;
