/**
 * Role Constants - Single Source of Truth for User Roles
 *
 * All role-related code MUST use these constants instead of hardcoded strings.
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  CHEF_ZONE = 'CHEF_ZONE',
  MEMBRE = 'MEMBRE',
}

export const DEFAULT_ROLE = UserRole.MEMBRE;

export const VALID_USER_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.CHEF_ZONE,
  UserRole.MEMBRE,
] as const;

export const ROLE_METADATA = {
  [UserRole.ADMIN]: {
    displayName: 'Administrateur',
    description: 'Full access to all features and data',
  },
  [UserRole.CHEF_ZONE]: {
    displayName: 'Chef de Zone',
    description: 'Manages families and members within their assigned zone',
  },
  [UserRole.MEMBRE]: {
    displayName: 'Membre',
    description: 'Read-only access to own family data',
  },
} as const;

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' && VALID_USER_ROLES.includes(value as UserRole)
  );
}

export type UserRoleType = UserRole;
