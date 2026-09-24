export type PageResult<T> = {
  page: number
  pageSize: number
  totalCount: number
  filteredCount: number
  totalPages: number
  items: T[]
}

export type ApiErrorPayload = {
  detail?: string
  message?: string
  title?: string
  errors?: Record<string, string[] | string>
}
