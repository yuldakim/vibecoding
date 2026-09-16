create table if not exists settlements (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients (id),
  period_month date not null,
  revision_no int not null default 0,
  status text not null check (status in ('draft','pending_review','approved','needs_reapproval','sent')),
  total_supply_amount int not null default 0,
  vat_amount int not null default 0,
  total_amount int not null default 0,
  approved_at timestamptz null,
  first_approved_at timestamptz null,
  send_scheduled_date date null,
  sent_at timestamptz null,
  revision_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, period_month, revision_no)
);

create index if not exists settlements_client_period_idx
  on settlements (client_id, period_month);

alter table settlements enable row level security;

create table if not exists settlement_lines (
  id bigint generated always as identity primary key,
  settlement_id bigint not null references settlements (id),
  invoice_line_id bigint not null references invoice_lines (id),
  applied_unit_price int not null,
  override_unit_price int null,
  supply_amount int not null,
  is_carried_over boolean not null default false,
  note text null,
  unique (settlement_id, invoice_line_id)
);

create index if not exists settlement_lines_invoice_line_id_idx
  on settlement_lines (invoice_line_id);

alter table settlement_lines enable row level security;
