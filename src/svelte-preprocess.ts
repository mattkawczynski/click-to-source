import type { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { parse } from "svelte/compiler";
import MagicString from "magic-string";
import { DATA_ATTR } from "./constants";

function buildLineStarts(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
}

function positionForIndex(lineStarts: number[], index: number): {
  line: number;
  column: number;
} {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = lineStarts[mid];
    const next = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : Infinity;
    if (index >= start && index < next) {
      return { line: mid + 1, column: index - start + 1 };
    }
    if (index < start) high = mid - 1;
    else low = mid + 1;
  }
  return { line: 1, column: 1 };
}

function shouldSkipTag(name: string): boolean {
  return name.startsWith("svelte:");
}

function hasAttribute(attributes: Array<{ name: string }>, name: string): boolean {
  return attributes.some((attr) => attr.name === name);
}

export function clickToSourceSveltePreprocess(): PreprocessorGroup {
  return {
    markup({ content, filename }) {
      if (!filename) return { code: content };

      const ast = parse(content, { filename });
      const ms = new MagicString(content);
      const lineStarts = buildLineStarts(content);
      const normalizedPath = filename.replace(/\\/g, "/");

      const visit = (node: any) => {
        if (!node) return;

        if (node.type === "Element" || node.type === "InlineComponent") {
          if (!shouldSkipTag(node.name) && !hasAttribute(node.attributes, DATA_ATTR)) {
            const pos = positionForIndex(lineStarts, node.start);
            const sourceValue = `${normalizedPath}:${pos.line}:${pos.column}`;
            const insertPos = node.start + 1 + node.name.length;
            ms.appendLeft(insertPos, ` ${DATA_ATTR}="${sourceValue}"`);
          }
        }

        if (Array.isArray(node.children)) {
          node.children.forEach(visit);
        }
      };

      if (ast && ast.html) {
        visit(ast.html);
      }

      return {
        code: ms.toString(),
        map: ms.generateMap({ hires: true }),
      };
    },
  };
}
