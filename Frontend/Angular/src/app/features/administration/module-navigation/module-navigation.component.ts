import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../../core/services/notification.service';
import {
  PageHeaderComponent,
  PageAction,
} from '../../../shared/components/page-header/page-header.component';
import { TableColumn } from '../../../shared/components/data-table/data-table.model';
import { TableExportTemplateDto } from '../../../shared/models/template-dto.model';
import { PdfExportService } from '../../../shared/services/pdf-export.service';
import {
  ImportModuleNavigationsInput,
  ModuleNavigationDto,
  ModuleNavigationInput,
  ModuleNavigationService,
  SidebarMenuItemDto,
  SidebarMenuItemInput,
} from './module-navigation.service';

interface BuildingBlockOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-module-navigation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header titleKey="administration.moduleNavigation.title" [actions]="headerActions" />

    <mat-card class="mb-4 top-nav-card">
      <mat-card-content class="p-4">
        <div class="flex items-center gap-3 mb-3 flex-wrap">
          <mat-form-field>
            <mat-label>{{
              'administration.moduleNavigation.fields.buildingBlock' | translate
            }}</mat-label>
            <mat-select
              [value]="selectedBuildingBlock()"
              (valueChange)="onBuildingBlockChange($event)"
            >
              @for (block of buildingBlocks; track block.value) {
                <mat-option [value]="block.value">{{ block.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <span class="text-sm text-gray-500">{{
            'administration.moduleNavigation.topNavHint' | translate
          }}</span>
        </div>

        <div class="flex gap-2 flex-wrap">
          @for (module of modules(); track module.id) {
            <button
              mat-stroked-button
              [class.module-selected]="selectedModuleId() === module.id"
              (click)="selectModule(module)"
            >
              <mat-icon>{{ module.materialIconName }}</mat-icon>
              {{ module.localizedName }}
            </button>
          }
        </div>
      </mat-card-content>
    </mat-card>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{
            'administration.moduleNavigation.editorTitle' | translate
          }}</mat-card-title>
        </mat-card-header>
        <mat-card-content class="pt-4">
          <form [formGroup]="form" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <mat-form-field>
              <mat-label>{{
                'administration.moduleNavigation.fields.systemName' | translate
              }}</mat-label>
              <input matInput formControlName="systemName" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{
                'administration.moduleNavigation.fields.menuId' | translate
              }}</mat-label>
              <input matInput formControlName="menuId" />
            </mat-form-field>
            <mat-form-field class="md:col-span-2">
              <mat-label>{{
                'administration.moduleNavigation.fields.localizedName' | translate
              }}</mat-label>
              <input matInput formControlName="localizedName" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{
                'administration.moduleNavigation.fields.displayOrder' | translate
              }}</mat-label>
              <input matInput type="number" formControlName="displayOrder" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{
                'administration.moduleNavigation.fields.materialIconName' | translate
              }}</mat-label>
              <input matInput formControlName="materialIconName" />
            </mat-form-field>
            <div class="md:col-span-2 flex items-center">
              <mat-slide-toggle formControlName="isActive">
                {{ 'administration.moduleNavigation.fields.isActive' | translate }}
              </mat-slide-toggle>
            </div>
            <mat-form-field class="md:col-span-2">
              <mat-label>{{
                'administration.moduleNavigation.fields.sidebarItemsJson' | translate
              }}</mat-label>
              <textarea matInput rows="12" formControlName="sidebarJson"></textarea>
            </mat-form-field>
          </form>
        </mat-card-content>
        <mat-card-actions align="end" class="pb-4 pr-4">
          <button mat-button (click)="resetForm()">{{ 'common.reset' | translate }}</button>
          <button mat-flat-button color="primary" (click)="saveModule()">
            {{ form.value.id ? ('common.edit' | translate) : ('common.add' | translate) }}
          </button>
        </mat-card-actions>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title>{{
            'administration.moduleNavigation.sidebarPreviewTitle' | translate
          }}</mat-card-title>
        </mat-card-header>
        <mat-card-content class="pt-4">
          @if (selectedModule(); as activeModule) {
            <div class="sidebar-preview rounded-lg p-3">
              <div class="font-semibold mb-3">{{ activeModule.localizedName }}</div>
              @for (item of activeModule.sidebarItems; track item.id) {
                <div class="sidebar-item">
                  <mat-icon>{{ item.materialIconName }}</mat-icon>
                  <span>{{ item.localizedName }}</span>
                </div>
                @for (child of item.children; track child.id) {
                  <div class="sidebar-sub-item">
                    <mat-icon>{{ child.materialIconName }}</mat-icon>
                    <span>{{ child.localizedName }}</span>
                  </div>
                }
              }
            </div>
          } @else {
            <p class="text-sm text-gray-500">{{ 'common.noData' | translate }}</p>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .top-nav-card {
        background: linear-gradient(135deg, #f8fafc, #eef2ff);
      }
      .module-selected {
        border-color: #0f766e !important;
        color: #0f766e !important;
      }
      .sidebar-preview {
        background: #0b5b4b;
        color: #ecfeff;
      }
      .sidebar-item,
      .sidebar-sub-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
      }
      .sidebar-item:hover,
      .sidebar-sub-item:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .sidebar-sub-item {
        margin-left: 26px;
        opacity: 0.92;
      }
      .sidebar-item mat-icon,
      .sidebar-sub-item mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    `,
  ],
})
export class ModuleNavigationComponent {
  private readonly service = inject(ModuleNavigationService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly pdfExport = inject(PdfExportService);
  private readonly translate = inject(TranslateService);

  readonly selectedBuildingBlock = signal<number>(1);
  readonly modules = signal<ModuleNavigationDto[]>([]);
  readonly selectedModuleId = signal<string | null>(null);

  readonly selectedModule = computed(
    () => this.modules().find((x) => x.id === this.selectedModuleId()) ?? null,
  );

  readonly pdfColumns: TableColumn<ModuleNavigationDto>[] = [
    { key: 'localizedName', headerKey: 'administration.moduleNavigation.fields.localizedName' },
    { key: 'systemName', headerKey: 'administration.moduleNavigation.fields.systemName' },
    { key: 'menuId', headerKey: 'administration.moduleNavigation.fields.menuId' },
    { key: 'displayOrder', headerKey: 'administration.moduleNavigation.fields.displayOrder' },
    {
      key: 'isActive',
      headerKey: 'common.status',
      pdfRender: (row) =>
        this.translate.instant(row.isActive ? 'common.active' : 'common.inactive'),
    },
    {
      key: 'sidebarItems',
      headerKey: 'administration.moduleNavigation.sidebarPreviewTitle',
      pdfRender: (row) => this.countSidebarItems(row.sidebarItems),
    },
  ];

  readonly buildingBlocks: BuildingBlockOption[] = [
    { value: 1, label: 'Headquarters' },
    { value: 2, label: 'SubDepot' },
    { value: 3, label: 'Branch' },
    { value: 4, label: 'Directorate' },
    { value: 5, label: 'Group' },
    { value: 6, label: 'Cell' },
    { value: 7, label: 'Section' },
    { value: 8, label: 'Division' },
    { value: 9, label: 'Brigade' },
    { value: 10, label: 'Battalion' },
    { value: 11, label: 'Regiment' },
    { value: 12, label: 'Company' },
    { value: 13, label: 'Platoon' },
    { value: 14, label: 'Squadron' },
    { value: 15, label: 'Troop' },
    { value: 16, label: 'Battery' },
  ];

  readonly form = this.fb.nonNullable.group({
    id: [''],
    systemName: ['', [Validators.required]],
    menuId: ['', [Validators.required]],
    localizedName: ['', [Validators.required]],
    displayOrder: [10, [Validators.required]],
    materialIconName: ['apps', [Validators.required]],
    isActive: [true],
    sidebarJson: ['[]'],
  });

  readonly headerActions: PageAction[] = [
    {
      labelKey: 'administration.moduleNavigation.actions.importDefault',
      icon: 'upload',
      action: () => this.importDefaultTemplate(),
      color: 'primary',
    },
    {
      labelKey: 'administration.moduleNavigation.actions.export',
      icon: 'download',
      action: () => this.exportCurrent(),
      color: 'accent',
    },
    {
      labelKey: 'common.exportPdf',
      icon: 'picture_as_pdf',
      action: () => this.exportCurrentPdf(),
      color: 'accent',
    },
  ];

  constructor() {
    this.loadModules();
  }

  onBuildingBlockChange(value: number): void {
    this.selectedBuildingBlock.set(value);
    this.selectedModuleId.set(null);
    this.resetForm();
    this.loadModules();
  }

  selectModule(module: ModuleNavigationDto): void {
    this.selectedModuleId.set(module.id);
    this.form.patchValue({
      id: module.id,
      systemName: module.systemName,
      menuId: module.menuId,
      localizedName: module.localizedName,
      displayOrder: module.displayOrder,
      materialIconName: module.materialIconName,
      isActive: module.isActive,
      sidebarJson: JSON.stringify(this.toSidebarInputs(module.sidebarItems), null, 2),
    });
  }

  saveModule(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    let sidebarItems: SidebarMenuItemInput[] = [];
    try {
      const raw = this.form.value.sidebarJson?.trim();
      sidebarItems = raw ? JSON.parse(raw) : [];
    } catch {
      this.notify.error('common.error');
      return;
    }

    const input: ModuleNavigationInput = {
      id: this.form.value.id || null,
      systemName: this.form.value.systemName?.trim() ?? '',
      menuId: this.form.value.menuId?.trim() ?? '',
      localizedName: this.form.value.localizedName?.trim() ?? '',
      displayOrder: Number(this.form.value.displayOrder ?? 0),
      materialIconName: this.form.value.materialIconName?.trim() ?? 'apps',
      isActive: !!this.form.value.isActive,
      sidebarItems,
    };

    if (input.id) {
      const moduleId = input.id;
      this.service.update(input.id, input).subscribe({
        next: () => {
          this.notify.success('common.success');
          this.loadModules(moduleId);
        },
        error: () => this.notify.error('common.error'),
      });
      return;
    }

    this.service.create(this.selectedBuildingBlock(), input).subscribe({
      next: (created) => {
        this.notify.success('common.success');
        this.loadModules(created.id);
      },
      error: () => this.notify.error('common.error'),
    });
  }

  resetForm(): void {
    this.form.reset({
      id: '',
      systemName: '',
      menuId: '',
      localizedName: '',
      displayOrder: 10,
      materialIconName: 'apps',
      isActive: true,
      sidebarJson: '[]',
    });
  }

  private loadModules(selectId?: string): void {
    this.service.get(this.selectedBuildingBlock()).subscribe({
      next: (data) => {
        this.modules.set(data.sort((a, b) => a.displayOrder - b.displayOrder));
        const preferred = selectId ?? this.selectedModuleId() ?? data[0]?.id ?? null;
        this.selectedModuleId.set(preferred);
      },
      error: () => this.notify.error('common.error'),
    });
  }

  private importDefaultTemplate(): void {
    const payload: ImportModuleNavigationsInput = {
      buildingBlockType: this.selectedBuildingBlock(),
      useDerivedSidebarWhenEmpty: true,
      modules: [
        {
          systemName: 'dashboard',
          menuId: 'dashboard',
          localizedName: 'Dashboard',
          displayOrder: 10,
          materialIconName: 'dashboard',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'procurement',
          menuId: 'procurement',
          localizedName: 'Procurement',
          displayOrder: 20,
          materialIconName: 'shopping_cart',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'issue-receipt',
          menuId: 'issue-receipt',
          localizedName: 'Issue & Receipt',
          displayOrder: 30,
          materialIconName: 'inventory_2',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'traffic-security',
          menuId: 'traffic-security',
          localizedName: 'Traffic & Security',
          displayOrder: 40,
          materialIconName: 'shield',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'store-management',
          menuId: 'store-management',
          localizedName: 'Store Management',
          displayOrder: 50,
          materialIconName: 'inventory_2',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'repair-maintenance',
          menuId: 'repair-maintenance',
          localizedName: 'Repair & Maintenance',
          displayOrder: 60,
          materialIconName: 'build',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'salvage',
          menuId: 'salvage',
          localizedName: 'Salvage',
          displayOrder: 70,
          materialIconName: 'recycling',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'budget-planning',
          menuId: 'budget-planning',
          localizedName: 'Budget & Planning',
          displayOrder: 80,
          materialIconName: 'account_balance_wallet',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'inspectorate',
          menuId: 'inspectorate',
          localizedName: 'Inspectorate',
          displayOrder: 90,
          materialIconName: 'manage_search',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'administration',
          menuId: 'administration',
          localizedName: 'Administration',
          displayOrder: 100,
          materialIconName: 'admin_panel_settings',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'communication',
          menuId: 'communication',
          localizedName: 'Communication',
          displayOrder: 110,
          materialIconName: 'chat',
          isActive: true,
          sidebarItems: [],
        },
        {
          systemName: 'dms',
          menuId: 'dms',
          localizedName: 'DMS',
          displayOrder: 120,
          materialIconName: 'description',
          isActive: true,
          sidebarItems: [],
        },
      ],
    };

    this.service.import(payload).subscribe({
      next: (items) => {
        this.notify.success('common.importSuccess', { count: items.length });
        this.modules.set(items);
        const firstId = items[0]?.id ?? null;
        this.selectedModuleId.set(firstId);
        if (firstId) {
          const module = items.find((x) => x.id === firstId);
          if (module) {
            this.selectModule(module);
          }
        }
      },
      error: () => this.notify.error('common.error'),
    });
  }

  private exportCurrent(): void {
    this.service.export(this.selectedBuildingBlock()).subscribe({
      next: (rows) => {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `module-navigation-${this.selectedBuildingBlock()}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
      },
      error: () => this.notify.error('common.error'),
    });
  }

  private exportCurrentPdf(): void {
    const rows = this.modules();
    const selectedBlock =
      this.buildingBlocks.find((x) => x.value === this.selectedBuildingBlock())?.label ?? '';
    const template: TableExportTemplateDto<ModuleNavigationDto> = {
      fileName: `module-navigation-${this.selectedBuildingBlock()}`,
      title: this.translate.instant('administration.moduleNavigation.title'),
      subtitle: `${this.translate.instant('administration.moduleNavigation.fields.buildingBlock')}: ${selectedBlock} | ${this.translate.instant('common.total')}: ${rows.length}`,
      rows,
      columns: this.pdfColumns,
      orientation: 'landscape',
      resolveHeader: (headerKey: string) => this.translate.instant(headerKey),
    };
    void this.pdfExport.exportTable(template).catch(() => this.notify.error('common.error'));
  }

  private countSidebarItems(items: SidebarMenuItemDto[]): number {
    return items.reduce((total, item) => total + 1 + this.countSidebarItems(item.children), 0);
  }

  private toSidebarInputs(items: SidebarMenuItemDto[]): SidebarMenuItemInput[] {
    return items.map((item) => ({
      id: item.id,
      parentSidebarMenuItemId: item.parentSidebarMenuItemId,
      systemName: item.systemName,
      menuId: item.menuId,
      localizedName: item.localizedName,
      displayOrder: item.displayOrder,
      materialIconName: item.materialIconName,
      isActive: item.isActive,
      children: this.toSidebarInputs(item.children),
    }));
  }
}
