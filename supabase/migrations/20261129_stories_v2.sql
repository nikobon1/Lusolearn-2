-- LusoLearn: истории нового формата (по предложениям, словарик, вопросы, серии).
-- Запустить один раз: Supabase → SQL Editor → вставить → Run.
-- Скрипт можно запускать повторно — он ничего не сломает.

alter table public.stories add column if not exists data jsonb;

notify pgrst, 'reload schema';
