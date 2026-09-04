'use client'

import { useState, useEffect } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'

const MATNAS_URL = 'https://www.matnasmatteasher.org.il/%D7%9E%D7%97%D7%9C%D7%A7%D7%AA-%D7%A1%D7%A4%D7%95%D7%A8%D7%98/'

// המבצע יורד אוטומטית ב-1 בספטמבר 2026
const PROMO_ENDS = new Date('2026-09-01T00:00:00+03:00')
const promoActive = () => new Date() < PROMO_ENDS

// חוגי ילדים ונוער — כל הסניפים הפעילים.
const BRANCHES = [
  { value: 'משגב', label: 'משגב', day: 'ראשון וחמישי 15:30–17:00' },
  { value: 'ביריה', label: 'ביריה', day: 'שני 15:45–17:15' },
  { value: 'מטה אשר', label: 'מטה אשר', day: 'שלישי', external: true },
  { value: 'פרוד-אמירים', label: 'פרוד-אמירים', day: 'רביעי 15:45–17:00' },
  { value: 'צורית-גילון', label: 'צורית-גילון', day: 'שלישי 14:45–15:45' },
  { value: 'אחר', label: 'אחר', day: '' },
]

// חוג בית-ספרי חד-מסלולי — יום, מחיר ומדריך קבועים, אין בחירת מסלול/יום.
const GILON_BRANCH = 'צורית-גילון'
const GILON_PRICE = 270
const GILON_DAY_INDEX = '2' // שלישי (0=ראשון..6=שבת), תואם ל-groups.days_of_week/DAY_LABEL בשרת
const GILON_INSTRUCTOR = 'ארז דגן'

// מבוגרים — כרגע פעיל רק משגב (ביריה, מטה אשר ופרוד-אמירים הן חוגי ילדים/נוער
// בלבד ולא רלוונטיות למבוגרים). לוח הזמנים המלא מוצג בנפרד, ב-MISGAV_ADULT_SESSIONS.
const ADULT_BRANCHES = [
  { value: 'משגב', label: 'משגב', day: '' },
  { value: 'אחר', label: 'אחר', day: '' },
]

// פירוט האימונים במשגב למבוגרים — הנרשם בוחר אימון אחד מתוך החמישה (radio
// יחיד). dayIndex (0=ראשון..4=חמישי) נשמר בשדה chosen_day הקיים — אותו שדה
// שכבר משמש למסלול "פעם בשבוע" של ילדים — ומגיע במייל האישור דרך DAY_LABEL
// שם, בלי צורך בעמודה נוספת. sent as class_type so the coordinator screen
// (which already renders class_type next to the branch) shows which session.
const MISGAV_ADULT_SESSIONS = [
  { dayIndex: 0, day: "יום א'", type: 'טכני', time: '6:30–8:00' },
  { dayIndex: 1, day: "יום ב'", type: 'כושר ואושר', time: '6:00–7:15' },
  { dayIndex: 2, day: "יום ג'", type: 'כושר נשים', time: '6:00–7:15' },
  { dayIndex: 3, day: "יום ד'", type: 'חשמלי טכני', time: '6:00–7:15' },
  { dayIndex: 4, day: "יום ה'", type: 'נשים טכני', time: '6:00–7:15' },
]

// Summer 2026 tracks. Friday (יומועדון) is cancelled, so the only remaining
// membership_plan value is 'center' — the track is what varies now.
const TRACKS = [
  {
    value: 'once_weekly',
    title: 'פעם בשבוע',
    price: 300,
    desc: 'אימון קבוע אחד בשבוע — בוחרים ראשון או חמישי',
  },
  {
    value: 'twice_weekly',
    title: 'פעמיים בשבוע',
    price: 550,
    desc: 'ראשון וגם חמישי — אימון כפול בשבוע',
    best: true,
  },
]

// 0 = Sunday .. 6 = Saturday, matching groups.days_of_week in Supabase.
const TRACK_DAYS = [
  { value: '0', label: "יום ראשון" },
  { value: '4', label: "יום חמישי" },
]

