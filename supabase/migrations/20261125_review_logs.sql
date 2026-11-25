-- LusoLearn: журнал повторений + настройки дневного плана.
-- Запустить один раз: Supabase → SQL Editor → вставить → Run.
-- Скрипт можно запускать повторно — он ничего не сломает.

-- 1. Журнал: одна строка на каждую оценку карточки
create table if not exists public.review_logs (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
    card_id         text not null,
    reviewed_at     timestamptz not null default now(),
    rating          text not null check (rating in ('again', 'hard', 'good', 'easy')),
    was_new         boolean not null default false,  -- первая встреча с карточкой
    attempt         smallint not null default 0,     -- 0 = первый показ в сессии, 1+ = повтор после ошибки
    exercise        text,                            -- recognition | cloze | production
    interval_before integer,
    interval_after  integer,
    ease_before     real,
    ease_after      real
);

create index if not exists review_logs_user_time_idx on public.review_logs (user_id, reviewed_at desc);
create index if not exists review_logs_user_card_idx on public.review_logs (user_id, card_id);

-- Каждый видит и пишет только свои записи
alter table public.review_logs enable row level security;

drop policy if exists "review_logs: read own" on public.review_logs;
create policy "review_logs: read own" on public.review_logs
    for select using (auth.uid() = user_id);

drop policy if exists "review_logs: insert own" on public.review_logs;
create policy "review_logs: insert own" on public.review_logs
    for insert with check (auth.uid() = user_id);

drop policy if exists "review_logs: delete own" on public.review_logs;
create policy "review_logs: delete own" on public.review_logs
    for delete using (auth.uid() = user_id);

-- 2. Настройки дневного плана (лимиты новых слов и повторений) в профиле
alter table public.profiles add column if not exists study_plan jsonb;
