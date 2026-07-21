'use client';

const PAY_URL = 'https://arbox.link/4pLNJMaN';

const M = '#b81f8f';
const DARK = '#181622';

const days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי'];

const rows: { label: string; cells: string[] }[] = [
  {
    label: 'פעילות בוקר',
    cells: ['היכרות + היכרות מסלולים', 'מדידת זמנים', 'רכיבה במשמר', 'הקפצות', 'איברג + סיכום'],
  },
  {
    label: 'הפסקת צהריים / ארוחת צהריים',
    cells: [
      'ארוחת צהריים + הפסקה',
      'ארוחת צהריים + הפסקה',
      'ארוחת צהריים + הפסקה',
      'ארוחת צהריים + הפסקה',
      'ארוחת צהריים + הפסקה',
    ],
  },
  {
    label: 'פעילות אחה"צ',
    cells: ['רכיבה לנחל', 'ססן איברג', 'בריכה', 'פאמפטרק', 'פיזור'],
  },
];

export default function CampPage() {
  return (
    <div dir="rtl" style={{ background: '#fff', minHeight: '100vh', fontFamily: 'Heebo, Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: DARK, padding: '28px 20px', textAlign: 'center' }}>
        <img src="/logo.png" alt="Teva Bike" style={{ height: 46, marginBottom: 18 }} />
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 900, letterSpacing: 2, marginBottom: 6 }}>
          מחנה סוכות
        </div>
        <h1 style={{ color: M, fontSize: 34, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.2 }}>
          מחנה רכיבה משמר העמק
        </h1>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, direction: 'ltr' }}>27.09–01.10</div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 6 }}>
          המחנה כולל ארוחות ולינה
        </div>
      </div>

      {/* Info strip */}
      <div
        style={{
          background: M,
          color: '#fff',
          padding: '14px 20px',
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.8,
        }}
      >
        עלות למשתתף: 2,900 ₪ &nbsp;|&nbsp; מינימום 8 משתתפים &nbsp;|&nbsp; מיועד לכיתות ו' ומעלה
      </div>

      {/* Payment CTA */}
      <div style={{ textAlign: 'center', padding: '28px 20px 8px' }}>
        <a
          href={PAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            background: M,
            color: '#fff',
            fontSize: 22,
            fontWeight: 900,
            padding: '16px 46px',
            borderRadius: 999,
            textDecoration: 'none',
            boxShadow: '0 6px 18px rgba(184,31,143,0.35)',
          }}
        >
          להרשמה ותשלום
        </a>
      </div>

      {/* Schedule */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px 40px' }}>
        <img
          src="/camp-sukkot.png"
          alt="לוז המחנה"
          style={{ width: '100%', height: 'auto', display: 'block', margin: '0 0 24px' }}
        />
        <h2 style={{ color: M, fontSize: 26, fontWeight: 900, margin: '10px 0 14px' }}>טבלת פעילות</h2>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              minWidth: 640,
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}
          >
            <thead>
              <tr>
                <th style={cell(true)}>פעילות / שעה</th>
                {days.map((d) => (
                  <th key={d} style={cell(true)}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td style={cell(true)}>{r.label}</td>
                  {r.cells.map((c, i) => (
                    <td key={i} style={cell(false)}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: 'center', marginTop: 34 }}>
          <a
            href={PAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: DARK,
              color: '#fff',
              fontSize: 20,
              fontWeight: 900,
              padding: '14px 40px',
              borderRadius: 999,
              textDecoration: 'none',
            }}
          >
            שריון מקום למחנה
          </a>
          <div style={{ color: '#666', fontSize: 14, marginTop: 12 }}>
            מספר המקומות מוגבל · לשאלות: טבע בייק
          </div>
        </div>
      </div>
    </div>
  );
}

function cell(head: boolean): React.CSSProperties {
  return {
    background: M,
    color: '#fff',
    border: '3px solid #111',
    textAlign: 'center',
    padding: '18px 8px',
    fontSize: head ? 16 : 15,
    fontWeight: head ? 900 : 700,
    lineHeight: 1.4,
  };
}