// תקנון חוגי נוער וילדים — טקסט מלא, מוצג לקריאה חובה לפני הרשמה.
const KIDS_TERMS_TEXT = `מועדון TevaBike מקיים חוגי רכיבה על אופני הרים.
חוגי הרכיבה מודרכים על ידי מדריכי רכיבה מוסמכים.

פעילות והתנהלות בחוגים:
פעילות החוגים מתקיימת לאורך כל חודשי השנה למעט: שבתות, חופשה מרוכזת של צוות המועדון בחול המועד פסח וסוכות, ובימי חג ושבת.
משתתף ייחשב כרשום לפעילויות רק לאחר סיום ההרשמה (תשלום בפועל) והעברת הצהרת הבריאות.
המועדון אינו אחראי לכל נזק אשר ייגרם לציוד האישי של הרוכב לרבות אופניים, קסדה, ציוד רכיבה, ציוד אישי או ביגוד.
אנו מקיימים את כל האימונים בשגרה, כולל בימים גשומים. במקרים של תנאי מזג אוויר קיצוניים שיכולים לסכן את הרוכבים כגון סופות, גשמים חזקים, שלג, רוחות ושרב נודיע מראש על ביטול האימון — במקרה כזה לא יוחזר אימון.
רוכב אשר הפסיד אימון יוכל להשלימו בקבוצה אחרת, בתיאום מראש.
המועדון רשאי להחליט על סגירת קבוצה עקב מיעוט משתתפים.

השתתפות בחוג:
4 מפגשים חד/דו/תלת שבועיים בני 75 דקות.
את האימון מוביל מדריך רכיבה מוסמך.
יש לאשר השתתפות באימון באפליקציה של טבע בייק עד לשעה 22:00 בערב הקודם לאימון (לדוגמה: אם האימון מתקיים ביום ראשון — יש לאשר השתתפות עד לשעה 22:00 במוצ"ש).
רוכב שהחסיר אימון יוכל להשלים אימון אחר במהלך השבוע בתיאום מראש עם בני.

חובות הרוכב:
על הרוכב להגיע לחוג עם אופניים תקינים, קסדה, ליטר מים, נעליים סגורות ופנימית חלופית.
במקרה של תקלה באופניים יש להודיע למדריך לפחות יום מראש על מנת למצוא פתרון ולמנוע אי השתתפות.
התייצבות לחוג עם אופניים לא תקינים או ציוד חסר תמנע את השתתפות החניך במפגש היומי.
מומלץ להצטייד בכריך / פרי / חטיף אנרגיה.

חופשות:
הפעילות מקבילה למערכות החינוך הפורמליות — בחופשות, ערבי חג וחגים לא תתקיים פעילות, למעט במקרים בהם תצא הודעה מראש.
טבע בייק יוצאת לחופשה מרוכזת בחול המועד סוכות, ובחול המועד פסח.
בערב יום השואה ובערב יום הזיכרון לחללי צה"ל יפעלו החוגים עד השעה 18:30.
ביום מסיבות פורים בבתי-הספר לא יתקיימו חוגים.
ביום הזיכרון לשואה יתקיימו חוגים כרגיל, ביום הזיכרון לחללי צה"ל ונפגעי טרור לא יתקיימו חוגים.

הרשמה ותשלומים:
תשלום באשראי יתבצע מראש לכל עונת הפעילות על פי טבלת המחירים המפורטת באתר.
ההשתתפות בכל הפעילויות מותנית בהסדרת התשלום מראש.
ניתן לשלם במזומן מראש עבור 3 חודשי פעילות.

הרשמה מוקדמת:
החיוב בהרשמה מוקדמת יחול חודש לפני שנפתחת שנה ויסתיים חודש לפני שנגמרת השנה.
המבצע של ההרשמה המוקדמת תקף רק למי שנרשם לשנה מלאה. מי שפורש באמצע אינו זכאי למבצע.

הקפאת המנוי:
יש להודיע על הקפאה 14 יום לפני מועד כניסת ההקפאה לפועל.
מינימום הקפאה לתקופת מנוי הינה 14 ימים ומקסימום 30 ימים.

ביטול השתתפות:
על פרישה מהאימונים יש להודיע בוואטסאפ לבני 052-5708084 או הילית 052-2348855 או לכתובת האימייל של המועדון: bennyfire@gmail.com.
ביטול שיבוצע עד לאמצע חודש — יחויב בתעריף של מחצית החודש. ביטול שיעשה לאחר מחצית החודש יחויב בעלות מלוא החודש.
לא יינתן החזר כספי על הודעת ביטול רטרואקטיבית.
העלות החודשית של החוג נקבעת על פי תחשיב שנתי בו כלולים חופשות וחגים.
לא יינתן החזר כספי עקב אי השתתפות במפגשים בודדים.
החזר כספי עקב אי השתתפות החניך במפגשים רציפים, יתנהל בהודעה מראש ובהסכמת מנהל המועדון.

השכרת אופניים:
רוכבים שאינם בעלי אופניים יכולים לשאול אופניים מהמועדון בעלות של 200 ש"ח.
במידה ויגרם נזק לאופניים עלות התיקון המלאה תחול על השואל.`

