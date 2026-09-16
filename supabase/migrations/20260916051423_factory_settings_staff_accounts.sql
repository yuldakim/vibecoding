create table if not exists factory_settings (
  id int primary key check (id = 1),
  factory_name text not null,
  ceo_name text not null,
  business_reg_no text not null,
  address text not null,
  phone text not null,
  site_email_address text not null,
  owner_password_hash text not null,
  owner_login_fail_count int not null default 0,
  owner_locked_until timestamptz null,
  updated_at timestamptz not null default now()
);

alter table factory_settings enable row level security;

create table if not exists staff_accounts (
  id bigint generated always as identity primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table staff_accounts enable row level security;

insert into factory_settings (
  id, factory_name, ceo_name, business_reg_no, address, phone,
  site_email_address, owner_password_hash
) values (
  1, '', '', '', '', '',
  '',
  'unset'
)
on conflict (id) do nothing;
