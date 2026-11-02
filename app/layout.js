import './globals.css';

// Root layout only exists so Next.js has a top-level app/layout.js.
// Everything real (html/body, <html lang>, metadata, JSON-LD, Toaster,
// CookieNotice) now lives in app/[locale]/layout.js, since the <html lang>
// attribute must match the active locale and metadata must be translated
// per-locale. This file must not render its own <html>/<body>, the
// [locale] layout does that, or React will complain about nested documents.
export default function RootLayout({ children }) {
  return children;
}
