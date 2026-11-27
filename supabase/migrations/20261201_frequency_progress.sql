-- LusoLearn: отметки «Знаю» в «С нуля» (и результаты проверки словарного запаса) + дневная цель —
-- чтобы они были одинаковыми на телефоне и компьютере.
-- Запустить один раз: Supabase → SQL Editor → вставить → Run. Повторный запуск безопасен.

alter table public.profiles add column if not exists frequency_progress jsonb;

notify pgrst, 'reload schema';
