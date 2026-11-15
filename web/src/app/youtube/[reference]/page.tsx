import { notFound } from "next/navigation";
import { YouTubeVideo } from "@/components/youtube";

export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (reference.length > 8000 || !/^[\w-]+\.[\w-]+$/.test(reference)) notFound();
  return <YouTubeVideo reference={reference} />;
}
