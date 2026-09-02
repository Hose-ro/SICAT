const BRAND_MARK_SRC = '/app-icon.png?v=20260901'

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
      className={['brand-mark', className].filter(Boolean).join(' ')}
      decoding="async"
    />
  )
}
