// Server wrapper: route segment config is only honoured in a server component,
// so the interactive screen lives in InstructorsClient.tsx.
import InstructorsClient from './InstructorsClient'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <InstructorsClient />
}
