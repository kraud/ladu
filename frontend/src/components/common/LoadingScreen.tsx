/**
 * Full-page loading state. Doubles as the i18n `<Suspense>` fallback in
 * `app/Providers.tsx` and as a route-level pending UI. Fixed height, no
 * interactivity — never a spinner covering content that could load on its own.
 */
export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
            <span className="spinner" />
            <span className="meta">{label}</span>
        </div>
    );
}
