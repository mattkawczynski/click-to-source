import test from "node:test";
import assert from "node:assert/strict";
import { resolveFromSourceMap } from "../src/sourcemap-resolve.ts";

/**
 * Helper: encode a single VLQ value.
 * This is the inverse of the decodeVLQ inside sourcemap-resolve.ts,
 * used to build test source maps with known mappings.
 */
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function encodeVLQ(values: number[]): string {
  let result = "";
  for (const v of values) {
    let n = v < 0 ? (-v << 1) | 1 : v << 1;
    do {
      let digit = n & 31;
      n >>>= 5;
      if (n > 0) digit |= 32;
      result += BASE64[digit];
    } while (n > 0);
  }
  return result;
}

// The module caches fetch results by URL, so each test must use a unique chunk URL.
let chunkCounter = 0;
function uniqueChunkUrl(): string {
  return `http://localhost:3000/chunk-${++chunkCounter}.js`;
}

/**
 * Install a mock fetch that returns the given source map JSON
 * for any URL ending with ".map", and 404 for everything else.
 */
function mockFetch(sourceMap: object): () => void {
  const original = globalThis.fetch;
  (globalThis as any).fetch = async (url: string) => {
    if (url.endsWith(".map")) {
      return {
        ok: true,
        json: async () => sourceMap,
        text: async () => JSON.stringify(sourceMap),
      };
    }
    return { ok: false, status: 404 };
  };
  return () => {
    (globalThis as any).fetch = original;
  };
}

// ─── VLQ encoding/decoding (tested indirectly via resolveFromSourceMap) ───

test("VLQ: single segment mapping resolves correctly", async () => {
  // Mapping: gen col 0, source 0, orig line 0, orig col 0 → all zeros
  // encodeVLQ([0,0,0,0]) = "AAAA"
  assert.equal(encodeVLQ([0, 0, 0, 0]), "AAAA");

  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["src/app.tsx"],
    mappings: "AAAA",
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.ok(result);
    assert.equal(result.file, "src/app.tsx");
    assert.equal(result.line, 1);
    assert.equal(result.column, 1);
  } finally {
    restore();
  }
});

test("VLQ: negative delta values decode correctly", async () => {
  // Two lines: first maps gen(1,1)->orig(1,5), second maps gen(2,1)->orig(1,3)
  // Line 1 segment: genCol=0, srcIdx=0, origLine=0, origCol=4  → [0,0,0,4]
  // Line 2 segment: genCol=0, srcIdx=0, origLine=0, origCol=-2 → [0,0,0,-2]
  const seg1 = encodeVLQ([0, 0, 0, 4]);
  const seg2 = encodeVLQ([0, 0, 0, -2]);
  const mappings = `${seg1};${seg2}`;

  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["index.ts"],
    mappings,
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 2, 1);
    assert.ok(result);
    assert.equal(result.file, "index.ts");
    assert.equal(result.line, 1);
    assert.equal(result.column, 3); // 5 - 2 = 3
  } finally {
    restore();
  }
});

// ─── Regular (non-sectioned) source map ───

test("regular source map: resolves line and column to original location", async () => {
  // gen line 1, col 1 -> source 0, orig line 0, orig col 0
  // gen line 1, col 10 -> source 0, orig line 4, orig col 2
  const seg1 = encodeVLQ([0, 0, 0, 0]);
  const seg2 = encodeVLQ([9, 0, 4, 2]); // genCol delta=9, src=0, origLine delta=4, origCol delta=2
  const mappings = `${seg1},${seg2}`;

  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["components/Button.tsx"],
    mappings,
  };
  const restore = mockFetch(sourceMap);
  try {
    // Query gen line 1, col 11 → should match seg2 (genCol 10 <= 11)
    const result = await resolveFromSourceMap(chunkUrl, 1, 11);
    assert.ok(result);
    assert.equal(result.file, "components/Button.tsx");
    assert.equal(result.line, 5);  // origLine 0+4 = 4, +1 = 5
    assert.equal(result.column, 3); // origCol 0+2 = 2, +1 = 3
  } finally {
    restore();
  }
});

test("regular source map: applies sourceRoot prefix", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["app.tsx"],
    sourceRoot: "/project/src/",
    mappings: encodeVLQ([0, 0, 0, 0]),
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.ok(result);
    assert.equal(result.file, "/project/src/app.tsx");
  } finally {
    restore();
  }
});

test("regular source map: multiple sources, picks correct source index", async () => {
  // seg1: genCol=0, srcIdx=0, origLine=0, origCol=0
  // seg2: genCol=5, srcIdx=1, origLine=2, origCol=3  (srcIdx delta=1)
  const seg1 = encodeVLQ([0, 0, 0, 0]);
  const seg2 = encodeVLQ([5, 1, 2, 3]);
  const mappings = `${seg1},${seg2}`;

  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["a.ts", "b.ts", "c.ts"],
    mappings,
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 6);
    assert.ok(result);
    assert.equal(result.file, "b.ts");
    assert.equal(result.line, 3);
    assert.equal(result.column, 4);
  } finally {
    restore();
  }
});

test("regular source map: falls back to closest preceding line when exact line has no column match", async () => {
  // Only a mapping on line 1
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["fallback.ts"],
    mappings: encodeVLQ([0, 0, 0, 0]),
  };
  const restore = mockFetch(sourceMap);
  try {
    // Query line 5 — no mapping on line 5, should fall back to line 1
    const result = await resolveFromSourceMap(chunkUrl, 5, 1);
    assert.ok(result);
    assert.equal(result.file, "fallback.ts");
    assert.equal(result.line, 1);
  } finally {
    restore();
  }
});

