import React, { useState, useEffect } from 'react'
import Panel from './Panel'

function timeAgo(unixTs) {
  if (!unixTs) return ''
  const diff = Math.floor((Date.now() / 1000) - unixTs)
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}

export default function NewsFeed({ syms, activeSector }) {
  const [news, setNews]       = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!syms?.length) return
    setLoading(true)
    setNews([])
    // Use top 3 symbols + the sector ETF for relevant news
    const querySyms = syms.slice(0, 4)
    fetch(`/api/news?symbols=${querySyms.join(',')}`)
      .then(r => r.json())
      .then(d => { setNews(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [syms?.join(',')])

  const visibleNews = expanded ? news : news.slice(0, 5)

  return (
    <Panel title={`${activeSector.short} News`} badge="latest">
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height:40, borderRadius:6, background:'var(--bg-secondary)', animation:'pulse 1.5s ease-in-out infinite', animationDelay:i*0.1+'s' }}/>
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
        </div>
      )}

      {!loading && news.length === 0 && (
        <div style={{ fontSize:12, color:'var(--text-muted)', padding:'12px 0' }}>No recent news found.</div>
      )}

      {!loading && news.length > 0 && (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
            {visibleNews.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration:'none' }}
              >
                <div style={{
                  padding:'9px 10px',
                  borderRadius:7,
                  transition:'background 0.12s',
                  cursor:'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
                    {/* Ticker pill */}
                    <span style={{
                      fontSize:9, fontWeight:700, flexShrink:0,
                      background: activeSector.color + '22',
                      color: activeSector.color,
                      border: `0.5px solid ${activeSector.color}44`,
                      borderRadius:4, padding:'2px 5px', marginTop:1,
                    }}>{item.sym}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12, fontWeight:500,
                        color:'var(--text-primary)',
                        lineHeight:1.4,
                        display:'-webkit-box',
                        WebkitLineClamp:2,
                        WebkitBoxOrient:'vertical',
                        overflow:'hidden',
                      }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
                        {item.publisher} · {timeAgo(item.time)}
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0, marginTop:1 }}>↗</div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {news.length > 5 && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                width:'100%', marginTop:8, fontSize:11,
                padding:'6px', background:'var(--bg-secondary)',
                border:'0.5px solid var(--border)', borderRadius:7,
                color:'var(--text-secondary)', cursor:'pointer',
              }}
            >
              {expanded ? '↑ Show less' : `↓ Show ${news.length - 5} more`}
            </button>
          )}
        </>
      )}
    </Panel>
  )
}
