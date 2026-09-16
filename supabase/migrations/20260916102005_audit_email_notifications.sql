create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  target_type text not null,
  target_id bigint not null,
  action text not null,
  before jsonb null,
  after jsonb null,
  actor_role text not null check (actor_role in ('staff', 'owner')),
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;

create table if not exists email_logs (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients (id),
  settlement_id bigint null references settlements (id),
  kind text not null check (kind in ('price_check_request', 'settlement_final', 'settlement_revision')),
  subject text not null,
  body text not null,
  file_name text not null,
  success boolean not null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

alter table email_logs enable row level security;

create table if not exists notifications (
  id bigint generated always as identity primary key,
  kind text not null check (kind in (
    'owner_price_missing',
    'owner_price_check_request_needed',
    'owner_final_review_needed',
    'owner_approved_awaiting_send',
    'owner_send_date_passed',
    'owner_email_failed',
    'owner_revision_review_needed',
    'staff_owner_review_needed',
    'staff_auto_send_upcoming',
    'staff_send_failed'
  )),
  target_role text not null check (target_role in ('staff', 'owner', 'both')),
  ref_type text null,
  ref_id bigint null,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

alter table notifications enable row level security;
