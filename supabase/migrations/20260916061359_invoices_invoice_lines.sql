create sequence if not exists invoice_no_seq;

create table if not exists invoices (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients (id),
  delivery_date date not null,
  invoice_no int null unique,
  status text not null check (status in ('draft', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz null,
  printed_at timestamptz null,
  last_reprinted_at timestamptz null,
  cancelled_at timestamptz null,
  check (status <> 'draft' or invoice_no is null),
  check (status = 'draft' or invoice_no is not null)
);

create index if not exists invoices_client_delivery_idx
  on invoices (client_id, delivery_date);

alter table invoices enable row level security;

create table if not exists invoice_lines (
  id bigint generated always as identity primary key,
  invoice_id bigint not null references invoices (id),
  item_id bigint not null references items (id),
  item_name_snapshot text not null,
  size_id bigint not null references sizes (id),
  quantity int not null check (quantity > 0),
  note text null,
  line_order int not null
);

create index if not exists invoice_lines_invoice_id_idx on invoice_lines (invoice_id);
create index if not exists invoice_lines_item_id_idx on invoice_lines (item_id);

alter table invoice_lines enable row level security;
