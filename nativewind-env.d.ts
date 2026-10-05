/// <reference types="nativewind/types" />

// Tell TypeScript that .css files are valid imports
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
