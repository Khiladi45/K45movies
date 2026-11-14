import { notFound } from "next/navigation";
import { ProviderTitle } from "@/components/detail-screen";

export default async function Page({ params }: PageProps<"/provider/[provider]/title/[reference]">) {
  const { provider, reference } = await params;
  if (!/^[\w-]{1,65}$/.test(provider) || reference.length > 8000 || !/^[\w-]+\.[\w-]+$/.test(reference)) notFound();
  return <ProviderTitle provider={provider} reference={reference} />;
}
