alter table users add column if not exists status text;
alter table users add column if not exists note text;

update users set status = 'active' where status is null;
update users set note = '' where note is null;

alter table users alter column status set default 'pending';
alter table users alter column status set not null;

alter table users alter column note set default '';
alter table users alter column note set not null;

alter table users alter column email drop not null;

do $$
begin
    if exists(
        select 1
        from pg_constraint
        where conname = 'users_email_key'
    ) then
        alter table users drop constraint users_email_key;
    end if;
end $$;

create unique index if not exists idx_users_email_unique_not_null on users(email) where email is not null;
create unique index if not exists idx_users_username_unique on users(username);
