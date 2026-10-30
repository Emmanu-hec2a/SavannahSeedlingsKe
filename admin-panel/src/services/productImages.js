export function normalizePrimary(images) {
  const primary = Math.max(0, images.findIndex(image => image.is_primary));
  return images.map((image, index) => ({ ...image, is_primary: index === primary }));
}

export function buildImageChanges(images, originalIds) {
  if (originalIds.some(id => !Number.isSafeInteger(id) || id < 1) ||
      images.some(image => !image.file && (!Number.isSafeInteger(image.id) || image.id < 1))) {
    throw new Error('Photo identifiers are missing. Reload the product after the backend has been updated.');
  }
  const retained = new Set(images.filter(image => !image.file).map(image => image.id));
  const primaryIndex = Math.max(0, images.findIndex(image => image.is_primary));
  const primary = images[primaryIndex];
  return {
    remove_ids: originalIds.filter(id => !retained.has(id)),
    primary: !primary ? null : primary.file
      ? { upload_index: images.slice(0, primaryIndex).filter(image => image.file).length }
      : { id: primary.id },
  };
}

export function productSaveError(error) {
  const response = error?.response;
  if (response?.status >= 500) {
    if (response.status === 503 && typeof response.data?.detail === 'string') return response.data.detail;
    return 'Unable to confirm the save. Reload the product before trying again.';
  }
  const messages = value => typeof value === 'string' ? [value]
    : value && typeof value === 'object' ? Object.values(value).flatMap(messages) : [];
  return messages(response?.data).join(' ') || error?.message || 'Failed to save seedling';
}
