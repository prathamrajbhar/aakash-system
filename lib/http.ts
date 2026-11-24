/** RFC 6266 / 5987 Content-Disposition with an ASCII fallback and a UTF-8 name. */
export function contentDisposition(disposition: "inline" | "attachment", filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