// תקנון חוגי מבוגרים — טקסט מלא (גרסה מעודכנת), מוצג לקריאה חובה לפני הרשמה.
const ADULT_TERMS_TEXT = `מועדון TevaBike – טבע בייק מקיים חוגי רכיבה על אופני הרים בהדרכת מדריכי רכיבה מוסמכים.
אנו מבקשים מכל הרוכבות והרוכבים לקרוא בעיון את התקנון. הרישום וההשתתפות בפעילות המועדון מהווים הסכמה לתנאים המפורטים בו.

א. תקופת הפעילות
פעילות חוגי המבוגרים של טבע בייק מתקיימת לאורך כל חודשי השנה.
האימונים מתקיימים בהתאם למסלול ההרשמה — אימון אחד או שני אימונים בשבוע. משך אימון הוא 75 דקות.
בימי חג, חול המועד ובימים מיוחדים המפורטים בלוח הפעילות של המועדון לא תתקיים פעילות שוטפת, אלא אם נמסר אחרת מראש.
טבע בייק יוצאת לחופשה מרוכזת בחול המועד סוכות ובחול המועד פסח. ימי החופשה נלקחו בחשבון מראש בתמחור הפעילות, ולפיכך לא יינתן בגינם החזר כספי.
טבע בייק שומרת לעצמה את הזכות לבצע שינויים סבירים במערכת האימונים, בשעות, במיקום הפעילות, בחלוקת הקבוצות ובתוכנית המקצועית, בהתאם לצרכים מקצועיים, תפעוליים ובטיחותיים.

ב. פתיחת קבוצות והמשך פעילותן
פתיחת קבוצה והמשך פעילותה מותנים במספר משתתפים המאפשר את קיום הפעילות. אימון בודד לא יתקיים אלא במינימום של 4 משתתפים רשומים.
במקרה שמספר המשתתפים בקבוצה ירד באופן שאינו מאפשר את המשך פעילותה, טבע בייק רשאית לבצע התאמות, לרבות איחוד קבוצות, שינוי מועד או מקום הפעילות או הפסקת פעילות הקבוצה.
במקרה של הפסקה קבועה ביוזמת המועדון, לא יחויבו המשתתפים בגין תקופת הפעילות שלא תתקיים.

ג. רישום והשתתפות
משתתף ייחשב כרשום ויורשה להשתתף רק לאחר השלמת ההרשמה דרך אתר/אפליקציית טבע בייק, הסדרת התשלום והעברת הצהרת בריאות מלאה.
ההשתתפות בכל פעילות המועדון מותנית בהסדרת התשלום מראש.
יש לאשר השתתפות באימון באפליקציית טבע בייק עד לשעה 22:00 בערב שלפני האימון.

ד. אחריות על ציוד אישי
המועדון אינו אחראי לכל נזק, אובדן או פגיעה בציוד האישי של הרוכב, לרבות אופניים, קסדה, ציוד מיגון ורכיבה, טלפון, ציוד אישי או ביגוד.
באחריות המשתתף לוודא כי האופניים והציוד האישי מתאימים לפעילות ונמצאים במצב תקין ובטיחותי.

ה. ביטול אימונים על ידי המועדון
אנו משתדלים לקיים את כל האימונים בשגרה, כולל בימים גשומים, כל עוד ניתן לקיים את הפעילות באופן בטוח.
צוות טבע בייק רשאי לבטל עד 8 אימונים במהלך תקופת פעילות של 12 חודשים בכל מסלול/קבוצה, ללא החזר כספי, בשל תנאי מזג אוויר קיצוניים, מצב ביטחוני, השתלמויות מקצועיות, אירועים מיוחדים או נסיבות אחרות שאינן מאפשרות לקיים את הפעילות כמתוכנן. ימי ביטול אלה נלקחו בחשבון מראש בתמחור. הפעילות תתקיים בהתאם להנחיות פיקוד העורף והרשויות.
במקרה של ביטולים כאמור לא יינתן החזר כספי, אך המועדון רשאי לקיים אימוני השלמה בשעות/ימים אחרים או במסגרת פעילות מרוכזת, ותימסר עליהם הודעה מראש.

ו. השלמת מפגשים
משתתף שהפסיד אימון יוכל להשלים אימון בקבוצה אחרת, בתיאום מראש ועל בסיס מקום פנוי; ההשלמה אינה אוטומטית ותלויה באישור הצוות המקצועי.
לא יינתן זיכוי או החזר כספי עבור אימונים שהמשתתף נעדר מהם עקב חופשה, טיול, אירוע אישי, מחלה קצרה או כל סיבה אישית אחרת.

ז. חובות המשתתף וציוד חובה
יש להגיע לכל אימון עם: אופניים תקינים, קסדה תקינה, כפפות רכיבה, מגיני ברכיים, לפחות ליטר מים, נעליים סגורות, פנימית חלופית מתאימה. מומלץ כריך/פרי/חטיף אנרגיה.
באימוני גרביטי, קפיצות, מסלולים טכניים ופעילויות מיוחדות נדרש בנוסף: מגיני מרפקים, מיגון חזה-גב ("צבי-צב"), קסדה מלאה (Full Face), בהתאם להנחיית הצוות.
באחריות המשתתף לוודא שציוד המיגון תקין ומתאים למידותיו. הצוות רשאי לדרוש ציוד נוסף בהתאם לאופי האימון. תקלה באופניים — מומלץ להודיע למדריך יום מראש. התייצבות ללא ציוד חובה/מיגון עלולה למנוע השתתפות.

ח. התנהגות ומשמעת
נדרשת התנהגות מכבדת, אחראית והוגנת כלפי חברי הקבוצה, המדריכים, רוכבים אחרים ומשתמשי הדרך והשטח, וציות להוראות המדריכים וכללי הבטיחות.
לא תתקבל התנהגות אלימה, פוגענית או מסכנת. המדריך רשאי להפסיק השתתפות רוכב באימון אם התנהגותו אינה מאפשרת המשך פעילות תקין ובטוח.
בהפרות חוזרות או אי-ציות לבטיחות, טבע בייק רשאית להשעות משתתף או להפסיק את השתתפותו במועדון; לא יינתן החזר כספי עבור תקופת ההשעיה.

ט. בריאות ובטיחות
באחריות המשתתף לוודא שמצבו הבריאותי מאפשר השתתפות ברכיבת אופני הרים, ולעדכן את הצוות בכל מגבלה רפואית או שינוי רלוונטי. במקרה של פציעה או אירוע רפואי, הצוות יפעל לפי שיקול דעתו המקצועי.

י. חופשות ומועדים
הפעילות מתקיימת לאורך השנה, למעט שבתות, חגים, חופשות מרוכזות בחול המועד סוכות ופסח וימים מיוחדים שעליהם תימסר הודעה מראש.
בערב יום השואה ובערב יום הזיכרון לחללי מערכות ישראל יפעלו החוגים עד 18:30. ביום הזיכרון לשואה יתקיימו חוגים כרגיל. ביום הזיכרון לחללי מערכות ישראל ונפגעי פעולות איבה לא יתקיימו חוגים. ימים אלה נלקחו בחשבון בתמחור ולא יינתן בגינם זיכוי.

יא. פעילויות מיוחדות, מחנות וימי שיא
טבע בייק רשאית לקיים ימי שיא, מחנות, ימי רכיבה מרוכזים, סדנאות, טיולים, אימוני Gravity ואירועים מיוחדים — אלה אינם בהכרח חלק מהמנוי השוטף ועשויים לדרוש תשלום נוסף, בכפוף לרמת רכיבה/ציוד/אישור הצוות. הפרטים והמחיר יימסרו מראש.

יב. הרשמה ותשלומים
ההרשמה דרך אתר/אפליקציית טבע בייק. תשלום באשראי — הוראת קבע מתמשכת בחיוב חודשי; ניתן לשלם במזומן מראש עבור 3 חודשים. ההשתתפות מותנית בהסדרת התשלום; בקיום חוב, המועדון רשאי שלא לאפשר השתתפות עד להסדרתו.
הצטרפות באמצע התקופה — החיוב הראשון כולל אימונים שבוצעו וטרם שולמו בתוספת חיוב מראש לחודש המלא הבא. שיעור ניסיון מחושב יחסית; בהמשך בחוג, ההשתתפות נחשבת מאימון הניסיון.
פעילויות/שירותים שאינם כלולים במחיר המנוי (מחנות, ימי שיא, טיולים, הסעות, ציוד וכד') — עלותם תימסר מראש בנפרד.

יג. הרשמה מוקדמת
ככל שיוצע מבצע הרשמה מוקדמת, תנאיו ותקופתו יפורסמו על ידי המועדון. בפרישה במהלך תקופת ההתחייבות, המועדון רשאי לבטל את ההטבה ולחשב לפי התעריף הרגיל.

יד. הקפאת המנוי
בקשת הקפאה — לפחות 14 יום מראש. מינימום 14 ימים, מקסימום 30 ימים. ההקפאה כפופה לאישור הצוות; בגינה יינתן זיכוי יחסי. אין השתתפות בתקופת ההקפאה.

טו. ביטול השתתפות ופרישה מהמנוי
פרישה מחייבת הודעה מראש של לפחות 14 יום לפני מועד החיוב הקרוב, לבני או לטל ברקן בטלפון 050-5358071.
מועד קבלת הבקשה על ידי המועדון הוא הקובע — מומלץ לוודא אישור קבלה. הודעת ביטול רטרואקטיבית לא תתקבל וללא החזר כספי. עד לקבלת הודעת הביטול, המשתתף נחשב פעיל לכל דבר. לא יינתן החזר כספי עבור מפגשים שבהם לא נכח.

טז. השאלת אופניים ואחסון
השאלת אופניים — 200 ₪ לחודש, בהתאם לזמינות, לשימוש במסגרת פעילות המועדון בלבד; יש להשאירם במועדון בסיום כל אימון. נזק לאופניים המושאלים — עלות התיקון המלאה על השואל.
אחסון אופניים במועדון באמצעות קוד/טביעת אצבע — בתשלום דרך האפליקציה, בכפוף לזמינות ולנהלי המועדון.

יז. צילום ותיעוד
במהלך הפעילות עשויים להצטלם תמונות/סרטונים לתיעוד ושיווק. מי שאינו מאשר צילום/שימוש בתמונות שבהן הוא מופיע — מתבקש להודיע על כך למועדון בכתב.

יח. תקשורת והודעות
הודעות רשמיות יימסרו דרך ערוצי המועדון (קבוצות WhatsApp, הודעות ישירות, אתר/אפליקציה או אמצעי אחר שיפורסם). באחריות המשתתפים להתעדכן בהודעות (שעות, מיקום, ביטולים, ציוד, פעילויות מיוחדות). המועדון אינו אחראי למידע המופץ בערוצים שאינם מופעלים מטעמו.

יט. נסיבות חריגות ושינויים
במצב ביטחוני, הנחיות פיקוד העורף/רשויות, מזג אוויר חריג, מגבלות גישה לשטח או נסיבות אחרות שאינן בשליטת המועדון, טבע בייק רשאית לשנות מועדי/מיקום/מתכונת הפעילות בהתאם לצורך. המועדון רשאי לעדכן את התקנון והנהלים במהלך השנה; שינוי מהותי יימסר בהודעה למשתתפים.

כ. כללי
התקנון מנוסח בלשון זכר מטעמי נוחות בלבד ומתייחס באופן שווה לכל המינים. האמור בתקנון אינו גורע מזכויות או חובות החלות על הצדדים על פי דין.`

