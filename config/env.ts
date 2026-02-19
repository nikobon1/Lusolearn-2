type EnvMap = Record<string, string | undefined>;

const importMetaEnv: EnvMap = ((import.meta as unknown as { env?: EnvMap }).env ?? {});
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

export const env = {
    supabaseUrl: readEnv('VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL') || 'https://qhyvcrwucjxsgylzmsdu.supabase.co',
    supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY') || 'sb_publishable_jlBgHpcHex4zHiuVBGiRvQ_sxijqujW',
    googleCloudApiKey: readEnv('VITE_GOOGLE_CLOUD_API_KEY', 'GOOGLE_CLOUD_API_KEY'),
    geminiTtsModel: readEnv('VITE_GEMINI_TTS_MODEL', 'GEMINI_TTS_MODEL') || 'gemini-2.5-flash-preview-tts',
};
