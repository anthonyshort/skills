/**
 * esbuild embeds imported Markdown as text in the generated workflow.
 */
declare module "*.md" {
  const text: string;
  export default text;
}
