import { http } from '@/lib/http'

export type MenuItem = {
  id: number
  name: string
  route: string
  icon: string
  displayOrder: number
  parentId: number | null
  type: 'TopBar' | 'SideBar'
  children: MenuItem[]
}

type MenuResponse = {
  menus: MenuItem[]
  traceId: string
}

export async function getMenus() {
  const response = await http.get<MenuResponse>('/api/menus')
  const menus = response.data.menus
  return menus
}
