import pkg from "../package.json";

/** The CLI's own version, from package.json, inlined at build time. */
export const CLI_VERSION: string = pkg.version;
