export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Loading page</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-7 h-10 w-44 rounded-lg bg-surface" />
        <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="aspect-[2/3] rounded-xl border border-line bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
