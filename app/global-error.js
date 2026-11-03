'use client';

import { useEffect, useState } from 'react';
import { FALLBACK_ERROR_TEXT, fallbackErrorLocale } from '@/lib/fallback-error-text';

export default function GlobalError({ error, reset }) {
  const [lang, setLang] = useState('en');
  useEffect(() => { setLang(fallbackErrorLocale()); }, []);
  const text = FALLBACK_ERROR_TEXT[lang] || FALLBACK_ERROR_TEXT.en;
  return (
    <html lang={lang} className="dark">
      <body style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0b0c', color: '#f5f5f5', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{text.heading}</h1>
          <p style={{ fontSize: 14, color: '#a3a3a3', marginBottom: 20 }}>{text.text}</p>
          <button
            onClick={() => {
              try { reset(); } finally { window.location.reload(); }
            }}
            style={{
              background: '#a04820', color: 'white', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {text.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
