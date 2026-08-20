// Server wrapper: route segment config is only honoured in a server component,
// so the interactive screen lives in GroupsClient.tsx.
import GroupsClient from './GroupsClient'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <GroupsClient />
}
