import type { LoaderDefinitionFunction } from "webpack";
import { parseFragment, serialize } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import { DATA_ATTR } from "../constants";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

function shouldSkipTag(tagName: string): boolean {
  return (
    tagName === "ng-container" ||
    tagName === "ng-template" ||
    tagName === "ng-content"
  );
}

function hasAttribute(element: Element, name: string): boolean {
  return element.attrs.some((attr) => attr.name === name);
}

function visit(
  node: Node,
  filename: string,
  onElement: (element: Element, value: string) => void
): void {
  if (node.nodeName && (node as Element).tagName) {
    const element = node as Element;
    if (!shouldSkipTag(element.tagName) && !hasAttribute(element, DATA_ATTR)) {
      const loc = (element as any).sourceCodeLocation;
      const line = loc?.startLine || 1;
      const column = loc?.startCol || 1;
      const normalizedPath = filename.replace(/\\/g, "/");
      const value = `${normalizedPath}:${line}:${column}`;
      onElement(element, value);
    }
  }

  if ("childNodes" in node && Array.isArray((node as any).childNodes)) {
    (node as any).childNodes.forEach((child: Node) =>
      visit(child, filename, onElement)
    );
  }
}

const loader: LoaderDefinitionFunction = function (source) {
  const filename = this.resourcePath || "unknown";

  const fragment = parseFragment(source as string, {
    sourceCodeLocationInfo: true,
  }) as DefaultTreeAdapterMap["documentFragment"];

  visit(fragment as unknown as Node, filename, (element, value) => {
    element.attrs.push({ name: DATA_ATTR, value });
  });

  return serialize(fragment);
};

export default loader;
