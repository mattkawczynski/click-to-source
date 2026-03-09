import type { PluginObj, PluginPass } from "@babel/core";
import { DATA_ATTR } from "./constants.ts";

interface BabelPluginOptions {
  enabled?: boolean;
  attribute?: string;
}

type BabelState = PluginPass & {
  opts: BabelPluginOptions;
};

/**
 * Babel plugin that adds data-click-to-source attributes to JSX elements
 * with file path, line, and column information.
 *
 * Usage in babel.config.js:
 * {
 *   plugins: [
 *     ['click-to-source/babel', { enabled: process.env.NODE_ENV === 'development' }]
 *   ]
 * }
 */
export default function clickToSourceBabelPlugin(
  babel: typeof import("@babel/core")
): PluginObj<BabelState> {
  const { types } = babel;

  return {
    name: "click-to-source-babel-plugin",
    visitor: {
      JSXOpeningElement(path, state) {
        const options = state.opts || {};
        if (options.enabled === false) return;

        // Skip if filename is not available (in tests, etc)
        if (!state.file.opts.filename) {
          return;
        }

        const element = path.node;
        const { line, column } = element.loc?.start || { line: 1, column: 0 };
        const normalizedLine = line > 0 ? line : 1;
        const normalizedColumn = column >= 0 ? column + 1 : 1;

        // Normalize Windows paths to forward slashes
        const normalizedPath = state.file.opts.filename.replace(/\\/g, "/");
        const sourceValue = `${normalizedPath}:${normalizedLine}:${normalizedColumn}`;

        const attributeName = options.attribute || DATA_ATTR;

        // Check if data-click-to-source attribute already exists
        const hasAttribute = element.attributes.some(
          (attr) =>
            types.isJSXAttribute(attr) &&
            types.isJSXIdentifier(attr.name) &&
            attr.name.name === attributeName
        );

        if (!hasAttribute) {
          // Create the attribute
          const attribute = types.jSXAttribute(
            types.jSXIdentifier(attributeName),
            types.stringLiteral(sourceValue)
          );

          element.attributes.push(attribute);
        }
      },
    },
  };
}
