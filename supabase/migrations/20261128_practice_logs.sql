-- LusoLearn: журнал тренировок фраз-шаблонов и спряжений (для «Занятия на сегодня»
-- и чтобы статистика тренажёров была одинаковой на телефоне и компьютере).
-- Запустить один раз: Supabase → SQL Editor → вставить → Run.
-- Скрипт можно запускать повторно — он ничего не сломает.

create table if not exists public.practice_logs (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
    kind         text not null check (kind in ('phrase', 'conjugation')),
    item_key     text not null,                -- phrase: "queria|0", conjugation: "fazer|presente|eu"
    verdict      text not null check (verdict in ('correct', 'almost', 'wrong', 'override')),
    practiced_at timestamptz not null default now()
);

create index if not exists practice_logs_user_time_idx on public.practice_logs (user_id, practiced_at desc);

alter table public.practice_logs enable row level security;

drop policy if exists "practice_logs: read own" on public.practice_logs;
create policy "practice_logs: read own" on public.practice_logs
    for select using (auth.uid() = user_id);

drop policy if exists "practice_logs: insert own" on public.practice_logs;
create policy "practice_logs: insert own" on public.practice_logs
    for insert with check (auth.uid() = user_id);

drop policy if exists "practice_logs: delete own" on public.practice_logs;
create policy "practice_logs: delete own" on public.practice_logs
    for delete using (auth.uid() = user_id);
