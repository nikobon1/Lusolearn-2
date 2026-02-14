import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export const getCurrentSession = async (): Promise<Session | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session;
};

export const subscribeAuthState = (onChange: (session: Session | null) => void) => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => onChange(session));
    return data.subscription;
};

export const signOutUser = async () => {
    await supabase.auth.signOut();
};

export const signUpWithEmail = async (email: string, password: string) => {
    return supabase.auth.signUp({ email, password });
};

export const signInWithEmail = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
};

export const signInWithGoogle = async (redirectTo: string) => {
    return supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
    });
};

