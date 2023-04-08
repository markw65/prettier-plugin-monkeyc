declare module "build/monkeyc.mjs" {
  function parse(
    text: string,
    options: Record<string, unknown> | null | undefined
  ): unknown;
}
