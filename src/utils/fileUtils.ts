export function isImageFile(file: File | null | undefined): file is File {
  return file != null && file.type.startsWith('image/');
}

export function getFirstFile(source: FileList | null): File | null {
  return source?.[0] ?? null;
}