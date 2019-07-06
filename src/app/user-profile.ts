export interface UserProfile {
  displayName: string,
  uid: string,
  email: string,
  fullName?: string | null,
  phone?: string | null,
  canEditStatus?: boolean | null
}
