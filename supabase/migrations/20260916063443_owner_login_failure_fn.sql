-- 사장님 로그인 실패 카운트를 원자적으로 증가시킨다. 애플리케이션이
-- 읽고-고치고-쓰는 방식이면 동시 요청에서 카운트가 누락돼 잠금이
-- 무력화된다(단일 UPDATE는 행 잠금으로 직렬화된다).
create or replace function record_owner_login_failure(p_lock_ms bigint, p_max_fails int)
returns table(owner_login_fail_count int, owner_locked_until timestamptz)
language plpgsql as $$
begin
  return query
  update factory_settings
  set owner_login_fail_count = factory_settings.owner_login_fail_count + 1,
      owner_locked_until = case
        when factory_settings.owner_login_fail_count + 1 >= p_max_fails
          then now() + (p_lock_ms || ' milliseconds')::interval
        else factory_settings.owner_locked_until
      end
  where id = 1
  returning factory_settings.owner_login_fail_count, factory_settings.owner_locked_until;
end;
$$;
