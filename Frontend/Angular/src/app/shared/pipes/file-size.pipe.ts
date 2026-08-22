import { Pipe, PipeTransform } from '@angular/core';
import { formatFileSize } from '../utils/file.utils';

@Pipe({ name: 'fileSize', standalone: true })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined): string {
    return formatFileSize(bytes ?? 0);
  }
}
