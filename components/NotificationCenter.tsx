import React, { useEffect, useState } from 'react';
import { NotificationPayload, notificationEventName } from '../lib/notifications';

const levelStyles: Record<NotificationPayload['level'], string> = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-slate-800 text-white',
};

const NotificationCenter: React.FC = () => {
    const [items, setItems] = useState<NotificationPayload[]>([]);

    useEffect(() => {
        const onNotify = (event: Event) => {
            const customEvent = event as CustomEvent<NotificationPayload>;
            const payload = customEvent.detail;
            setItems(prev => [...prev, payload]);

            const timeout = payload.durationMs ?? 3200;
            window.setTimeout(() => {
                setItems(prev => prev.filter(item => item.id !== payload.id));
            }, timeout);
        };

        window.addEventListener(notificationEventName, onNotify as EventListener);
        return () => window.removeEventListener(notificationEventName, onNotify as EventListener);
    }, []);

    if (items.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[120] flex flex-col gap-2 max-w-sm">
            {items.map(item => (
                <div key={item.id} className={`px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${levelStyles[item.level]}`}>
                    {item.message}
                </div>
            ))}
        </div>
    );
};

export default NotificationCenter;

