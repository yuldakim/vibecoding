create table if not exists sizes (
  id bigint generated always as identity primary key,
  name text not null unique check (name = btrim(name) and name <> ''),
  is_default boolean not null default false,
  sort_order int not null default 100
);

alter table sizes enable row level security;

insert into sizes (name, is_default, sort_order) values
  ('싱글', true, 10),
  ('슈퍼싱글', true, 20),
  ('퀸', true, 30),
  ('킹', true, 40)
on conflict (name) do nothing;
