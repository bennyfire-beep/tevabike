// Cover for a riding trip: its photo when there is one, otherwise a designed
// placeholder (hills over the sea in the site's pink/plum) so a trip can go
// up before anyone has a good photo of the route.

export default function TripCover({ image, title, className = '' }: { image: string | null; title: string; className?: string }) {
  if (image) {
    return <img src={image} alt={title} className={`w-full h-full object-cover ${className}`} />
  }
  return (
    <div
      role="img"
      aria-label={title}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ background: 'linear-gradient(180deg,#2E1224 0%, #4A1A3A 45%, #D4288A 100%)' }}
    >
      <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="300" cy="78" r="26" fill="#F9C6E0" opacity=".55" />
        <path d="M0 150 L60 105 L110 132 L170 80 L230 128 L280 98 L340 140 L400 112 L400 225 L0 225 Z" fill="#3B1530" opacity=".85" />
        <path d="M0 172 L70 140 L130 160 L200 122 L260 158 L330 132 L400 156 L400 225 L0 225 Z" fill="#1B1220" />
        <path d="M0 200 Q50 192 100 200 T200 200 T300 200 T400 200 L400 225 L0 225 Z" fill="#0c0a09" />
      </svg>
    </div>
  )
}
