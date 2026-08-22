import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { BaseFormComponent } from '../../../shared/components/base-form/base-form.component';
import {
  CreateDepartmentCommand,
  DepartmentDto,
  DepartmentsService,
  UpdateDepartmentCommand,
} from './departments.service';

@Component({
  selector: 'app-department-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{
        data
          ? ('administration.departments.editTitle' | translate)
          : ('administration.departments.addNew' | translate)
      }}
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        <mat-form-field>
          <mat-label>{{ 'administration.departments.fields.nameEn' | translate }}</mat-label>
          <input matInput formControlName="nameEn" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'administration.departments.fields.nameAr' | translate }}</mat-label>
          <input matInput formControlName="nameAr" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'administration.departments.fields.code' | translate }}</mat-label>
          <input matInput formControlName="code" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'administration.departments.fields.parentId' | translate }}</mat-label>
          <mat-select formControlName="parentId">
            <mat-option [value]="null">—</mat-option>
            @for (department of availableParents(); track department.id) {
              <mat-option [value]="department.id">{{ department.nameEn }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="md:col-span-2">
          <mat-slide-toggle formControlName="isActive">
            {{ 'administration.departments.fields.isActive' | translate }}
          </mat-slide-toggle>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.cancel' | translate }}</button>
      <button mat-flat-button color="primary" (click)="onSubmit()">
        {{ 'common.save' | translate }}
      </button>
    </mat-dialog-actions>
  `,
})
export class DepartmentFormDialogComponent extends BaseFormComponent<DepartmentDto> {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(DepartmentsService);
  private readonly dialogRef = inject(MatDialogRef<DepartmentFormDialogComponent>);
  readonly data = inject<DepartmentDto | null>(MAT_DIALOG_DATA);

  readonly availableParents = signal<DepartmentDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    nameEn: [this.data?.nameEn ?? '', [Validators.required]],
    nameAr: [this.data?.nameAr ?? '', [Validators.required]],
    code: [this.data?.code ?? '', [Validators.required]],
    parentId: [this.data?.parentId ?? (null as string | null)],
    isActive: [this.data?.isActive ?? true],
  });

  protected override get cacheInvalidationKeys(): string[] {
    return ['administration/departments'];
  }

  constructor() {
    super();
    this.service
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.availableParents.set(items.filter((item) => item.id !== this.data?.id));
      });
  }

  protected submit$(): Observable<DepartmentDto> {
    const payload: CreateDepartmentCommand = {
      nameEn: this.form.getRawValue().nameEn.trim(),
      nameAr: this.form.getRawValue().nameAr.trim(),
      code: this.form.getRawValue().code.trim(),
      parentId: this.form.getRawValue().parentId,
      isActive: this.form.getRawValue().isActive,
    };

    if (this.data) {
      const command: UpdateDepartmentCommand = {
        id: this.data.id,
        ...payload,
      };
      return this.service.update(command);
    }

    return this.service.create(payload);
  }

  protected override onSuccess(_result: DepartmentDto): void {
    super.onSuccess(_result);
    this.dialogRef.close(true);
  }
}
