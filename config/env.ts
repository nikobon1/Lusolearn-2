type EnvMap = Record<string, string | undefined>;

const processEnv: EnvMap = (typeof process !== 'undefined' ? (process.env as EnvMap) : {});

const readProcessEnv = (...keys: string[]): string | undefined => {
    for (const key of keys) {
        const fromProcess = processEnv[key];
        if (fromProcess) return fromProcess;
    }
    return undefined;
};

const defaultSupabaseUrl = 'https://qhyvcrwucjxsgylzmsdu.supabase.co';
const defaultSupabaseAnonKey = 'sb_publishable_jlBgHpcHex4zHiuVBGiRvQ_sxijqujW';
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || readProcessEnv('REACT_APP_SUPABASE_URL');
const configuredSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || readProcessEnv('REACT_APP_SUPABASE_ANON_KEY');

export const env = {
    supabaseUrl: configuredSupabaseUrl || defaultSupabaseUrl,
    supabaseAnonKey: configuredSupabaseAnonKey || defaultSupabaseAnonKey,
    geminiTtsModel: import.meta.env.VITE_GEMINI_TTS_MODEL || readProcessEnv('GEMINI_TTS_MODEL') || 'gemini-2.5-flash-preview-tts',
    usingFallbackSupabase: !configuredSupabaseUrl || !configuredSupabaseAnonKey,
};
