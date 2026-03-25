export function parsePagination(
  rawPage: unknown,
  rawSize: unknown,
  options?: { defaultPage?: number; defaultSize?: number; maxSize?: number }
) {
  const defaultPage = options?.defaultPage ?? 1;
  const defaultSize = options?.defaultSize ?? 20;
  const maxSize = options?.maxSize ?? 100;

  const pageParsed =
    typeof rawPage === "string" || typeof rawPage === "number"
      ? parseInt(String(rawPage), 10)
      : NaN;
  const sizeParsed =
    typeof rawSize === "string" || typeof rawSize === "number"
      ? parseInt(String(rawSize), 10)
      : NaN;

  const page = Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : defaultPage;
  const size = Number.isFinite(sizeParsed) && sizeParsed > 0 ? Math.min(sizeParsed, maxSize) : defaultSize;

  return { page, size, skip: (page - 1) * size, take: size };
}

