/**
 * Minimal client-side source map resolver.
 * Fetches the .map file for a bundled chunk and resolves
 * a generated line/column back to the original file/line/column.
 * Supports both regular and sectioned (index) source maps.
 */

export interface OriginalLocation {
  file: string;
  line: number;
  column: number;
}

interface SourceMapSection {
  offset: { line: number; column: number };
  map: SimpleSourceMap;
}

interface SimpleSourceMap {
  version: number;
  sources: string[];
  sourceRoot?: string;
  mappings: string;
}

interface IndexSourceMap {
  version: number;
  sources?: string[];
  sections?: SourceMapSection[];
  mappings?: string;
  sourceRoot?: string;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const CHAR_TO_INT: Record<string, number> = {};
for (let i = 0; i < BASE64.length; i++) {
  CHAR_TO_INT[BASE64[i]] = i;
}

function decodeVLQ(encoded: string): number[] {
  const values: number[] = [];
  let shift = 0;
  let value = 0;

  for (let i = 0; i < encoded.length; i++) {
    const digit = CHAR_TO_INT[encoded[i]];
    if (digit === undefined) break;

    const hasContinuation = digit & 32;
    value += (digit & 31) << shift;

    if (hasContinuation) {
      shift += 5;
    } else {
      const isNegative = value & 1;
      value >>= 1;
      values.push(isNegative ? -value : value);
      value = 0;
      shift = 0;
    }
  }

  return values;
}

interface Mapping {
  genLine: number;
  genCol: number;
  srcIdx: number;
  origLine: number;
  origCol: number;
}

function decodeMappings(mappings: string): Mapping[] {
  const result: Mapping[] = [];
  const groups = mappings.split(";");

  let srcIdx = 0;
  let origLine = 0;
  let origCol = 0;

  for (let genLine = 0; genLine < groups.length; genLine++) {
    const group = groups[genLine];
    if (!group) continue;

    let genCol = 0;
    const segments = group.split(",");

    for (const segment of segments) {
      if (!segment) continue;
      const fields = decodeVLQ(segment);
      if (fields.length < 4) continue;

      genCol += fields[0];
      srcIdx += fields[1];
      origLine += fields[2];
      origCol += fields[3];

      result.push({
        genLine: genLine + 1,
        genCol: genCol + 1,
        srcIdx,
        origLine: origLine + 1,
        origCol: origCol + 1,
      });
    }
  }

  return result;
}

function findMapping(mappings: Mapping[], line: number, column: number): Mapping | null {
  let best: Mapping | null = null;

  for (const m of mappings) {
    if (m.genLine === line && m.genCol <= column) {
      if (!best || m.genCol > best.genCol) {
        best = m;
      }
    }
  }

  if (!best) {
    for (const m of mappings) {
      if (m.genLine <= line) {
        if (!best || m.genLine > best.genLine || (m.genLine === best.genLine && m.genCol > best.genCol)) {
          best = m;
        }
      }
    }
  }

  return best;
}

function resolveInSimpleMap(
  map: SimpleSourceMap,
  line: number,
  column: number,
): OriginalLocation | null {
  if (!map.mappings || !map.sources) return null;

  const mappings = decodeMappings(map.mappings);
  const mapping = findMapping(mappings, line, column);
  if (!mapping || mapping.srcIdx < 0 || mapping.srcIdx >= map.sources.length) {
    return null;
  }

  let file = map.sources[mapping.srcIdx];
  if (map.sourceRoot) {
    file = map.sourceRoot + file;
  }

  // Convert file:/// URLs to filesystem paths
  if (file.startsWith("file:///")) {
    file = file.slice(8); // "file:///C:/..." -> "C:/..."
  }
  file = decodeURIComponent(file);
  file = file.replace(/\\/g, "/");

  return {
    file,
    line: mapping.origLine,
    column: mapping.origCol,
  };
}

const cache = new Map<string, Promise<IndexSourceMap | null>>();

async function fetchSourceMap(chunkUrl: string): Promise<IndexSourceMap | null> {
  const cached = cache.get(chunkUrl);
  if (cached) return cached;

  const promise = (async () => {
    try {
      // Try <chunk>.map first
      let mapUrl = chunkUrl + ".map";
      let res = await fetch(mapUrl);

      if (!res.ok) {
        // Fetch the chunk itself to find sourceMappingURL
        const chunkRes = await fetch(chunkUrl);
        if (!chunkRes.ok) return null;
        const text = await chunkRes.text();
        const match = text.match(/\/\/[#@]\s*sourceMappingURL=(.+)/);
        if (!match) return null;

        const mappingUrl = match[1].trim();
        if (mappingUrl.startsWith("data:")) {
          const base64Match = mappingUrl.match(/base64,(.+)/);
          if (!base64Match) return null;
          try {
            return JSON.parse(atob(base64Match[1])) as IndexSourceMap;
          } catch {
            return null;
          }
        }

        const base = chunkUrl.substring(0, chunkUrl.lastIndexOf("/") + 1);
        mapUrl = mappingUrl.startsWith("http") ? mappingUrl : base + mappingUrl;
        res = await fetch(mapUrl);
        if (!res.ok) return null;
      }

      return (await res.json()) as IndexSourceMap;
    } catch {
      return null;
    }
  })();

  cache.set(chunkUrl, promise);
  return promise;
}

export async function resolveFromSourceMap(
  chunkUrl: string,
  line: number,
  column: number,
): Promise<OriginalLocation | null> {
  const map = await fetchSourceMap(chunkUrl);
  if (!map) return null;

  // Sectioned (index) source map — used by Turbopack
  if (map.sections && map.sections.length > 0) {
    // Find the section that contains our line/column.
    // Sections are ordered by offset; pick the last one whose offset <= target.
    let section: SourceMapSection | null = null;
    for (const s of map.sections) {
      const sLine = s.offset.line + 1; // offset is 0-based
      if (sLine <= line) {
        section = s;
      } else {
        break;
      }
    }
    if (!section) return null;

    // Adjust line/column relative to the section offset
    const relLine = line - section.offset.line;
    const relCol = relLine === 1 ? column - section.offset.column : column;

    return resolveInSimpleMap(section.map, relLine, relCol);
  }

  // Regular source map
  if (map.mappings && (map as SimpleSourceMap).sources) {
    return resolveInSimpleMap(map as SimpleSourceMap, line, column);
  }

  return null;
}
