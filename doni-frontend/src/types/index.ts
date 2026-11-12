export interface User {
  id: string
  email: string
  name: string
  role: string
  createdAt: Date
  updatedAt: Date
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
