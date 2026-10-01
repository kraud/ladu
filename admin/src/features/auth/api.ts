import { apiClient } from '@/api/client';
import type { StaffLoginResponse } from '@/api/types';
import type { StaffUser } from '@/stores/authStore';

export async function loginStaff(email: string, password: string): Promise<StaffLoginResponse> {
    const { data } = await apiClient.post<StaffLoginResponse>('/admin/auth/login', { email, password });
    return data;
}

export async function fetchMe(): Promise<StaffUser> {
    const { data } = await apiClient.get<StaffUser>('/admin/auth/me');
    return data;
}

export async function changePasswordRequest(currentPassword: string, newPassword: string): Promise<StaffLoginResponse> {
    const { data } = await apiClient.post<StaffLoginResponse>('/admin/auth/change-password', { currentPassword, newPassword });
    return data;
}
