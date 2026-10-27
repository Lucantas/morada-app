import { z } from 'zod';

export const orgRoleSchema = z.enum(['owner', 'member']);
export type OrgRole = z.infer<typeof orgRoleSchema>;

export const organizationNameSchema = z.string().trim().min(1).max(80);

export const condoIdsSchema = z.array(z.string().min(1).max(64)).max(500);

export interface Organization {
  id: string;
  name: string;
}

export interface OrgCondo {
  id: string;
  name: string;
}

export interface OrgMember {
  userId: string;
  name: string | null;
  email: string | null;
  role: OrgRole;
  active: boolean;
  condoIds: string[];
}
