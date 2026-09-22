import { Outlet } from '@tanstack/react-router';

/**
 * Bare pass-through layout for public routes (login, register, verify,
 * reset). No header — this route-config layout is what replaces the old
 * app's regex header-visibility table and `NotFound`'s render-phase
 * `onHideHeader()` call. Every auth page brings its own `AuthLayout`
 * (`.auth-shell` two-column brand ground + form panel, including the
 * interface-language selector) — nothing shared lives here anymore.
 */
export function PublicLayout() {
    return <Outlet />;
}
