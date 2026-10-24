import avatarVideos from '@/lib/avatar-videos.json'

// HeyGen avatar videos, rendered by scripts/heygen.mjs. The manifest starts
// empty, so each slot renders nothing until its video has been generated.

type AvatarVideoEntry = { title: string; src: string; duration: number | null }
const VIDEOS = avatarVideos as Record<string, AvatarVideoEntry>

export function hasAvatarVideo(id: string) {
  return id in VIDEOS
}

export default function AvatarVideo({ id, poster, style }: {
  id: string
  poster?: string
  style?: React.CSSProperties
}) {
  const v = VIDEOS[id]
  if (!v) return null
  return (
    <video
      src={v.src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      aria-label={v.title}
      style={{ width: '100%', display: 'block', borderRadius: 16, background: '#000', ...style }}
    />
  )
}
