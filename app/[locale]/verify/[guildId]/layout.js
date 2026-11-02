// Verification pages are personal one-time steps, never search results.
export const metadata = { robots: { index: false, follow: false } };

export default function VerifyLayout({ children }) {
  return children;
}
