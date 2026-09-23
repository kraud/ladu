/**
 * Thin transport layer over `apiClient` (baseURL `/api`). No React, no toasts,
 * no store writes — those live in `hooks.ts`. Each function maps 1:1 to a
 * `userController` endpoint.
 */
import { apiClient } from '@/api/client';
import type {
    AuthUser,
    LoginRequest,
    LoginResponse,
    OAuthLinkRequest,
    OAuthProvidersResponse,
    OAuthSignupCompleteRequest,
    RegisterRequest,
    RegisterResponse,
    RequestResetRequest,
    SetPasswordRequest,
    UpdateProfileRequest,
    VerifyEmailParams,
    VerifyEmailResponse,
} from './types';

export async function login(body: LoginRequest): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/users/login', body);
    return data;
}

export async function register(body: RegisterRequest): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>('/users', body);
    return data;
}

export async function verifyEmail({ userId, tokenId }: VerifyEmailParams): Promise<VerifyEmailResponse> {
    const { data } = await apiClient.get<VerifyEmailResponse>(
        `/users/${encodeURIComponent(userId)}/verify/${encodeURIComponent(tokenId)}`,
    );
    return data;
}

export async function requestPasswordReset(body: RequestResetRequest): Promise<void> {
    await apiClient.post('/users/requestPasswordReset', body);
}

export async function setPassword(body: SetPasswordRequest): Promise<void> {
    await apiClient.put('/users/updatePassword', body);
}

export async function getMe(): Promise<AuthUser> {
    const { data } = await apiClient.get<AuthUser>('/users/me');
    return data;
}

export async function updateProfile(body: UpdateProfileRequest): Promise<AuthUser> {
    const { data } = await apiClient.put<AuthUser>('/users/updateUser', body);
    return data;
}

export async function getOAuthProviders(): Promise<OAuthProvidersResponse> {
    const { data } = await apiClient.get<OAuthProvidersResponse>('/auth/providers');
    return data;
}

export async function completeOAuthSignup(body: OAuthSignupCompleteRequest): Promise<AuthUser> {
    const { data } = await apiClient.post<AuthUser>('/auth/signup/complete', body);
    return data;
}

export async function linkOAuthAccount(body: OAuthLinkRequest): Promise<AuthUser> {
    const { data } = await apiClient.post<AuthUser>('/auth/link', body);
    return data;
}
