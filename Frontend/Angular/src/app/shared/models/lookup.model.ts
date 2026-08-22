/** Generic lookup item loaded from API via route resolver */
export interface LookupItem {
  id: string | number;
  nameEn: string;
  nameAr: string;
  code?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export type LookupMap = Record<string, LookupItem[]>;
