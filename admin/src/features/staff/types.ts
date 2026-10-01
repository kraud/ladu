import type { StaffRole } from '@/stores/authStore';

export interface StaffMember {
    id: string;
    email: string;
    name: string;
    role: StaffRole;
    status: 'active' | 'disabled';
    /** True while the person still has the temporary password an owner gave them. */
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    passwordChangedAt: string | null;
    createdAt: string;
}

export const ROLES: { value: StaffRole; label: string; description: string }[] = [
    { value: 'owner', label: 'Owner', description: 'Everything, including staff management' },
    { value: 'admin', label: 'Admin', description: 'Users, deleting accounts, health and the audit log' },
    { value: 'support', label: 'Support', description: 'Users, ban and force logout, health' },
    { value: 'viewer', label: 'Viewer', description: 'Read users and health only' },
];