// ─── Sectioned (index) source map ───

test("sectioned source map: resolves through section offsets", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sections: [
      {
        offset: { line: 0, column: 0 },
        map: {
          version: 3,
          sources: ["section-a.ts"],
          mappings: encodeVLQ([0, 0, 0, 0]),
        },
      },
      {
        offset: { line: 10, column: 0 },
        map: {
          version: 3,
          sources: ["section-b.ts"],
          mappings: encodeVLQ([0, 0, 0, 0]),
        },
      },
    ],
  };
  const restore = mockFetch(sourceMap);
  try {
    // Line 11 (offset.line=10, 0-based → section starts at gen line 11)
    // relLine = 11 - 10 = 1, relCol = 1 (first line of section, col offset=0)
    const result = await resolveFromSourceMap(chunkUrl, 11, 1);
    assert.ok(result);
    assert.equal(result.file, "section-b.ts");
    assert.equal(result.line, 1);
    assert.equal(result.column, 1);
  } finally {
    restore();
  }
});

test("sectioned source map: picks correct section for line in first section", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sections: [
      {
        offset: { line: 0, column: 0 },
        map: {
          version: 3,
          sources: ["first.ts"],
          mappings: encodeVLQ([0, 0, 0, 0]),
        },
      },
      {
        offset: { line: 100, column: 0 },
        map: {
          version: 3,
          sources: ["second.ts"],
          mappings: encodeVLQ([0, 0, 0, 0]),
        },
      },
    ],
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.ok(result);
    assert.equal(result.file, "first.ts");
  } finally {
    restore();
  }
});

test("sectioned source map: adjusts column offset on first relative line", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sections: [
      {
        offset: { line: 5, column: 20 },
        map: {
          version: 3,
          sources: ["offset-col.ts"],
          // Mapping at genCol=0 (relative) → maps to orig(1,1)
          mappings: encodeVLQ([0, 0, 0, 0]),
        },
      },
    ],
  };
  const restore = mockFetch(sourceMap);
  try {
    // gen line 6 (offset.line 5 + 1), gen col 21 (offset.column 20 + 1)
    // relLine = 6 - 5 = 1 (first line of section)
    // relCol = 21 - 20 = 1
    const result = await resolveFromSourceMap(chunkUrl, 6, 21);
    assert.ok(result);
    assert.equal(result.file, "offset-col.ts");
    assert.equal(result.line, 1);
    assert.equal(result.column, 1);
  } finally {
    restore();
  }
});

// ─── file:/// URL handling ───

test("converts file:/// URLs to filesystem paths", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["file:///C:/Users/dev/project/src/app.tsx"],
    mappings: encodeVLQ([0, 0, 0, 0]),
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.ok(result);
    assert.equal(result.file, "C:/Users/dev/project/src/app.tsx");
  } finally {
    restore();
  }
});

test("decodes percent-encoded characters in file:/// URLs", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["file:///C:/My%20Project/src/app.tsx"],
    mappings: encodeVLQ([0, 0, 0, 0]),
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.ok(result);
    assert.equal(result.file, "C:/My Project/src/app.tsx");
  } finally {
    restore();
  }
});

test("normalizes backslashes to forward slashes in file paths", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["file:///C:\\Users\\dev\\src\\app.tsx"],
    mappings: encodeVLQ([0, 0, 0, 0]),
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.ok(result);
    assert.equal(result.file, "C:/Users/dev/src/app.tsx");
  } finally {
    restore();
  }
});

// ─── Null / missing data handling ───

test("returns null when fetch fails (404)", async () => {
  const original = globalThis.fetch;
  (globalThis as any).fetch = async () => ({ ok: false, status: 404 });
  try {
    const result = await resolveFromSourceMap(uniqueChunkUrl(), 1, 1);
    assert.equal(result, null);
  } finally {
    (globalThis as any).fetch = original;
  }
});

test("returns null when source map has no mappings", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["app.ts"],
    mappings: "",
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.equal(result, null);
  } finally {
    restore();
  }
});

test("returns null when source map has no sources", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    mappings: encodeVLQ([0, 0, 0, 0]),
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.equal(result, null);
  } finally {
    restore();
  }
});

test("returns null when mappings only have short segments (< 4 fields)", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sources: ["app.ts"],
    // Single field segment (only genCol delta) — should be skipped
    mappings: encodeVLQ([0]),
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.equal(result, null);
  } finally {
    restore();
  }
});

test("returns null when sectioned map has empty sections array", async () => {
  const chunkUrl = uniqueChunkUrl();
  const sourceMap = {
    version: 3,
    sections: [],
  };
  const restore = mockFetch(sourceMap);
  try {
    const result = await resolveFromSourceMap(chunkUrl, 1, 1);
    assert.equal(result, null);
  } finally {
    restore();
  }
});

test("returns null when fetch throws an error", async () => {
  const original = globalThis.fetch;
  (globalThis as any).fetch = async () => {
    throw new Error("network error");
  };
  try {
    const result = await resolveFromSourceMap(uniqueChunkUrl(), 1, 1);
    assert.equal(result, null);
  } finally {
    (globalThis as any).fetch = original;
  }
});
