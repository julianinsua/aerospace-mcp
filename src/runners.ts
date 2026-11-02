import { createAerospaceRunner } from "./aerospace-bin.js";
import { createRunner, type Runner } from "./process.js";

export interface Runners {
  aerospace: Runner;
  mdfind: Runner;
  mdls: Runner;
  open: Runner;
  osascript: Runner;
  plutil: Runner;
  exec: (bin: string) => Runner;
}

export const createRunners = (): Runners => {
  return {
    aerospace: createAerospaceRunner(),
    mdfind: createRunner("/usr/bin/mdfind"),
    mdls: createRunner("/usr/bin/mdls"),
    open: createRunner("/usr/bin/open"),
    // the first call to each app waits on the macOS automation permission dialog
    osascript: createRunner("/usr/bin/osascript", 60_000),
    plutil: createRunner("/usr/bin/plutil"),
    exec: (bin) => createRunner(bin),
  };
};
