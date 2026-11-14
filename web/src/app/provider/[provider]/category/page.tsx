import { ProviderCategory } from "@/components/catalog-pages";
import { notFound } from "next/navigation";

export default async function CategoryPage({ params, searchParams }: PageProps<"/provider/[provider]/category">) {
  const { provider } = await params;
  const { filter } = await searchParams;
  if (!/^[\w-]{1,65}$/.test(provider) || typeof filter !== "string" || filter.length > 300) notFound();
  return <ProviderCategory id={provider} filter={filter} />;
}
