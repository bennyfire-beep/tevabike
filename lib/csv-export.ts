// Client-side CSV export shared by the coordinator list screens ("ייצוא
// ל-CSV" buttons on leads / registrations / camps / workshops). Builds an
// Excel-friendly CSV (UTF-8 BOM so Hebrew renders correctly, not as mojibake)
// and triggers a browser download — no server round trip.

export function downloadCsv(filename: string, head: string[], rows: (string | number)[][]) {
  const body = [head, ...rows]
    .map(line => line.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
