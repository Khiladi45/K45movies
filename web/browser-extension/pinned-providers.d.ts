declare module "pinned-providers" {
  const providers: Record<string, () => Promise<Record<string, unknown>>>;
  export default providers;
}
