/**
 * Cloudinary applies transformations from the URL path, so a resize needs no
 * second upload and no stored variant.
 */
export function thumbnail(url: string, width = 400): string {
  const marker = "/upload/";
  if (!url.includes(marker)) return url;
  const [head, tail] = url.split(marker, 2);
  return `${head}${marker}c_limit,w_${width},f_auto,q_auto/${tail}`;
}
