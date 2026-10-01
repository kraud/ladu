import { useAuthStore } from '@/stores/authStore';

/** Placeholder home. Slices 4 (users), 6 (health) and 9 (statistics) fill the app. */
export function OverviewPage() {
    const name = useAuthStore((s) => s.staff?.name);

    return (
        <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">Welcome{name ? `, ${name}` : ''}</h1>
            <p className="text-muted-foreground">The admin pages are built in the next slices.</p>
        </div>
    );
}
