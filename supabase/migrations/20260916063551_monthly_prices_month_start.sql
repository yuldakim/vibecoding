-- price_month는 "그 달"을 나타내는 값이어야 하는데, unique(client_id,item_id,
-- size_id,price_month)는 날짜가 완전히 같을 때만 막는다. 같은 달 다른 날짜
-- (2026-07-01, 2026-07-15)로 두 번 넣으면 같은 달 기본 단가가 두 개
-- 생겨버린다. 매달 1일만 허용해 이 경로를 막는다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'monthly_prices_price_month_is_month_start'
  ) then
    alter table monthly_prices
      add constraint monthly_prices_price_month_is_month_start
      check (extract(day from price_month) = 1);
  end if;
end;
$$;
