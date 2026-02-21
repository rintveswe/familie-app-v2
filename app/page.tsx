export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <a
        href="/kalender"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151922]/90 p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:border-cyan-400/50"
      >
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Familie App v2</p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-100">Gå til kalender</h1>
        <p className="mt-3 text-zinc-400">Åpne ukesvisning, legg til avtaler og administrer hendelser.</p>
      </a>
    </main>
  );
}
