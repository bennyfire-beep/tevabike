export default function AccessibilityPage() {
  return (
    <div dir="rtl" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif" }}>
      <h1>הצהרת נגישות</h1>
      <p>אתר טבע בייק (<strong>tevabike.com</strong>) פועל לאפשר שימוש שווה ונגיש לכלל המשתמשים, לרבות אנשים עם מוגבלויות, בהתאם לתקן הישראלי <strong>IS 5568</strong> ולהנחיות WCAG 2.0 AA.</p>

      <h2>רמת הנגישות</h2>
      <p>האתר עומד ברמת נגישות AA לפי תקן WCAG 2.0, הכולל:</p>
      <ul>
        <li>ניגודיות צבעים מספקת לקריאה נוחה</li>
        <li>ניווט מלא באמצעות מקלדת</li>
        <li>תיאורי alt לתמונות</li>
        <li>טפסים נגישים עם תיוג מלא</li>
        <li>תמיכה בקוראי מסך</li>
      </ul>

      <h2>רכז נגישות</h2>
      <p>בני להט — מנהל טבע בייק</p>
      <p>טלפון: <a href="tel:0525708084">052-5708084</a></p>
      <p>אימייל: <a href="mailto:bennyfire@gmail.com">bennyfire@gmail.com</a></p>

      <h2>פניות בנושא נגישות</h2>
      <p>נתקלתם בבעיית נגישות באתר? אנחנו כאן לעזור. ניתן לפנות אלינו בטלפון או במייל ונטפל בפנייה תוך 5 ימי עסקים.</p>

      <p style={{ color: "#888", fontSize: 14 }}>עודכן לאחרונה: יוני 2026</p>
    </div>
  );
}