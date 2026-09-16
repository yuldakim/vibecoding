create table if not exists clients (
  id bigint generated always as identity primary key,
  name text not null,
  contact_name text not null,
  contact_email text not null,
  phone text not null,
  address text not null,
  auto_send_day int not null check (auto_send_day between 1 and 31),
  owner_review_day int not null check (owner_review_day between 1 and 31),
  email_subject_template text not null default '',
  email_body_template text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table clients enable row level security;
