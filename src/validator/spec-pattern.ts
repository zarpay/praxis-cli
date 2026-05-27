import { basename } from "node:path";

import picomatch from "picomatch";

export function hasGlobChars(pattern: string): boolean {
  return /[*?[\]{}()]/.test(pattern);
}

export function isSpecFile(filePathOrName: string, pattern: string): boolean {
  const name = basename(filePathOrName);
  if (!hasGlobChars(pattern)) {
    return name === pattern;
  }
  return picomatch.isMatch(name, pattern);
}
