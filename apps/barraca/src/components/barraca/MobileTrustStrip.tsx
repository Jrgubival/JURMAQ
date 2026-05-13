/**
 * Bottom trust strip for the barraca mobile homepage.
 * Three icons on a dark band, mirrors the reference design.
 * Hidden on lg+ — desktop already has its own trust signals row in the page.
 */
export default function MobileTrustStrip() {
  const items = [
    {
      title: "Cotización",
      sub: "al instante",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      ),
    },
    {
      title: "Despacho a toda",
      sub: "la Región del Maule",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8a2 2 0 012-2h7v10H5a2 2 0 01-2-2V8zm9-2h4l3 4v4a2 2 0 01-2 2h-5V6zM7 18a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
      ),
    },
    {
      title: "Te mejoramos",
      sub: "el precio",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
      ),
    },
  ];

  return (
    <section className="lg:hidden bg-navy-950 border-t border-navy-800 mt-2">
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.title} className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {it.icon}
              </svg>
            </div>
            <div className="text-[11px] leading-tight text-white">
              <div className="font-bold uppercase tracking-tight">{it.title}</div>
              <div className="text-white/70 font-medium">{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
