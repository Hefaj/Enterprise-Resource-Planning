export type MediaType = 'image' | 'video' | 'audio' | 'document' | '3d-model' | 'unknown';

export interface MultimediaVM {
  uuid: string;
  productUuid: string;
  fileName: string;
  mediaType: MediaType;
  thumbnailUrl: string | null;
  originalUrl: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: Date;
}
