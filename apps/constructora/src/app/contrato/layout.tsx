import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Firma de contrato | JURMAQ",
  description:
    "Firma electronica de contrato JURMAQ conforme a la Ley 19.799 sobre documentos electronicos y firma electronica en Chile.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ContratoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Minimal header: logo + title, no nav */}
      <header
        role="banner"
        className="bg-navy-950 border-b border-navy-800 shadow-sm"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0"
              aria-label="Ir al sitio JURMAQ"
            >
              <span className="inline-flex items-center bg-white/95 rounded-lg px-2.5 py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/logo-jurmaq.png"
                  alt="JURMAQ Maestranza & Construcción"
                  width={160}
                  height={80}
                  className="h-7 sm:h-9 w-auto"
                />
              </span>
            </Link>
            <span className="text-xs sm:text-sm font-medium text-gray-300 uppercase tracking-wider">
              Firma de contrato
            </span>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Minimal footer: legal mention only */}
      <footer
        role="contentinfo"
        className="border-t border-gray-200 bg-white"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <p className="text-center text-xs text-gray-500 leading-relaxed">
            &copy; {new Date().getFullYear()} Constructora Jorge Ubilla Rivera E.I.R.L. -
            Firma electronica conforme a la{" "}
            <strong className="text-gray-700">Ley 19.799</strong> de Chile.
          </p>
        </div>
      </footer>
    </div>
  );
}
