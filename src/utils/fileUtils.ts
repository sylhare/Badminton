/**
 * Validates if a file is an image
 * @param file File to validate
 * @returns true if file is an image, false otherwise
 */
export function isImageFile(file: File | null | undefined): file is File {
  return file != null && file.type.startsWith('image/');
}

/**
 * Gets the first file from a FileList or DataTransfer
 * @param source FileList or DataTransfer files
 * @returns First file or null
 */
export function getFirstFile(source: FileList | null): File | null {
  return source?.[0] ?? null;
}