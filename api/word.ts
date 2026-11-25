import { GoogleGenAI } from "@google/genai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { normalizeTerm, senseKey, senseWords } from "../shared/wordKeys.js";
import { buildCardDetailsRequest } from "../shared/cardDetailsSpec.js";

/**
 * POST /api/word  { term, translation }
 * Shared word entries: returns an existing entry for this word+meaning, or generates one with
 * Gemini and saves it for everyone. Reading uses the public (anon) key; saving needs
 * SUPABASE_SERVICE_ROLE_KEY — without it the card is generated but not shared.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qhyvcrwucjxsgylzmsdu.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_jlBgHpcHex4zHiuVBGiRvQ_sxijqujW';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface EntryRow {
    id: string;
    term: string;
    term_key: string;
    sense_key: string;
    translation: string;
    definition: string | null;
    examples: unknown;
    conjugation: unknown;
    grammar_notes: string | null;
    image_prompt: string | null;
    frequency: string | null;
}

const client = (key: string): SupabaseClient =>
    createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });

const toDetails = (row: EntryRow) => ({
    definition: row.definition || '',
    grammarNotes: row.grammar_notes || '',
    visualPrompt: row.image_prompt || '',
    frequency: row.frequency || undefined,
    conjugation: row.conjugation || { isVerb: false },
    examples: Array.isArray(row.examples) ? row.examples : [],
});

/** Same meaning? Exact sense key, or — when the word has a single entry — overlapping translation words. */
const pickEntry = (rows: EntryRow[], sense: string, translation: string): EntryRow | undefined => {
    const exact = rows.find(r => r.sense_key === sense);
    if (exact) return exact;
    if (rows.length === 1) {
        const want = new Set(senseWords(translation));
        if (senseWords(rows[0].translation).some(w => want.has(w))) return rows[0];
    }
    return undefined;
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    let body: { term?: unknown; translation?: unknown };
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch {
        res.status(400).json({ error: 'Invalid JSON' });
        return;
    }
    const term = typeof body.term === 'string' ? body.term.trim() : '';
    const translation = typeof body.translation === 'string' ? body.translation.trim() : '';
    if (!term || !translation || term.length > 150 || translation.length > 300) {
        res.status(400).json({ error: 'term and translation are required (max 150/300 chars)' });
        return;
    }

    const termKey = normalizeTerm(term);
    const sense = senseKey(translation);
    if (!termKey || !sense) {
        res.status(400).json({ error: 'Empty term or translation after normalization' });
        return;
    }

    // 1. Look up a shared entry
    try {
        const { data, error } = await client(ANON_KEY)
            .from('word_entries')
            .select('*')
            .eq('term_key', termKey)
            .limit(20);
        if (!error && data) {
            const hit = pickEntry(data as EntryRow[], sense, translation);
            if (hit && Array.isArray(hit.examples) && hit.examples.length > 0) {
                res.status(200).json({ details: toDetails(hit), entryId: hit.id, cached: true, saved: true });
                return;
            }
        }
        // a missing table (migration not applied) just means "not found"
    } catch (e) {
        console.error('[word] lookup failed', e);
    }

    // 2. Generate with Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: '[server] Missing GEMINI_API_KEY' });
        return;
    }
    let details: any;
    try {
        const request = buildCardDetailsRequest(term, translation);
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: request.model,
            contents: request.contents as any,
            config: request.config as any,
        });
        if (!response.text) throw Object.assign(new Error('No details generated'), { status: 502 });
        details = JSON.parse(response.text);
    } catch (error: any) {
        res.status(error?.status || 500).json({ error: error?.message || 'Generation failed' });
        return;
    }

    // 3. Save for everyone (only with the service key — browsers can't write shared entries)
    let saved = false;
    let entryId: string | undefined;
    if (SERVICE_KEY) {
        const row = {
            term,
            term_key: termKey,
            sense_key: sense,
            translation,
            definition: details.definition || null,
            examples: Array.isArray(details.examples) ? details.examples : [],
            conjugation: details.conjugation || null,
            grammar_notes: details.grammarNotes || null,
            image_prompt: details.visualPrompt || null,
            frequency: details.frequency || null,
            source: 'ai',
        };
        const { data, error } = await client(SERVICE_KEY)
            .from('word_entries')
            .upsert(row, { onConflict: 'term_key,sense_key', ignoreDuplicates: true })
            .select('id')
            .maybeSingle();
        if (error) console.error('[word] save failed', error);
        else { saved = true; entryId = data?.id; }
    }

    res.status(200).json({ details, entryId, cached: false, saved });
}
