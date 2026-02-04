create extension if not exists "uuid-ossp";

create table if not exists users (
    id uuid primary key,
    username text not null,
    email text not null unique,
    password_hash text not null,
    role text not null check (role in ('admin','user')),
    created_at timestamptz not null default now()
);

create table if not exists documents (
    id uuid primary key,
    name text not null,
    mime_type text not null,
    size bigint not null,
    notes text not null default '',
    owner_id uuid not null references users(id) on delete restrict,
    permission text not null check (permission in ('public','private','specific')),
    allowed_users uuid[] not null default '{}',
    is_generated boolean not null default false,
    storage_rel_path text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_documents_owner_id on documents(owner_id);
create index if not exists idx_documents_created_at on documents(created_at desc);
