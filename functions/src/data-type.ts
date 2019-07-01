export interface DocumentInfo {
  division: {
    name: string,
    value: number
  },
  filePath: string | null,
  name: string,
  number: number,
  status?: string | null,
  timestamp: number,
  user: {
    profile: UserProfile
  }
}

export interface UserProfile {
  displayName: string,
  uid: string,
  email: string,
  fullName: string | null,
  phone: string | null,
  canEditStatus: boolean | null
}
