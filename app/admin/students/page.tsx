// Server wrapper: route segment config is only honoured in a server component,
// so the interactive screen lives in StudentsClient.tsx.
import StudentsClient from './StudentsClient'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <StudentsClient />
}