export default function RegisterPage() {
  const [type, setType] = useState<'' | 'kids' | 'adults'>('')
  const [form, setForm] = useState({
    child_name: '',
    child_age: '',
    branch: '',
    city: '',
    class_type: '',
    membership_plan: '',
    track: '',
    chosen_day: '',
    full_name: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [whatsappOptin, setWhatsappOptin] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [utm, setUtm] = useState<{ utm_source?: string; utm_medium?: string; utm_campaign?: string }>({})

  // Capture campaign tags from the landing URL and keep them for the session,
  // so a registration can be traced back to the ad that produced it even if
  // the visitor browsed a few pages before signing up.
  useEffect(() => {
    const KEY = 'tb_utm'
    try {
      const q = new URLSearchParams(window.location.search)
      const fresh = {
        utm_source:   q.get('utm_source')   || undefined,
        utm_medium:   q.get('utm_medium')   || undefined,
        utm_campaign: q.get('utm_campaign') || undefined,
      }
      if (fresh.utm_source || fresh.utm_medium || fresh.utm_campaign) {
        sessionStorage.setItem(KEY, JSON.stringify(fresh))
        setUtm(fresh)
        return
      }
      const saved = sessionStorage.getItem(KEY)
      if (saved) setUtm(JSON.parse(saved))
    } catch {
      // storage blocked (private browsing) — tracking is optional, carry on
    }
  }, [])

  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const isKids = type === 'kids'
  const isMatteAsher = form.branch === 'מטה אשר'
  const isGilon = form.branch === GILON_BRANCH
  const promo = promoActive()

  async function submit() {
    setError('')
    const missing = isKids
      ? !form.child_name || !form.full_name || !form.phone || !form.branch || !form.city
      : !form.full_name || !form.phone || !form.branch || !form.city

    if (missing) {
      setError(
        isKids
          ? 'חסרים שדות חובה: שם הילד, יישוב, סניף, שם ההורה וטלפון'
          : 'חסרים שדות חובה: שם מלא, יישוב, סניף וטלפון'
      )
      return
    }
    if (isKids && !isGilon && !form.track) {
      setError('בחרו מסלול הרשמה')
      return
    }
    if (isKids && !isGilon && form.track === 'once_weekly' && !form.chosen_day) {
      setError('בחרו יום קבוע — ראשון או חמישי')
      return
    }
    if (!isKids && form.branch === 'משגב' && !form.chosen_day) {
      setError('בחרו אימון')
      return
    }
    if (isKids && !agreedTerms) {
      setError('יש לאשר שקראתם את תקנון החוג לפני שליחת ההרשמה')
      return
    }
    if (!isKids && !agreedTerms) {
      setError('יש לאשר שקראתם את תקנון המועדון לפני שליחת ההרשמה')
      return
    }

    // מבוגר שבחר משגב: תואמים את chosen_day לאימון שנבחר, ומעדכנים את
    // class_type לשם האימון (למשל "כושר ואושר") כדי שהרכזת תראה בדיוק
    // לאיזה אימון נרשמו — לא רק לאיזה יום.
    const misgavSession =
      !isKids && form.branch === 'משגב'
        ? MISGAV_ADULT_SESSIONS.find((s) => String(s.dayIndex) === form.chosen_day)
        : null

    setSending(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          // Friday is cancelled, so every kids registration is a plain branch
          // membership; the track is what carries the price distinction now.
          membership_plan: isKids ? 'center' : form.membership_plan || null,
          // A twice-weekly student attends both days, so no single chosen day.
          chosen_day: form.track === 'twice_weekly' ? null : form.chosen_day || null,
          class_type: misgavSession ? misgavSession.type : form.class_type,
          amount_monthly: isGilon ? GILON_PRICE : (TRACKS.find((t) => t.value === form.track)?.price ?? null),
          registration_type: type,
          promo_code: promo ? 'BOOST5' : null,
          whatsapp_optin: whatsappOptin,
          ...utm,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליחה')
      setDone(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">🚵</div>
          <h1 className="text-2xl font-bold text-lime-400">ההרשמה נקלטה</h1>
          <p className="text-stone-300 leading-relaxed">
            תודה! נבדוק את הפרטים, נשבץ לקבוצה המתאימה ונשלח קישור
            לתשלום והצטרפות לאפליקציית טבע בייק.
          </p>
          <p className="text-sm text-stone-500">בדרך כלל תוך יום עסקים אחד.</p>
          <a href="/" className="inline-block mt-4 text-lime-400 underline">חזרה לאתר</a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <p className="text-lime-400 text-sm tracking-widest mb-2">טבע בייק · שנת פעילות</p>
          <h1 className="text-3xl font-bold">הרשמה לקבוצות</h1>
        </header>

        {promo && (
          <div className="bg-gradient-to-l from-fuchsia-900/60 to-purple-900/40 border border-fuchsia-600 rounded-xl p-4 mb-6">
            <p className="font-bold text-fuchsia-200">⚡ בוסט הרשמה — 5% הנחה</p>
            <p className="text-sm text-fuchsia-100/80 mt-1">
              לחברים קיימים ולמצטרפים חדשים. ההנחה תקפה להרשמות עד 31.8 ותחושב בקישור התשלום.
            </p>
          </div>
        )}

        {/* בחירת סוג הרשמה */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => { setType('kids'); set('chosen_day', '') }}
            className={`p-5 rounded-xl border text-right transition ${
              type === 'kids' ? 'bg-lime-400 text-stone-950 border-lime-400' : 'bg-stone-900 border-stone-700 hover:border-stone-500'
            }`}
          >
            <div className="text-2xl mb-1">🧒</div>
            <div className="font-bold">ילדים ונוער</div>
            <div className={`text-xs mt-0.5 ${type === 'kids' ? 'text-stone-800' : 'text-stone-500'}`}>הורה רושם את הילד</div>
          </button>
          <button
            type="button"
            onClick={() => { setType('adults'); set('chosen_day', '') }}
            className={`p-5 rounded-xl border text-right transition ${
              type === 'adults' ? 'bg-lime-400 text-stone-950 border-lime-400' : 'bg-stone-900 border-stone-700 hover:border-stone-500'
            }`}
          >
            <div className="text-2xl mb-1">🚴</div>
            <div className="font-bold">מבוגרים</div>
            <div className={`text-xs mt-0.5 ${type === 'adults' ? 'text-stone-800' : 'text-stone-500'}`}>רושם את עצמי</div>
          </button>
        </div>

        {!type ? (
          <p className="text-center text-stone-500 text-sm">בחרו סוג הרשמה כדי להמשיך</p>
        ) : (
          <div className="space-y-5">
            <Section title={isKids ? 'הרוכב' : 'הפרטים שלך'}>
              {isKids && <Field label="שם מלא של הילד/ה *" value={form.child_name} onChange={(v) => set('child_name', v)} />}
              {!isKids && <Field label="שם מלא *" value={form.full_name} onChange={(v) => set('full_name', v)} />}
              <Field label="גיל" type="number" value={form.child_age} onChange={(v) => set('child_age', v)} />
              <Field label="יישוב מגורים *" value={form.city} onChange={(v) => set('city', v)} placeholder="למשל: שכניה, נהריה, צפת" />
            </Section>

            <Section title="הסניף">
              <div>
                <label className="block text-sm text-stone-400 mb-1.5">איפה נוח לכם להתאמן? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(isKids ? BRANCHES : ADULT_BRANCHES).map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => {
                        set('branch', b.value)
                        // המסלול הישן שייך רק ל"משגב" אצל מבוגרים — סניף אחר מבטל אותו.
                        if (!isKids && b.value !== 'משגב') set('chosen_day', '')
                        // צורית-גילון: מסלול, יום ומדריך קבועים — אין בחירה, נקבע אוטומטית.
                        if (isKids && b.value === GILON_BRANCH) {
                          set('track', 'once_weekly')
                          set('chosen_day', GILON_DAY_INDEX)
                          set('class_type', GILON_INSTRUCTOR)
                        } else if (isKids && form.branch === GILON_BRANCH) {
                          // יציאה מגילון חזרה לסניף אחר — מנקים כדי לא לגרור ערכים לא רלוונטיים.
                          set('track', '')
                          set('chosen_day', '')
                          set('class_type', '')
                        }
                      }}
                      className={`py-3 px-2 rounded-lg border text-sm transition ${
                        form.branch === b.value
                          ? 'bg-lime-400 text-stone-950 border-lime-400 font-semibold'
                          : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <div>{b.label}</div>
                      {b.day && (
                        <div className={`text-[11px] mt-0.5 ${form.branch === b.value ? 'text-stone-700' : 'text-stone-500'}`}>
                          {b.day}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* מבוגרים + משגב — בחירת אימון אחד מתוך החמישה (radio יחיד) */}
              {!isKids && form.branch === 'משגב' && (
                <fieldset className="space-y-2 border-0 p-0 m-0">
                  <legend className="text-sm text-stone-300 font-semibold mb-1.5">באיזה אימון תרצו להשתתף? *</legend>
                  {MISGAV_ADULT_SESSIONS.map((s) => {
                    const selected = form.chosen_day === String(s.dayIndex)
                    return (
                      <label
                        key={s.dayIndex}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                          selected
                            ? 'bg-lime-400 text-stone-950 border-lime-400 font-semibold'
                            : 'bg-stone-950 border-stone-700 text-stone-300 hover:border-stone-500'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="misgav-session"
                            value={s.dayIndex}
                            checked={selected}
                            onChange={() => set('chosen_day', String(s.dayIndex))}
                            className="w-4 h-4 accent-lime-700 cursor-pointer shrink-0"
                          />
                          <span>{s.day} · {s.type}</span>
                        </span>
                        <span dir="ltr" className={`text-xs ${selected ? 'text-stone-800' : 'text-stone-500'}`}>{s.time}</span>
                      </label>
                    )
                  })}
                </fieldset>
              )}
            </Section>

            {/* מטה אשר – מעבר ישיר לאתר המתנ"ס */}
            {isMatteAsher ? (
              <a
                href={MATNAS_URL}
                target="_blank"
                rel="noreferrer"
                className="block text-center bg-lime-400 text-stone-950 font-bold py-4 rounded-xl text-lg"
              >
                להרשמה במטה אשר ←
              </a>
            ) : (
              <>
                {isKids && isGilon && (
                  <Section title="פרטי החוג">
                    <div className="rounded-lg border border-stone-700 bg-stone-950 p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-stone-400">יום ושעה</span>
                        <span className="font-semibold">שלישי, 14:45–15:45</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">מדריך</span>
                        <span className="font-semibold">{GILON_INSTRUCTOR}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">מסלול</span>
                        <span className="font-semibold">פעם בשבוע</span>
                      </div>
                      <div className="flex justify-between border-t border-stone-800 pt-2">
                        <span className="text-stone-400">מחיר</span>
                        <span className="font-bold text-lime-400">₪{GILON_PRICE} לחודש</span>
                      </div>
                    </div>
                  </Section>
                )}

                {isKids && !isGilon && (
                  <Section title="מסלול הרשמה">
                    <div className="space-y-2">
                      {TRACKS.map((p) => {
                        const selected = form.track === p.value
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                              set('track', p.value)
                              if (p.value === 'twice_weekly') set('chosen_day', '')
                            }}
                            className={`w-full text-right p-4 rounded-lg border transition ${
                              selected
                                ? 'bg-lime-400 text-stone-950 border-lime-400'
                                : 'bg-stone-950 border-stone-700 hover:border-stone-500'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <div className="font-bold flex items-center gap-2">
                                  {p.title}
                                  {p.best && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${selected ? 'bg-stone-900 text-lime-300' : 'bg-lime-400 text-stone-950'}`}>
                                      הכי משתלם
                                    </span>
                                  )}
                                </div>
                                <div className={`text-xs mt-1 ${selected ? 'text-stone-700' : 'text-stone-400'}`}>{p.desc}</div>
                              </div>
                              <div className="text-left whitespace-nowrap">
                                <div className="font-bold text-lg">₪{p.price}</div>
                                <div className={`text-[11px] ${selected ? 'text-stone-700' : 'text-stone-500'}`}>לחודש</div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Once-weekly students commit to one fixed day. */}
                    {form.track === 'once_weekly' && (
                      <div className="pt-1">
                        <div className="text-xs text-stone-400 mb-2">איזה יום? *</div>
                        <div className="grid grid-cols-2 gap-2">
                          {TRACK_DAYS.map((d) => {
                            const selected = form.chosen_day === d.value
                            return (
                              <button
                                key={d.value}
                                type="button"
                                onClick={() => set('chosen_day', d.value)}
                                className={`p-3 rounded-lg border text-sm font-bold transition ${
                                  selected
                                    ? 'bg-lime-400 text-stone-950 border-lime-400'
                                    : 'bg-stone-950 border-stone-700 hover:border-stone-500'
                                }`}
                              >
                                {d.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-stone-500 leading-relaxed">
                      החוגים במשגב מתקיימים בימים ראשון וחמישי, 15:30–17:00.
                      במסלול פעם בשבוע בוחרים יום קבוע אחד ונשארים איתו לאורך השנה.
                    </p>
                  </Section>
                )}

                {/* אצל מבוגר שנרשם למשגב, סוג האימון כבר נקבע מהבחירה למעלה —
                    שדה "ניסיון קודם" חופשי היה רק מבלבל לצד זה. */}
                {!(!isKids && form.branch === 'משגב') && !isGilon && (
                  <Section title="ניסיון">
                    <Field
                      label="ניסיון קודם ברכיבה"
                      value={form.class_type}
                      onChange={(v) => set('class_type', v)}
                      placeholder="מתחיל / רכב שנה / מתקדם"
                    />
                  </Section>
                )}

                <Section title={isKids ? 'ההורה' : 'יצירת קשר'}>
                  {isKids && <Field label="שם ההורה *" value={form.full_name} onChange={(v) => set('full_name', v)} />}
                  <Field label="טלפון *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
                  <Field label="אימייל" type="email" value={form.email} onChange={(v) => set('email', v)} />
                </Section>

                <Section title="הערות">
                  <Field
                    label="בריאות, אלרגיות או כל דבר שכדאי שנדע"
                    value={form.notes}
                    onChange={(v) => set('notes', v)}
                    textarea
                  />
                </Section>

                <div className="space-y-2.5">
                  <details
                    open={termsOpen}
                    onToggle={(e) => setTermsOpen((e.target as HTMLDetailsElement).open)}
                    className="rounded-lg border border-stone-700 bg-stone-950"
                  >
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-sm text-lime-400 font-semibold">
                      {isKids ? 'תקנון חוגי נוער וילדים — לחצו לקריאה *' : 'תקנון חוגי מבוגרים — לחצו לקריאה *'}
                    </summary>
                    <div className="px-3 pb-3 max-h-64 overflow-y-auto text-xs leading-relaxed text-stone-400 whitespace-pre-line border-t border-stone-800 pt-3">
                      {isKids ? KIDS_TERMS_TEXT : ADULT_TERMS_TEXT}
                    </div>
                  </details>
                  <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="mt-0.5 w-[18px] h-[18px] accent-lime-400 cursor-pointer shrink-0"
                    />
                    <span>קראתי ואני מאשר/ת את התקנון *</span>
                  </label>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none">
                  <input
                    type="checkbox"
                    checked={whatsappOptin}
                    onChange={(e) => setWhatsappOptin(e.target.checked)}
                    className="mt-0.5 w-[18px] h-[18px] accent-lime-400 cursor-pointer shrink-0"
                  />
                  <span>{WHATSAPP_OPTIN_LABEL}</span>
                </label>

                {error && <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-3 text-sm">{error}</div>}

                <button
                  onClick={submit}
                  disabled={sending}
                  className="w-full bg-lime-400 text-stone-950 font-bold py-4 rounded-xl text-lg disabled:opacity-50 hover:bg-lime-300 transition"
                >
                  {sending ? 'שולח…' : 'שליחת הרשמה'}
                </button>

                <p className="text-xs text-stone-500 text-center">
                  שליחת הטופס אינה מהווה תשלום. קישור התשלום יישלח לאחר שיבוץ לקבוצה.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 space-y-4">
      <h2 className="text-lime-400 font-semibold text-sm">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  textarea?: boolean
}) {
  const cls =
    'w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-3 text-stone-100 placeholder-stone-600 focus:border-lime-400 focus:outline-none'
  return (
    <div>
      <label className="block text-sm text-stone-400 mb-1.5">{label}</label>
      {textarea ? (
        <textarea rows={3} className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
