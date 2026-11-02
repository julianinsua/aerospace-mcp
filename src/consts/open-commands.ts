import type { Opener } from "../config.js";

// the target app is only known at run time, so app-specific terms must be written as raw codes
export const NEW_WINDOW_COMMANDS = {
  window: "make new window",
  document: "make new document",
  finderWindow: "make new «class brow»",
  terminalWindow: '«event coredosc» ""',
} as const;

export type WindowKind = keyof typeof NEW_WINDOW_COMMANDS;

export const KNOWN_APPS: Record<string, Opener> = {
  "com.google.Chrome": { type: "applescript", command: NEW_WINDOW_COMMANDS.window },
  "com.apple.Safari": { type: "applescript", command: NEW_WINDOW_COMMANDS.document },
  "com.apple.finder": { type: "applescript", command: NEW_WINDOW_COMMANDS.finderWindow },
  "com.apple.Terminal": { type: "applescript", command: NEW_WINDOW_COMMANDS.terminalWindow },
};

// the dictionary path may only pick these, in this order
export const DICTIONARY_KINDS = ["document", "window"] as const;
