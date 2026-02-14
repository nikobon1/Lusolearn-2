export type NotificationLevel = 'success' | 'error' | 'info';

export interface NotificationPayload {
    id: string;
    level: NotificationLevel;
    message: string;
    durationMs?: number;
}

const EVENT_NAME = 'app:notify';

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export const notify = (level: NotificationLevel, message: string, durationMs = 3200) => {
    const payload: NotificationPayload = { id: createId(), level, message, durationMs };
    window.dispatchEvent(new CustomEvent<NotificationPayload>(EVENT_NAME, { detail: payload }));
};

export const notifySuccess = (message: string, durationMs?: number) => notify('success', message, durationMs);
export const notifyError = (message: string, durationMs?: number) => notify('error', message, durationMs);
export const notifyInfo = (message: string, durationMs?: number) => notify('info', message, durationMs);

export const notificationEventName = EVENT_NAME;

