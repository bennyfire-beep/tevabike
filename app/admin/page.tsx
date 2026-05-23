'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BRANCHES = ['משגב', 'מצובה', 'ביריה']
const GROUPS = ['גרביטי מתחילים', 'גרביטי מתקדמים', 'גרביטי פרו', 'רכיבה טכנית', 'כושר ואושר', 'רכיבה לנשים', 'טכני חשמלי', 'נשים טכני']

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard')
  const [riders, setRiders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newRider, setNewRider] = useState({
    full_name: '', phone: '', parent_phone: '',
    email: '', age: '', group_name: '', branch: 'משגב'
  })

  async function loadRiders() {
    const { data } = await supabase.from('riders').select('*').order('full_name')
    setRiders(data || [])
    setLoading(false)
  }

  useEffect(() => { loadRiders() }, [])

  async function addRider() {
    if (!newRider.full_name || !newRider.phone) { alert('שם וטלפון חובה!'); return }
    setSaving(true)
    const { error } = await supabase.from('riders').insert({
      full_name: newRider.full_name,
      phone: newRider.phone,
      parent_phone: newRider.parent_phone || null,
      email: newRider.email || null,
      age: newRider.age ? parseInt(newRider.age) : null,
      group_name: newRider.group_name || null,
      branch: newRider.branch || null,
      is_regular: true,
    })
    if (error) { alert('שגיאה: ' + error.message) }
    else {
      setNewRider({ full_name:'', phone:'', parent_phone:'', email:'', age:'', group_name:'', branch:'משגב' })
      setShowAdd(false)
      loadRiders()
    }
    setSaving(false)
  }

  const inp: any = { background:'#0d0f0e', border:'1px solid #252b27', borderRadius:8, color:'#e8efe9', fontFamily:'Heebo,sans-serif', fontSize:14, padding:'10px 12px', width:'100%', outline:'none' }
  const lbl: any = { fontSize:12, color:'#7a8f7d', marginBottom:4, display:'block' }

  const tabs = [
    { id:'dashboard', label:'📊 בקרה' },
    { id:'riders', label:'🚵 רוכבים' },
    { id:'attendance', label:'✅ נוכחות' },
    { id:'payments', label:'💰 תשלומים' },
  ]

  return (
    <div style={{direction:'rtl',fontFamily:'Heebo,sans-serif',background:'#0d0f0e',minHeight:'100vh',color:'#e8efe9'}}>
      <div style={{background:'#141716',borderBottom:'1px solid #252b27',padding:'16px 24px',display:'flex',alignItems:'center',gap:16}}>
        <span style={{color:'#b5e853',fontWeight:900,fontSize:20}}>🚵 טבע בייק</span>
        <span style={{color:'#7a8f7d',fontSize:13}}>מערכת ניהול</span>
        <span style={{marginRight:'auto',fontSize:13,color:'#7a8f7d'}}>{riders.length} רוכבים</span>
      </div>
      <div style={{display:'flex',gap:8,padding:'16px 24px',borderBottom:'1px solid #252b27'}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{padding:'8px 16px',borderRadius:20,border:'none',cursor:'pointer',fontFamily:'Heebo,sans-serif',fontWeight:700,background:tab===t.id?'#b5e853':'#1a1e1c',color:tab===t.id?'#0d0f0e':'#e8efe9'}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:24}}>
        {tab==='dashboard' && (
          <div>
            <h2 style={{marginBottom:16}}>לוח בקרה</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
              {[['רוכבים פעילים',riders.filter(r=>r.is_regular).length,'#b5e853'],
                ['סה"כ רוכבים',riders.length,'#4cdb7a'],
                ['לא פעילים',riders.filter(r=>!r.is_regular).length,'#ff4f4f'],
                ['חוגים',8,'#81d4fa']
              ].map(([l,v,c])=>(
                <div key={l as string} style={{background:'#1a1e1c',border:'1px solid #252b27',borderRadius:12,padding:20}}>
                  <div style={{fontSize:12,color:'#7a8f7d'}}>{l as string}</div>
                  <div style={{fontSize:32,fontWeight:900,color:c as string}}>{v as number}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='riders' && (
          <div>
            <div style={{display:'flex',alignItems:'center',marginBottom:16,gap:12}}>
              <h2 style={{margin:0}}>רוכבים ({riders.length})</h2>
              <button onClick={()=>setShowAdd(!showAdd)} style={{padding:'8px 18px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:'Heebo,sans-serif',fontWeight:700,background:'#b5e853',color:'#0d0f0e',marginRight:'auto'}}>
                {showAdd?'✕ ביטול':'+ הוסף רוכב'}
              </button>
            </div>

            {showAdd && (
              <div style={{background:'#1a1e1c',border:'1px solid #b5e85344',borderRadius:12,padding:20,marginBottom:16}}>
                <h3 style={{margin:'0 0 16px',color:'#b5e853'}}>רוכב חדש</h3>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                  <div><label style={lbl}>שם מלא *</label><input style={inp} placeholder="ישראל ישראלי" value={newRider.full_name} onChange={e=>setNewRider(p=>({...p,full_name:e.target.value}))} /></div>
                  <div><label style={lbl}>טלפון *</label><input style={inp} placeholder="050-0000000" value={newRider.phone} onChange={e=>setNewRider(p=>({...p,phone:e.target.value}))} /></div>
                  <div><label style={lbl}>טלפון הורה</label><input style={inp} placeholder="050-0000000" value={newRider.parent_phone} onChange={e=>setNewRider(p=>({...p,parent_phone:e.target.value}))} /></div>
                  <div><label style={lbl}>מייל</label><input style={inp} placeholder="email@example.com" type="email" value={newRider.email} onChange={e=>setNewRider(p=>({...p,email:e.target.value}))} /></div>
                  <div><label style={lbl}>גיל</label><input style={inp} placeholder="12" type="number" value={newRider.age} onChange={e=>setNewRider(p=>({...p,age:e.target.value}))} /></div>
                  <div><label style={lbl}>סניף</label>
                    <select style={inp} value={newRider.branch} onChange={e=>setNewRider(p=>({...p,branch:e.target.value}))}>
                      {BRANCHES.map(b=><option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div style={{gridColumn:'1/-1'}}><label style={lbl}>קבוצה</label>
                    <select style={inp} value={newRider.group_name} onChange={e=>setNewRider(p=>({...p,group_name:e.target.value}))}>
                      <option value="">בחר קבוצה...</option>
                      {GROUPS.map(g=><option key={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addRider} disabled={saving} style={{padding:'10px 24px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:'Heebo,sans-serif',fontWeight:700,background:saving?'#7a8f7d':'#b5e853',color:'#0d0f0e',fontSize:15}}>
                  {saving?'שומר...':'💾 שמור רוכב'}
                </button>
              </div>
            )}

            {loading?<p>טוען...</p>:(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {riders.map(r=>(
                  <div key={r.id} style={{background:'#1a1e1c',border:'1px solid #252b27',borderRadius:12,padding:16,display:'flex',alignItems:'center',gap:16}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:16}}>{r.full_name}</div>
                      <div style={{display:'flex',gap:16,marginTop:4,flexWrap:'wrap'}}>
                        {r.phone && <span style={{color:'#7a8f7d',fontSize:13}}>📞 {r.phone}</span>}
                        {r.email && <span style={{color:'#7a8f7d',fontSize:13}}>✉️ {r.email}</span>}
                        {r.age && <span style={{color:'#7a8f7d',fontSize:13}}>גיל: {r.age}</span>}
                        {r.group_name && <span style={{color:'#b5e853',fontSize:13}}>🚵 {r.group_name}</span>}
                        {r.branch && <span style={{color:'#81d4fa',fontSize:13}}>📍 {r.branch}</span>}
                      </div>
                      {r.parent_phone && <div style={{color:'#7a8f7d',fontSize:12,marginTop:2}}>הורה: {r.parent_phone}</div>}
                    </div>
                    <span style={{padding:'3px 12px',borderRadius:20,fontSize:12,fontWeight:700,background:r.is_regular?'#4cdb7a22':'#ff4f4f22',color:r.is_regular?'#4cdb7a':'#ff4f4f',border:`1px solid ${r.is_regular?'#4cdb7a44':'#ff4f4f44'}`}}>
                      {r.is_regular?'פעיל':'לא פעיל'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==='attendance' && (
          <div>
            <h2 style={{marginBottom:16}}>נוכחות היום</h2>
            <div style={{background:'#1a1e1c',border:'1px solid #252b27',borderRadius:12,padding:20,color:'#7a8f7d'}}>בחר קבוצה לסימון נוכחות</div>
          </div>
        )}

        {tab==='payments' && (
          <div>
            <h2 style={{marginBottom:16}}>תשלומים</h2>
            <div style={{background:'#1a1e1c',border:'1px solid #252b27',borderRadius:12,padding:20,color:'#7a8f7d'}}>נתוני תשלומים</div>
          </div>
        )}
      </div>
    </div>
  )
}