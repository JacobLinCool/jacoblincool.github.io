export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export type NotificationItem = {
    id: string;
    level: NotificationLevel;
    message: string;
    createdAt: number;
};

class NotificationStore {
    static instance: NotificationStore | null = null;
    state = $state<{
        items: NotificationItem[];
    }>({
        items: []
    });

    static getInstance() {
        NotificationStore.instance ??= new NotificationStore();
        return NotificationStore.instance;
    }

    push(level: NotificationLevel, message: string) {
        const item: NotificationItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            level,
            message,
            createdAt: Date.now()
        };

        this.state.items = [...this.state.items, item];
        return item.id;
    }

    info(message: string) {
        return this.push('info', message);
    }

    success(message: string) {
        return this.push('success', message);
    }

    warning(message: string) {
        return this.push('warning', message);
    }

    error(message: string) {
        return this.push('error', message);
    }

    remove(id: string) {
        this.state.items = this.state.items.filter((item) => item.id !== id);
    }

    clear() {
        this.state.items = [];
    }
}

export const notificationStore = NotificationStore.getInstance();
