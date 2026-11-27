-- LusoLearn: состояние памяти FSRS для каждой карточки (стабильность, сложность, повторы).
-- Запустить один раз: Supabase → SQL Editor → вставить → Run. Повторный запуск безопасен.

alter table public.flashcards add column if not exists fsrs jsonb;

notify pgrst, 'reload schema';
