declare module "diff" {
  export function diffWords(
    oldStr: string,
    newStr: string
  ): Array<{ value: string; added?: boolean; removed?: boolean }>;
}
