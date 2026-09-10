import { Outlet } from '@tanstack/react-router';
import { PublicLanguageSelector } from '@/components/layout/PublicLanguageSelector';

/**
 * Bare centered layout for public routes (login, register, verify, reset).
 * No header — this route-config layout is what replaces the old app's regex
 * header-visibility table and `NotFound`'s render-phase `onHideHeader()` call.
 * The auth pages bring their own `.auth-shell` / logo banner.
 *
 * Top-right carries the UI-language selector so the language can be chosen
 * before signing in and stays consistent inside the app afterwards. (The 404
 * page renders outside this layout and deliberately has no selector.)
 */
export function PublicLayout() {
    return (
        <div className="min-h-dvh">
            <div className="mx-auto flex max-w-5xl justify-end px-6 pt-4">
                <PublicLanguageSelector />
            </div>
            <Outlet />
        </div>
    );
}
