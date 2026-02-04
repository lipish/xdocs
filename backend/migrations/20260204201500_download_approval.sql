alter table documents add column if not exists download_preauthorized boolean not null default false;

create table if not exists download_requests (
    id uuid primary key,
    document_id uuid not null references documents(id) on delete cascade,
    requester_id uuid not null references users(id) on delete cascade,
    applicant_name text not null,
    applicant_company text not null,
    applicant_contact text not null,
    message text not null default '',
    status text not null check (status in ('pending','approved','rejected')),
    approver_id uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    approved_at timestamptz,
    rejected_at timestamptz,
    expires_at timestamptz
);

create index if not exists idx_download_requests_document_id on download_requests(document_id);
create index if not exists idx_download_requests_requester_id on download_requests(requester_id);
create index if not exists idx_download_requests_status on download_requests(status);
create unique index if not exists idx_download_requests_active_unique on download_requests(document_id, requester_id) where status = 'pending';
