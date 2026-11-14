import Link from "next/link";
import { Film } from "lucide-react";
import { PageHeading } from "@/components/page-heading";

export default function Home() {
  return (
    <>
      <PageHeading title="Home" />
      <section className="home-hero" aria-labelledby="browse-title">
        <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-accent/20 text-accent">
          <Film size={23} aria-hidden="true" />
        </div>
        <h2 id="browse-title" className="text-3xl font-bold tracking-tight sm:text-5xl">Movies and series</h2>
        <Link className="primary-button mt-6 w-fit" href="/settings">Choose layout</Link>
      </section>
    </>
  );
}
