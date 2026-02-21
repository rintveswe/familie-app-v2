import KalenderClient from "./KalenderClient";

export default function KalenderPage() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.22em] text-zinc-400">Familie App v2</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100 md:text-4xl">Kalender</h1>
        </div>
        <KalenderClient />
      </div>
    </main>
  );
}
