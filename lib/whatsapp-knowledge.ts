// ─────────────────────────────────────────────────────────────────────────────
// The static half of the WhatsApp reply-suggestion knowledge base — the facts
// that don't change week to week (schedules, staff, camp terms, cancellation
// policy). Fed to Gemini as context in lib/gemini.ts's suggestWhatsAppReply,
// called from app/api/whatsapp/suggest.
//
// Anything that changes often (workshop dates/price, shop prices, which trips
// are open) is NOT here — see lib/site-content.ts, which pulls that live at
// suggestion time instead of risking a stale number baked into this file.
//
// Suggest-only, on purpose: this text shapes a DRAFT the coordinator reviews
// and edits before sending — nothing here is ever sent to a customer
// unreviewed. Update this file directly when a schedule or policy changes;
// there's no admin UI for it yet.
//
// Every section below that's a specific camp/workshop/class carries its own
// "הרשמה: https://..." line — lib/gemini.ts's prompt requires any reply that
// mentions that camp/workshop/class's details to close with that exact link,
// so add one here (never invent one) whenever a new section is added.
// ─────────────────────────────────────────────────────────────────────────────

export const WHATSAPP_KNOWLEDGE_BASE = `
# חוגי ילדים/נוער — לפי סניף
הרשמה: https://www.tevabike.com/register
- משגב: ראשון וחמישי 15:30–17:00 | ₪300/חודש (פעם בשבוע, בחירת יום א׳ או ה׳) או ₪550/חודש (פעמיים בשבוע)
- ביריה: יום שני 15:45–17:15 | אותו תמחור כמו משגב (300/550)
- פרוד-אמירים: יום רביעי 15:45–17:00 | מחיר קבוע ₪270/חודש (בלי בחירת מסלול)
- צורית-גילון: יום שלישי 14:45–15:45 | מחיר קבוע ₪270/חודש | מדריך: ארז דגן
- מטה אשר: יום שלישי | מופעל חיצונית דרך המתנ״ס (matnasmatteasher.org.il) — המחיר עדיין לא סופי, ממתין לאישור בני. אל תמסור מחיר סופי למטה אשר.

# חוגי מבוגרים — משגב בלבד
הרשמה: https://www.tevabike.com/register
₪300/חודש. 5 אימונים לבחירה (לא חובה לבחור רק אחד):
- יום א׳ טכני 6:30–8:00
- יום ב׳ כושר ואושר 6:00–7:15
- יום ג׳ כושר נשים 6:00–7:15
- יום ד׳ חשמלי טכני 6:00–7:15
- יום ה׳ נשים טכני 6:00–7:15

# צוות
מדריכים גמישים (לא משויכים קבוע לסניף אחד): אלון תירוש, תומס סלימן, הילל זלנקובסקי, אליאב כהן.
רכזת: טל ברקן — שיחות מקצועיות על החוגים מנותבות אליה.
אדמיניסטרציה: שיר קובי.

# מחנה סוכות (27–30.9.2026)
הרשמה: https://www.tevabike.com/camp-sukkot
₪2,450, כולל לינה + 3 ארוחות ביום + כניסה לבריכה (חד-פעמי). מינימום 10 רוכבים כדי שהמחנה יצא לפועל.
קהל יעד: ילדים ונוער 11–18 בלבד.
ביטול: 14+ יום מראש → החזר 50%. פחות מ-3 ימים מראש → אין החזר.

# מדיניות חנות (https://www.tevabike.com/shop)
אחריות על המוצרים ומשלוח — באחריות פאן רייד (הספק), לא טבע בייק.
החלפות/החזרות — בתיאום מול המחסן: 0509446696.
כל מה שקשור לחוגים (לא לחנות) מנותב לטל ברקן.

# מדיניות ביטולים — חוגי ילדים/נוער
לביטול: הודעה בוואטסאפ לבני (052-5708084) או להילית (052-2348855), או מייל ל-bennyfire@gmail.com.
לפני אמצע החודש → חיוב חצי חודש בלבד. אחרי אמצע החודש → חיוב חודש מלא.
אין החזר רטרואקטיבי.
הקפאה: הודעה 14 יום מראש, טווח הקפאה 14–30 יום.
אישור נוכחות: דרך האפליקציה, עד 22:00 בערב הקודם לאימון.
השכרת אופניים: ₪200.

# מדיניות ביטולים — חוגי מבוגרים (גרסה מעודכנת, מפורטת יותר מחוגי הילדים)
ביטול מנוי: הודעה 14 יום לפני החיוב הבא הבא — לבני או לטל ברקן (050-5358071).
קובע תאריך *קבלת* הבקשה, לא תאריך השליחה שלה.
אין החזר רטרואקטיבי, ואין החזר על מפגשים שהוחמצו.
חיוב: הוראת קבע חודשית.
הקפאה: זהה למדיניות הילדים, אך עם זיכוי יחסי — כפוף לאישור.
המועדון רשאי לבטל עד 8 אימונים ב-12 חודשים (מזג אוויר/ביטחון) בלי חובת החזר.
השכרת אופניים: ₪200/חודש + עלות אחסון באתר (כניסה בקוד/טביעת אצבע).
ציוד חובה: אופניים תקינים, קסדה, כפפות, מגני ברכיים, ליטר מים, נעליים סגורות, פנימית חלופית — ובנוסף לחוגי גרביטי/קפיצות: ציוד מיגון מתאים.

# טון ושפה
עברית נעימה ומזמינה, רשמית-אך-חמה. אימוג׳ים במידה — לא מוגזם.
`.trim()
