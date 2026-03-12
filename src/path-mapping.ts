export interface PathMapping {
  from: string;
  to: string;
}

function normalizeForCompare(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function applyPathMappings(
  filePath: string,
  mappings: PathMapping[] = []
): string {
  const normalizedInput = normalizeForCompare(filePath);
  let bestMatch:
    | {
        from: string;
        to: string;
      }
    | undefined;

  for (const mapping of mappings) {
    const from = normalizeForCompare(mapping.from || "");
    const to = normalizeForCompare(mapping.to || "");

    if (!from || !to) {
      continue;
    }

    const isExactMatch = normalizedInput === from;
    const isNestedMatch = normalizedInput.startsWith(`${from}/`);
    if (!isExactMatch && !isNestedMatch) {
      continue;
    }

    if (!bestMatch || from.length > bestMatch.from.length) {
      bestMatch = { from, to };
    }
  }

  if (!bestMatch) {
    return filePath;
  }

  const remainder = normalizedInput.slice(bestMatch.from.length);
  return `${bestMatch.to}${remainder}`;
}
