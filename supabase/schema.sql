create table if not exists public.energy_data (
  id bigint generated always as identity primary key,
  uuid text not null,
  irms double precision not null,
  power double precision not null,
  temperature double precision not null,
  humidity double precision not null,
  "timestamp" bigint not null
);

create index if not exists energy_data_uuid_ts_idx on public.energy_data (uuid, "timestamp");

alter table public.energy_data enable row level security;

drop policy if exists "anon insert" on public.energy_data;
drop policy if exists "anon select" on public.energy_data;
drop policy if exists "anon delete" on public.energy_data;

create policy "anon insert" on public.energy_data for insert to anon with check (true);
create policy "anon select" on public.energy_data for select to anon using (true);
-- El borrado solo lo hace el servidor con la service_role key (ignora RLS).
