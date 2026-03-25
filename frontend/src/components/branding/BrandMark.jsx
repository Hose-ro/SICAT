const BRAND_MARK_SRC = '/app-icon.svg?v=20260319b'

export default function BrandMark({
  className = '',
  alt = 'Logo SICAT',
  decorative = false,
}) {
  return (
    <img
      src={BRAND_MARK_SRC}
      alt={decorative ? '' : alt}
      aria-hidden={decorative || undefined}
      className={className}
      decoding="async"
    />
  )
}
