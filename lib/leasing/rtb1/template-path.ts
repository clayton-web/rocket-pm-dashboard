import path from "node:path";
import { RTB1_TEMPLATE_RELATIVE_PATH } from "./constants";

export function getRtb1TemplatePath(): string {
  return path.join(process.cwd(), RTB1_TEMPLATE_RELATIVE_PATH);
}
