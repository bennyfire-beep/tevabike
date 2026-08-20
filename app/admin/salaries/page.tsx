// Server wrapper: route segment config is only honoured in a server component,
// so the interactive screen lives in SalariesClient.tsx.
import SalariesClient from './SalariesClient'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <SalariesClient />
}
