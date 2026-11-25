-- LusoLearn: видеоуроки (расшифровка ролика + разбор лексики).
-- Запустить один раз: Supabase → SQL Editor → вставить → Run.
-- Повторный запуск безопасен (Supabase может предупредить из-за строк "drop policy if exists" —
-- они удаляют только правила доступа этой же таблицы и тут же создают их заново).

create table if not exists public.video_lessons (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    title       text not null,
    url         text,
    video_id    text,
    transcript  text not null,
    analysis    jsonb not null,
    created_at  timestamptz not null default now()
);

create index if not exists video_lessons_user_idx on public.video_lessons (user_id, created_at desc);

alter table public.video_lessons enable row level security;

drop policy if exists "video_lessons: read own" on public.video_lessons;
create policy "video_lessons: read own" on public.video_lessons
    for select using (auth.uid() = user_id);

drop policy if exists "video_lessons: insert own" on public.video_lessons;
create policy "video_lessons: insert own" on public.video_lessons
    for insert with check (auth.uid() = user_id);

drop policy if exists "video_lessons: update own" on public.video_lessons;
create policy "video_lessons: update own" on public.video_lessons
    for update using (auth.uid() = user_id);

drop policy if exists "video_lessons: delete own" on public.video_lessons;
create policy "video_lessons: delete own" on public.video_lessons
    for delete using (auth.uid() = user_id);
