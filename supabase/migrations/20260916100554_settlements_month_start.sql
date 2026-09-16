-- monthly_prices와 같은 문제: unique(client_id,period_month,revision_no)는
-- 날짜가 완전히 같을 때만 막는다. 같은 7월에 2026-07-01과 2026-07-31처럼
-- 다른 날짜로 revision_no=0을 두 번 넣으면 같은 달 최초 정산서가 두 개
-- 생기고, 이월 판정(first_approved_at 기준 min 계산)에서 한쪽이 빠진다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settlements_period_month_is_month_start'
  ) then
    alter table settlements
      add constraint settlements_period_month_is_month_start
      check (extract(day from period_month) = 1);
  end if;
end;
$$;
