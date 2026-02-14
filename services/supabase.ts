import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
// Supabase client configuration is resolved via config/env.ts

const supabaseUrl = env.supabaseUrl;
const supabaseAnonKey = env.supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to convert Base64 to Blob and upload to Storage
export const uploadBase64File = async (
    bucket: string,
    path: string,
    base64Data: string,
    contentType: string
): Promise<string | null> => {
    try {
        // 1. Convert Base64 to Blob
        // Handle cases with/without data URI prefix (e.g. "data:image/png;base64,...")
        const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

        const byteCharacters = atob(base64Clean);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });

        // 2. Upload to Supabase
        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(path, blob, {
                contentType,
                upsert: true
            });

        if (uploadError) {
            // Only log real errors, RLS violations are expected if session check fails elsewhere but we want to be clean
            console.warn("Storage upload warning:", uploadError.message);
            return null;
        }

        // 3. Get Public URL
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;

    } catch (error) {
        console.error("Failed to upload file:", error);
        return null;
    }
};

// --- Global Audio Cache Helpers ---

export const findGlobalAudio = async (text: string): Promise<string | null> => {
    try {
        const normalizedWord = text.trim().toLowerCase();
        // Use maybeSingle to avoid 406 error if not found
        const { data, error } = await supabase
            .from('global_word_audio')
            .select('audio_url')
            .eq('word', normalizedWord)
            .maybeSingle();

        if (error || !data) return null;
        return data.audio_url;
    } catch (e) {
        return null;
    }
};

export const saveGlobalAudio = async (text: string, base64Data: string): Promise<string | null> => {
    try {
        console.log(`[GlobalCache] 🔍 Attempting to save audio for: "${text.substring(0, 30)}..."`);

        // 1. Check for active session. 
        // Offline/Guest users are not allowed to upload to global cache by RLS policy.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error(`[GlobalCache] ❌ Session error:`, sessionError);
            return null;
        }

        if (!session) {
            console.warn(`[GlobalCache] ⚠️ No active session - skipping global cache save (user not logged in)`);
            return null;
        }

        console.log(`[GlobalCache] ✅ Session found for user: ${session.user.email}`);

        const normalizedWord = text.trim().toLowerCase();

        // Strictly sanitize filename to ASCII only
        const safeFilename = normalizedWord
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9-]/g, '_')
            .substring(0, 64);

        const fileName = `${safeFilename}_${Date.now()}.mp3`;
        console.log(`[GlobalCache] 📁 Uploading to global-audio/${fileName}`);

        // 2. Upload to global bucket
        const publicUrl = await uploadBase64File('global-audio', fileName, base64Data, 'audio/mp3');

        if (publicUrl) {
            console.log(`[GlobalCache] ✅ File uploaded successfully: ${publicUrl}`);

            // 3. Insert into global cache table
            const { error } = await supabase
                .from('global_word_audio')
                .upsert({ word: normalizedWord, audio_url: publicUrl }, { onConflict: 'word', ignoreDuplicates: true });

            if (error) {
                console.error(`[GlobalCache] ❌ DB insert error:`, error);
            } else {
                console.log(`[GlobalCache] ✅ Saved to global_word_audio table: "${normalizedWord}"`);
            }
            return publicUrl;
        } else {
            console.error(`[GlobalCache] ❌ File upload failed - no URL returned`);
        }
        return null;
    } catch (e) {
        console.error(`[GlobalCache] ❌ Exception:`, e);
        return null;
    }
};

// --- Global Image Cache Helpers ---

export const findGlobalImage = async (word: string): Promise<string | null> => {
    try {
        const normalizedWord = word.trim().toLowerCase();
        const { data, error } = await supabase
            .from('global_word_images')
            .select('image_url')
            .eq('word', normalizedWord)
            .maybeSingle();

        if (error || !data) return null;
        return data.image_url;
    } catch (e) {
        return null;
    }
};

export const saveGlobalImage = async (word: string, base64Data: string): Promise<string | null> => {
    try {
        // 1. Check session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const normalizedWord = word.trim().toLowerCase();

        // Sanitize filename
        const safeFilename = normalizedWord
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9-]/g, '_')
            .substring(0, 64);

        const fileName = `${safeFilename}_${Date.now()}.png`;

        // 2. Upload to global bucket
        const publicUrl = await uploadBase64File('global-images', fileName, base64Data, 'image/png');

        if (publicUrl) {
            // 3. Insert into global cache table
            const { error } = await supabase
                .from('global_word_images')
                .upsert({ word: normalizedWord, image_url: publicUrl }, { onConflict: 'word', ignoreDuplicates: true });

            if (error) console.warn("Image cache insert warning:", error);
            return publicUrl;
        }
        return null;
    } catch (e) {
        return null;
    }
};
