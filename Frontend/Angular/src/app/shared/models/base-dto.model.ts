/** Common audit fields mirroring backend EntityBase */
export interface BaseDto {
  id: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

/** Bilingual named entity – mirrors backend pattern (NameEn / NameAr) */
export interface BilingualDto extends BaseDto {
  nameEn: string;
  nameAr: string;
}
