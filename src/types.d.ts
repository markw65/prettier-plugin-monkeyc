declare module "build/monkeyc.js" {
  function parse(
    text: string,
    options: Record<string, unknown> | null | undefined
  ): unknown;
}
