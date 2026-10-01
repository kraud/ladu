import { apiClient } from '@/api/client';
import type { StaffMember } from '@/features/staff/types';
import type { StaffRole } from '@/stores/authStore';

export async function fetchStaff(): Promise<StaffMember[]> {
    const { data } = await apiClient.get<{ items: StaffMember[] }>('/admin/staff');
    return data.items;
}

export interface CreateStaffBody {
    email: string;
    name: string;
    role: StaffRole;
    password: string;
    reason?: string;
}

export async function createStaffMember(body: CreateStaffBody): Promise<StaffMember> {
    const { data } = await apiClient.post<StaffMember>('/admin/staff', body);
    return data;
}

export type StaffActionName = 'role' | 'disable' | 'enable' | 'reset-password';

export interface StaffActionBody {
    role?: StaffRole;
    password?: string;
    reason?: string;
}

export async function runStaffAction(id: string, action: StaffActionName, body: StaffActionBody): Promise<StaffMember> {
    const { data } = await apiClient.post<StaffMember>(`/admin/staff/${encodeURIComponent(id)}/${action}`, body);
    return data;
}
