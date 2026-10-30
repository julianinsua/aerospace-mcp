import { createAerospaceRunner } from "./aerospace-bin.js";
import { createRunner, type Runner } from "./process.js";

export interface Runners {
  aerospace: Runner;
  mdfind: Runner;
  mdls: Runner;
  open: Runner;
}

export const createRunners = (): Runners => {
  return {
    aerospace: createAerospaceRunner(),
    mdfind: createRunner("/usr/bin/mdfind"),
    mdls: createRunner("/usr/bin/mdls"),
    open: createRunner("/usr/bin/open"),
  };
};
