import type { UserData } from './fieldParser'

/** A person's name as a list shows it. */
export function personName(user: UserData): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.id || 'Unnamed'
}
