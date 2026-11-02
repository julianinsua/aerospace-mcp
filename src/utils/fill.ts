export type FillContext = {
  bundlePath: string;
  pid: number;
};

export const fill = (ctx: FillContext, template: string) =>
  template.replaceAll("{bundlePath}", ctx.bundlePath).replaceAll("{pid}", String(ctx.pid));
