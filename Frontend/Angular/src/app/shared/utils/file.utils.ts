/** Convert bytes to a human-readable size string. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Extract file extension (lowercase, without dot). */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

/** Validate file against accepted types and max size. */
export function validateFile(
  file: File,
  acceptedTypes: string[],
  maxSizeBytes: number,
): { valid: boolean; error?: 'type' | 'size' } {
  const ext = getFileExtension(file.name);
  if (acceptedTypes.length > 0 && !acceptedTypes.includes(ext)) {
    return { valid: false, error: 'type' };
  }
  if (file.size > maxSizeBytes) {
    return { valid: false, error: 'size' };
  }
  return { valid: true };
}

/** Trigger browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
