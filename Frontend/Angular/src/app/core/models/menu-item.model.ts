export interface MenuItem {
  id: number;
  name: string;
  route: string;
  icon: string;
  displayOrder: number;
  parentId: number | null;
  type: string;
  children: MenuItem[];
}

export interface MenuResponse {
  topBar: MenuItem[];
  sideBar: MenuItem[];
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  imageUrl: string;
}
