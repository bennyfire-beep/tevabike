"use client";
import { useState } from "react";

const classes = {
  kids: [
    { level: "גרביטי מתחילים", branch: "משגב", days: "א' + ג'", age: "6-10" },
    { level: "גרביטי מתחילים", branch: "מצובה", days: "ב' + ד'", age: "6-10" },
    { level: "גרביטי מתחילים", branch: "ביריה", days: "א' + ה'", age: "6-10" },
    { level: "גרביטי מתקדמים", branch: "משגב", days: "ב' + ד'", age: "10-14" },
    { level: "גרביטי מתקדמים", branch: "מצובה", days: "א' + ג'", age: "10-14" },
    { level: "גרביטי פרו", branch: "משגב", days: "ג' + ו'", age: "12+" },
  ],
  adults: [
    { level: "רכיבה טכנית", day: "יום א'" },
    { level: "כושר ואושר", day: "יום ב'" },
    { level: "רכיבה לנשים", day: "יום ג'" },
    { level: "טכני חשמלי", day: "יום ד'" },
    { level: "נשים טכני", day: "יום ה'" },
  ],
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("kids");
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", branch: "", classType: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.phone || !form.classType) {
      alert("אנא מלא שם, טלפון וחוג");
      return;
    }
    setSubmitted(true);
  };

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <img src="/logo.png" alt="טבע בייק" style={{ height: "50px" }} />
        <div className="flex gap-6 text-sm text-gray-500">
          <a href="#classes" className="hover:text-gray-900">חוגים</a>
          <a href="#register" className="text-pink-600 font-medium hover:text-pink-700">הרשמה</a>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative text-white text-center py-16 px-6 overflow-hidden" style={{minHeight: '400px'}}>
  <div className="absolute inset-0 z-0">
    <iframe
      src="https://www.youtube.com/embed/mm0esszVJv0?autoplay=1&mute=1&loop=1&playlist=mm0esszVJv0&controls=0&showinfo=0&rel=0"
      className="w-full h-full"
      style={{border: 'none', pointerEvents: 'none', transform: 'scale(1.5)'}}
      allow="autoplay; fullscreen"
    />
  </div>
  <div className="absolute inset-0 bg-black opacity-50 z-10" />
  <div className="relative z-20">
    <h1 className="text-3xl font-semibold mb-2">חוגי רכיבה לילדים ומבוגרים</h1>
    <p className="text-gray-400 mb-6">גרביטי, טכניקה וכושר בשטח — משגב, מצובה וביריה</p>
    <div className="flex gap-3 justify-center flex-wrap">
      <a href="#register" className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-2 rounded-lg text-sm font-medium">הירשמו עכשיו</a>
      <a href="#classes" className="border border-white text-white px-6 py-2 rounded-lg text-sm hover:bg-white hover:text-gray-900">צפה בחוגים</a>
    </div>
  </div>
</div>

      {/* Info Cards */}
      <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "👥", title: "ילדים ומבוגרים", sub: "גרביטי, מתחילים עד פרו" },
          { icon: "📍", title: "3 סניפים", sub: "משגב, מצובה וביריה" },
          { icon: "💳", title: "הוראת קבע", sub: "תשלום חודשי אוטומטי" },
          { icon: "📊", title: "מעקב נוכחות", sub: "דוחות בזמן אמת" },
        ].map((c) => (
          <div key={c.title} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className="font-medium text-gray-900 text-sm mb-1">{c.title}</div>
            <div className="text-gray-500 text-xs">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Classes */}
      <div id="classes" className="max-w-4xl mx-auto px-6 pb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">לוח חוגים</h2>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab("kids")} className={`px-4 py-2 rounded-full text-sm border ${activeTab === "kids" ? "bg-gray-900 text-white border-gray-900" : "text-gray-500 border-gray-300"}`}>ילדים — גרביטי</button>
          <button onClick={() => setActiveTab("adults")} className={`px-4 py-2 rounded-full text-sm border ${activeTab === "adults" ? "bg-gray-900 text-white border-gray-900" : "text-gray-500 border-gray-300"}`}>מבוגרים</button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {activeTab === "kids" ? (
                  <><th className="text-right px-4 py-3">רמה</th><th className="text-right px-4 py-3">סניף</th><th className="text-right px-4 py-3">ימים</th><th className="text-right px-4 py-3">גיל</th><th className="px-4 py-3"></th></>
                ) : (
                  <><th className="text-right px-4 py-3">חוג</th><th className="text-right px-4 py-3">יום</th><th className="px-4 py-3"></th></>
                )}
              </tr>
            </thead>
            <tbody>
              {activeTab === "kids" ? classes.kids.map((c, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><span className="bg-pink-100 text-pink-800 text-xs px-2 py-1 rounded-full">{c.level}</span></td>
                  <td className="px-4 py-3 text-gray-700">{c.branch}</td>
                  <td className="px-4 py-3 text-gray-700">{c.days}</td>
                  <td className="px-4 py-3 text-gray-500">{c.age}</td>
                  <td className="px-4 py-3"><a href="#register" className="text-pink-600 text-xs hover:underline">הרשמה</a></td>
                </tr>
              )) : classes.adults.map((c, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{c.level}</span></td>
                  <td className="px-4 py-3 text-gray-700">{c.day}</td>
                  <td className="px-4 py-3"><a href="#register" className="text-pink-600 text-xs hover:underline">הרשמה</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Form */}
      <div id="register" className="max-w-2xl mx-auto px-6 pb-16">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">טופס הרשמה לחוג</h2>
          {submitted ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-lg font-medium text-gray-900 mb-2">ההרשמה התקבלה!</div>
              <div className="text-gray-500 text-sm">נשלח אליך קישור לתשלום בהוראת קבע בקרוב</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">שם פרטי *</label>
                  <input type="text" placeholder="ישראל" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">שם משפחה</label>
                  <input type="text" placeholder="ישראלי" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">טלפון *</label>
                  <input type="tel" placeholder="05X-XXXXXXX" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">אימייל</label>
                  <input type="email" placeholder="name@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">סניף</label>
                  <select value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500">
                    <option value="">בחר סניף</option>
                    <option>משגב</option><option>מצובה</option><option>ביריה</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">חוג *</label>
                  <select value={form.classType} onChange={e => setForm({...form, classType: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500">
                    <option value="">בחר חוג</option>
                    <optgroup label="ילדים">
                      <option>גרביטי מתחילים</option>
                      <option>גרביטי מתקדמים</option>
                      <option>גרביטי פרו</option>
                    </optgroup>
                    <optgroup label="מבוגרים">
                      <option>רכיבה טכנית</option>
                      <option>כושר ואושר</option>
                      <option>רכיבה לנשים</option>
                      <option>טכני חשמלי</option>
                      <option>נשים טכני</option>
                    </optgroup>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400">בלחיצה על שלח מאשר/ת קריאת תנאי ההשתתפות. קישור לתשלום בהוראת קבע יישלח תוך 24 שעות.</p>
              <button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-lg text-sm font-medium">שלח הרשמה</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

