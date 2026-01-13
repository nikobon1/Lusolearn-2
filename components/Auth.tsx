import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { LoaderIcon, GoogleIcon } from './Icons';

interface Props {
    onLoginSuccess: () => void;
    onOfflineMode: () => void;
}

export const Auth: React.FC<Props> = ({ onLoginSuccess, onOfflineMode }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('Регистрация успешна! Проверьте почту для подтверждения (если включено) или войдите.');
                setMode('login');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onLoginSuccess();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        // Warning for preview environments
        if (window.location.hostname.includes('googleusercontent') || window.location.hostname.includes('webcontainer')) {
             alert("Внимание: Вход через Google не работает в режиме Preview (AI Studio), так как у этого окна динамический домен. \n\nПожалуйста, используйте кнопку 'Тестовый режим (Оффлайн)' для проверки приложения.");
             return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 dark:border-slate-700">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white serif mb-2">LusoLearn</h1>
                    <p className="text-slate-500 dark:text-slate-400">Войдите для синхронизации</p>
                </div>

                {/* Primary Button for Preview Users */}
                <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-700">
                     <button 
                        onClick={onOfflineMode}
                        className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all flex justify-center items-center gap-2"
                     >
                         🚀 Тестовый режим (Оффлайн)
                     </button>
                     <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                         Используйте этот режим для просмотра в AI Studio Preview
                     </p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full py-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex justify-center items-center gap-3 relative group"
                    >
                        <GoogleIcon className="w-5 h-5" />
                        Войти через Google
                    </button>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-100 dark:border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase">или email</span>
                        <div className="flex-grow border-t border-slate-100 dark:border-slate-700"></div>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="hello@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Пароль</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 text-sm rounded-lg border border-rose-100 dark:border-rose-800">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 disabled:opacity-70 flex justify-center items-center gap-2 hover:bg-emerald-700 transition-all"
                        >
                            {loading && <LoaderIcon className="w-4 h-4 animate-spin" />}
                            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                        </button>
                    </form>
                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                        className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium"
                    >
                        {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Есть аккаунт? Войти'}
                    </button>
                </div>
            </div>
        </div>
    );
};