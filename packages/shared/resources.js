// Presentation-only URLs. Documents always retain their canonical private API paths.
const urls = new Map();
export const resourceUrl = (source) => urls.get(source) || source;
export function registerResource(source, url) {
  const previous = urls.get(source);
  if (previous?.startsWith("blob:") && previous !== url) URL.revokeObjectURL(previous);
  urls.set(source, url);
}
export function clearResources() {
  for (const url of urls.values()) if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  urls.clear();
}
