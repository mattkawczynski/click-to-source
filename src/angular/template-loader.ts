import type { LoaderDefinitionFunction } from "webpack";
import { instrumentAngularTemplate } from "./instrument-template";

const loader: LoaderDefinitionFunction = function (source) {
  const filename = this.resourcePath || "unknown";
  return instrumentAngularTemplate(source as string, filename);
};

export default loader;
