import React, { useState, useEffect } from 'react'
import Panel from './Panel'

function daysUntil(unixTs) {
  if (!unixTs) return null
  const now  = Date.now() / 1000
  const diff = unixTs - now
  return Math.round(diff / 86400)
}

function urgencyColor(days) {
  if (days == null) return '#555'
  if (days < 0)  return '#555'        // past
  if (days <= 7)  return '#e05050'    // this week
  if (days <= 30) return '#e8a835'    // this month
  return '#888'                        // further out
}

export default function EarningsCalendar({ syms, activeSector }) {
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!syms?.length) return
    setLoading(true)
    fetch(`/api/earnings?symbols=${syms.join(',')}`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [syms?.join(',')])

  const upcoming = data
    .map(d => ({ ...d, days: daysUntil(d.nextEarnings) }))
    .filter(d => d.days != null && d.days >= 0 && d.days <= 90)
    .sort((a, b) => a.days - b.days)

  return (
    <Panel title="Earnings Calendar" badge="next 90 days">
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height:28, borderRadius:6, background:'var(--bg-secondary)', animation:'pulse 1.5s ease-in-out infinite', animationDelay:i*0.1+'s' }}/>
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
        </div>
      )}

      {!loading && upcoming.length === 0 && (
        <div style={{ fontSize:12, color:'var(--text-muted)', padding:'12px 0' }}>
          No earnings scheduled in the next 90 days for {activeSector.short} top 7.
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {upcoming.map(item => {
            const color = urgencyColor(item.days)
            const dateStr = item.nextEarnings
              ? new Date(item.nextEarnings * 1000).toLocaleDateString('en-US', { month:'short', day:'numeric' })
              : '—'
            const label = item.days === 0 ? 'Today' : item.days === 1 ? 'Tomorrow' : `${item.days}d`
            return (
              <div key={item.sym} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'var(--bg-secondary)', borderRadius:7, padding:'7px 10px',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{
                    width:6, height:6, borderRadius:'50%',
                    background: color, flexShrink:0,
                  }}/>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{item.sym}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>{dateStr}</span>
                  <span style={{
                    fontSize:10, fontWeight:700, color,
                    background: color + '22', borderRadius:4, padding:'2px 7px',
                  }}>{label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display:'flex', gap:14, marginTop:12 }}>
        {[['#e05050','≤ 7 days'],['#e8a835','≤ 30 days'],['#888','> 30 days']].map(([c,l]) => (
          <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--text-muted)' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:c, display:'inline-block' }}/>
            {l}
          </span>
        ))}
      </div>
    </Panel>
  )
}
