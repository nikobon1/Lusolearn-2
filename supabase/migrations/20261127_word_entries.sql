-- LusoLearn: общие статьи слов — один раз сгенерированная карточка доступна всем.
-- Запустить один раз: Supabase → SQL Editor → вставить → Run.
-- Повторный запуск безопасен.
--
-- Читать статьи могут все. Записывать — только сервер (функция /api/word с ключом service role):
-- политики на insert/update для браузера намеренно НЕ создаются.

-- 0. Исправление: колонка difficulty, которую приложение сохраняет вместе с расписанием карточки.
--    Без неё сохранение расписания отклонялось базой целиком (с апреля 2026).
alter table public.flashcards add column if not exists difficulty text;

create table if not exists public.word_entries (
    id             uuid primary key default gen_random_uuid(),
    term           text not null,               -- как показывать: "a casa", "Queria abrir uma conta"
    term_key       text not null,               -- нормализованное слово: "casa" (см. shared/wordKeys.ts)
    sense_key      text not null,               -- первое значение перевода: "дом"
    translation    text not null,               -- перевод на русский
    definition     text,
    examples       jsonb not null default '[]'::jsonb,
    conjugation    jsonb,
    grammar_notes  text,
    image_prompt   text,
    frequency      text,
    source         text not null default 'ai',  -- ai | backfill
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique (term_key, sense_key)
);

create index if not exists word_entries_term_key_idx on public.word_entries (term_key);

alter table public.word_entries enable row level security;

drop policy if exists "word_entries: read for everyone" on public.word_entries;
create policy "word_entries: read for everyone" on public.word_entries
    for select using (true);

-- Наполнение из уже сгенерированных карточек (без личных реплик из видео и без «пустых» карточек).
-- Нормализация повторяет shared/wordKeys.ts: normalizeTerm и senseKey.
insert into public.word_entries (term, term_key, sense_key, translation, definition, examples, conjugation, grammar_notes, image_prompt, frequency, source)
select distinct on (term_key, sense_key)
    term, term_key, sense_key, translation, definition, examples, conjugation, grammar_notes, image_prompt, frequency, 'backfill'
from (
    select
        f.original_term as term,
        btrim(regexp_replace(
            regexp_replace(regexp_replace(lower(btrim(f.original_term)), '[.!?¿¡,;:"«»()]', '', 'g'), '\s+', ' ', 'g'),
            '^(o|a|os|as|um|uma|uns|umas) (?=\S)', '')) as term_key,
        btrim(regexp_replace(
            regexp_replace(
                split_part(regexp_replace(replace(lower(f.translation), 'ё', 'е'), '[;(/]', ',', 'g'), ',', 1),
                '[.!?¿¡:"«»)]', '', 'g'),
            '\s+', ' ', 'g')) as sense_key,
        f.translation,
        f.definition,
        coalesce((select jsonb_agg(e) from jsonb_array_elements(f.examples::jsonb) e where not (e ? 'source')), '[]'::jsonb) as examples,
        f.conjugation::jsonb as conjugation,
        f.grammar_notes,
        null::text as image_prompt,
        f.frequency,
        f.created_at
    from public.flashcards f
    where f.definition is not null and f.definition <> '' and f.definition <> 'Definition unavailable'
      and (case when jsonb_typeof(f.examples::jsonb) = 'array' then jsonb_array_length(f.examples::jsonb) else 0 end) > 0
) src
where term_key <> '' and sense_key <> '' and jsonb_array_length(examples) > 0
order by term_key, sense_key, created_at desc
on conflict (term_key, sense_key) do nothing;
