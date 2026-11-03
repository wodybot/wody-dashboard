import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#6B2E10',
          borderRadius: 14,
        }}
      >
        <span
          style={{
            color: '#fff',
            fontSize: 38,
            fontWeight: 900,
            fontFamily: 'sans-serif',
          }}
        >
          W
        </span>
      </div>
    ),
    { ...size }
  );
}
