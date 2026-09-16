create table if not exists items (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients (id),
  name text not null,
  is_hidden boolean not null default false,
  is_favorite boolean not null default false,
  last_used_at timestamptz null,
  merged_into_item_id bigint null references items (id),
  created_at timestamptz not null default now(),
  check (merged_into_item_id is null or merged_into_item_id <> id)
);

create unique index if not exists items_client_name_active_key
  on items (client_id, name) where merged_into_item_id is null;

create index if not exists items_merged_into_item_id_idx
  on items (merged_into_item_id);

alter table items enable row level security;

create table if not exists item_aliases (
  id bigint generated always as identity primary key,
  item_id bigint not null references items (id),
  alias_name text not null,
  changed_at timestamptz not null default now(),
  reason text null
);

alter table item_aliases enable row level security;

create or replace function final_item_id(p_item_id bigint) returns bigint
language sql stable as $$
  with recursive chain(id, merged_into) as (
    select id, merged_into_item_id from items where id = p_item_id
    union all
    select i.id, i.merged_into_item_id from items i
      join chain c on i.id = c.merged_into
  )
  cycle id set is_cycle using path
  select coalesce(
    (select id from chain where merged_into is null and not is_cycle limit 1),
    p_item_id
  );
$$;

create or replace function item_ids_in_merge_group(p_item_id bigint) returns setof bigint
language sql stable as $$
  with recursive root as (
    select final_item_id(p_item_id) as id
  ), descendants(id) as (
    select id from root
    union all
    select i.id from items i
      join descendants d on i.merged_into_item_id = d.id
  )
  cycle id set is_cycle using path
  select id from descendants where not is_cycle;
$$;
