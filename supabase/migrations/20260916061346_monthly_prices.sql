create table if not exists monthly_prices (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients (id),
  item_id bigint not null references items (id),
  size_id bigint not null references sizes (id),
  price_month date not null,
  unit_price int null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, item_id, size_id, price_month)
);

create index if not exists monthly_prices_client_month_idx
  on monthly_prices (client_id, price_month);

alter table monthly_prices enable row level security;

create table if not exists price_change_history (
  id bigint generated always as identity primary key,
  monthly_price_id bigint not null references monthly_prices (id),
  old_price int null,
  new_price int null,
  changed_by_role text not null check (changed_by_role in ('staff', 'owner')),
  changed_at timestamptz not null default now()
);

alter table price_change_history enable row level security;
