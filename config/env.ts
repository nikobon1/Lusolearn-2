type EnvMap = Record<string, string | undefined>;

const importMetaEnv: EnvMap = import.meta.env as unknown as EnvMap;
const processEnv: EnvMap = (typeof process !== 'undefined' ? (process.env as EnvMap) : {});

const readEnv = (...keys: string[]): string | undefined => {
    for (const key of keys) {
        const fromImportMeta = importMetaEnv[key];
        if (fromImportMeta) return fromImportMeta;

        const fromProcess = processEnv[key];
        if (fromProcess) return fromProcess;
    }
    return undefined;
};

const defaultSupabaseUrl = 'https://qhyvcrwucjxsgylzmsdu.supabase.co';
const defaultSupabaseAnonKey = 'sb_publishable_jlBgHpcHex4zHiuVBGiRvQ_sxijqujW';
const configuredSupabaseUrl = importMetaEnv.VITE_SUPABASE_URL || readEnv('REACT_APP_SUPABASE_URL');
const configuredSupabaseAnonKey = importMetaEnv.VITE_SUPABASE_ANON_KEY || readEnv('REACT_APP_SUPABASE_ANON_KEY');

export const env = {
    supabaseUrl: configuredSupabaseUrl || defaultSupabaseUrl,
    supabaseAnonKey: configuredSupabaseAnonKey || defaultSupabaseAnonKey,
    googleCloudApiKey: readEnv('VITE_GOOGLE_CLOUD_API_KEY', 'GOOGLE_CLOUD_API_KEY'),
    geminiTtsModel: readEnv('VITE_GEMINI_TTS_MODEL', 'GEMINI_TTS_MODEL') || 'gemini-2.5-flash-preview-tts',
    usingFallbackSupabase: !configuredSupabaseUrl || !configuredSupabaseAnonKey,
};
