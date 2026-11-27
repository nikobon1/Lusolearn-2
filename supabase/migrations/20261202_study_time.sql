-- LusoLearn: время занятий по дням (секунды), отдельно по каждому устройству — чтобы суммировать телефон и компьютер.
-- Запустить один раз: Supabase → SQL Editor → вставить → Run. Повторный запуск безопасен.

alter table public.profiles add column if not exists study_time jsonb;

notify pgrst, 'reload schema';
