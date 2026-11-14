import { notFound } from "next/navigation";
import { MovieTitle } from "@/components/detail-screen";

export default async function Page({ params }: PageProps<"/title/[type]/[id]">) {
  const { type, id } = await params;
  if ((type !== "movie" && type !== "tv") || !/^[1-9]\d{0,7}$/.test(id)) notFound();
  return <MovieTitle type={type} id={Number(id)} />;
}
