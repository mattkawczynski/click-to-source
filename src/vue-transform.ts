import {
  ElementTypes,
  NodeTypes,
  type ElementNode,
  type NodeTransform,
} from "@vue/compiler-core";
import { DATA_ATTR } from "./constants";

export function createVueClickToSourceTransform(
  attribute: string = DATA_ATTR
): NodeTransform {
  return (node, context) => {
    if (node.type !== NodeTypes.ELEMENT) return;

    const element = node as ElementNode;
    if (element.tagType === ElementTypes.TEMPLATE) return;

    const hasAttribute = element.props.some(
      (prop) =>
        prop.type === NodeTypes.ATTRIBUTE && prop.name === attribute
    );

    if (hasAttribute) return;

    const filename = context.filename || "unknown";
    const normalizedPath = filename.replace(/\\/g, "/");
    const line = element.loc.start.line || 1;
    const column = element.loc.start.column || 1;
    const sourceValue = `${normalizedPath}:${line}:${column}`;

    element.props.push({
      type: NodeTypes.ATTRIBUTE,
      name: attribute,
      nameLoc: element.loc,
      value: {
        type: NodeTypes.TEXT,
        content: sourceValue,
        loc: element.loc,
      },
      loc: element.loc,
    });
  };
}
