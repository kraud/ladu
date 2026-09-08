import { Outlet } from '@tanstack/react-router';

/**
 * Bare centered layout for public routes (login, register, verify, reset, 404).
 * No header — this route-config layout is what replaces the old app's regex
 * header-visibility table and `NotFound`'s render-phase `onHideHeader()` call.
 * The auth pages bring their own `.auth-shell` / logo banner.
 */
export function PublicLayout() {
    return (
        <div className="min-h-dvh">
            <Outlet />
        </div>
    );
}
