import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';

export interface SidebarMenuItemDto {
  id: string;
  parentSidebarMenuItemId: string | null;
  systemName: string;
  menuId: string;
  localizedName: string;
  displayOrder: number;
  materialIconName: string;
  isActive: boolean;
  children: SidebarMenuItemDto[];
}

export interface ModuleNavigationDto {
  id: string;
  buildingBlockType: number;
  systemName: string;
  menuId: string;
  localizedName: string;
  displayOrder: number;
  materialIconName: string;
  isActive: boolean;
  sidebarItems: SidebarMenuItemDto[];
}

export interface SidebarMenuItemInput {
  id?: string | null;
  parentSidebarMenuItemId?: string | null;
  systemName: string;
  menuId: string;
  localizedName: string;
  displayOrder: number;
  materialIconName: string;
  isActive: boolean;
  children?: SidebarMenuItemInput[];
}

export interface ModuleNavigationInput {
  id?: string | null;
  systemName: string;
  menuId: string;
  localizedName: string;
  displayOrder: number;
  materialIconName: string;
  isActive: boolean;
  sidebarItems?: SidebarMenuItemInput[];
}

export interface ImportModuleNavigationsInput {
  buildingBlockType: number;
  modules: ModuleNavigationInput[];
  useDerivedSidebarWhenEmpty?: boolean;
}

interface ReferenceModuleDto {
  MenuId: string;
  SystemName: string;
  LocalizedName: string;
  DisplayOrder: number;
  MaterialIconName: string;
  IsActive: boolean;
}

interface ReferenceSidebarItemDto {
  ModuleMenuId: string;
  MenuId: string;
  ParentMenuId: string;
  SystemName: string;
  LocalizedName: string;
  DisplayOrder: number;
  MaterialIconName: string;
  IsActive: boolean;
}

export interface MilitaryNavigationReferenceDto {
  templateName: string;
  templateVersion: string;
  language: string;
  modules: ReferenceModuleDto[];
  sidebarItems: ReferenceSidebarItemDto[];
}

@Injectable({ providedIn: 'root' })
export class ModuleNavigationService {
  private readonly api = inject(ApiService);
  private readonly path = 'iam/navigation/modules';

  get(buildingBlockType?: number): Observable<ModuleNavigationDto[]> {
    const params = buildingBlockType ? { buildingBlockType: `${buildingBlockType}` } : undefined;
    return this.api.get<ModuleNavigationDto[]>(this.path, params);
  }

  getReferenceTemplate(): Observable<MilitaryNavigationReferenceDto> {
    return this.api.get<MilitaryNavigationReferenceDto>(`${this.path}/reference`);
  }

  loadMilitaryModules(buildingBlockType = 1): Observable<ModuleNavigationDto[]> {
    return this.get(buildingBlockType).pipe(
      switchMap((modules) =>
        modules.length > 0
          ? of(modules)
          : this.getReferenceTemplate().pipe(
              map((reference) => this.mapReferenceToModules(buildingBlockType, reference)),
            ),
      ),
    );
  }

  import(payload: ImportModuleNavigationsInput): Observable<ModuleNavigationDto[]> {
    return this.api.post<ModuleNavigationDto[]>(`${this.path}/import`, payload);
  }

  create(
    buildingBlockType: number,
    module: ModuleNavigationInput,
  ): Observable<ModuleNavigationDto> {
    return this.api.post<ModuleNavigationDto>(this.path, { buildingBlockType, module });
  }

  update(moduleId: string, module: ModuleNavigationInput): Observable<ModuleNavigationDto> {
    return this.api.put<ModuleNavigationDto>(`${this.path}/${moduleId}`, { module });
  }

  export(buildingBlockType: number): Observable<ModuleNavigationDto[]> {
    return this.api.get<ModuleNavigationDto[]>(`${this.path}/export`, {
      buildingBlockType: `${buildingBlockType}`,
    });
  }

  private mapReferenceToModules(
    buildingBlockType: number,
    reference: MilitaryNavigationReferenceDto,
  ): ModuleNavigationDto[] {
    return reference.modules
      .map((module) => ({
        id: `ref-${module.MenuId}`,
        buildingBlockType,
        systemName: module.SystemName,
        menuId: module.MenuId,
        localizedName: module.LocalizedName,
        displayOrder: module.DisplayOrder,
        materialIconName: module.MaterialIconName,
        isActive: module.IsActive,
        sidebarItems: this.buildSidebarTree(module.MenuId, reference.sidebarItems, null),
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  private buildSidebarTree(
    moduleMenuId: string,
    items: ReferenceSidebarItemDto[],
    parentMenuId: string | null,
  ): SidebarMenuItemDto[] {
    return items
      .filter(
        (item) =>
          item.ModuleMenuId === moduleMenuId &&
          ((parentMenuId === null && !item.ParentMenuId) ||
            item.ParentMenuId === (parentMenuId ?? '')),
      )
      .sort((left, right) => left.DisplayOrder - right.DisplayOrder)
      .map((item) => ({
        id: `ref-${moduleMenuId}-${item.MenuId}`,
        parentSidebarMenuItemId: parentMenuId ? `ref-${moduleMenuId}-${parentMenuId}` : null,
        systemName: item.SystemName,
        menuId: item.MenuId,
        localizedName: item.LocalizedName,
        displayOrder: item.DisplayOrder,
        materialIconName: item.MaterialIconName,
        isActive: item.IsActive,
        children: this.buildSidebarTree(moduleMenuId, items, item.MenuId),
      }));
  }
}
