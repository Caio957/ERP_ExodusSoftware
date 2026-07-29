/** Bloco de título + parágrafos reutilizado pelos documentos legais (Termos/Privacidade). */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h4 className="mb-1.5 text-sm font-bold text-ink-900">{title}</h4>
      <div className="space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}
