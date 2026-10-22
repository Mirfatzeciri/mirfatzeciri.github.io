create table if not exists public.job_listings (
    id uuid primary key default gen_random_uuid(),
    source text not null,
    external_id text not null,
    title text not null,
    company text,
    location text,
    description text,
    redirect_url text not null,
    posted_at timestamptz,
    fetched_at timestamptz not null default now(),
    unique (source, external_id)
);

create index if not exists job_listings_fetched_at_idx
    on public.job_listings (fetched_at desc);

create table if not exists public.job_applications (
    user_id uuid not null references auth.users (id) on delete cascade,
    job_id uuid not null references public.job_listings (id) on delete cascade,
    status text not null default 'new'
        check (status in ('new', 'interested', 'applied', 'interview', 'rejected', 'not_relevant')),
    notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, job_id)
);

alter table public.job_listings enable row level security;
alter table public.job_applications enable row level security;

revoke all on public.job_listings from anon;
revoke all on public.job_listings from authenticated;
grant select on public.job_listings to authenticated;

revoke all on public.job_applications from anon;
revoke all on public.job_applications from authenticated;
grant select, insert, update, delete on public.job_applications to authenticated;

drop policy if exists "Authenticated users can view job listings" on public.job_listings;
create policy "Authenticated users can view job listings"
    on public.job_listings
    for select
    to authenticated
    using (auth.uid() is not null);

drop policy if exists "Users can read their own applications" on public.job_applications;
create policy "Users can read their own applications"
    on public.job_applications
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can add their own applications" on public.job_applications;
create policy "Users can add their own applications"
    on public.job_applications
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own applications" on public.job_applications;
create policy "Users can update their own applications"
    on public.job_applications
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own applications" on public.job_applications;
create policy "Users can delete their own applications"
    on public.job_applications
    for delete
    to authenticated
    using (auth.uid() = user_id);
