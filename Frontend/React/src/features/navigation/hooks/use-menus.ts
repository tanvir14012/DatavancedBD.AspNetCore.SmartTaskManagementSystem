import { useQuery } from '@tanstack/react-query'
import { getMenus } from '../api/menu-api'

export function useMenus() {
  return useQuery({
    queryKey: ['navigation', 'menus'],
    queryFn: getMenus,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
