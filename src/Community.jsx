import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function AuthPanel({ session, profile, onProfileUpdated }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [authError, setAuthError] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState('')

  async function sendMagicLink(e) {
    e.preventDefault()
    setAuthError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setAuthError(error.message)
      return
    }
    setSent(true)
  }

  async function saveUsername(e) {
    e.preventDefault()
    setUsernameError('')
    const { error } = await supabase
      .from('profiles')
      .update({ username: usernameInput.trim() })
      .eq('id', session.user.id)
    if (error) {
      setUsernameError(
        error.code === '23505' ? 'That username is taken — try another.' : 'Could not save username.'
      )
      return
    }
    onProfileUpdated({ ...profile, username: usernameInput.trim() })
  }

  if (!session) {
    return (
      <form className="auth-panel" onSubmit={sendMagicLink}>
        {sent ? (
          <p className="hint-text">Check your email for a sign-in link.</p>
        ) : (
          <>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit">Sign in to chat</button>
            {authError && <p className="hint-text error">{authError}</p>}
          </>
        )}
      </form>
    )
  }

  if (!profile?.username) {
    return (
      <form className="auth-panel" onSubmit={saveUsername}>
        <input
          type="text"
          required
          minLength={2}
          maxLength={24}
          placeholder="Pick a display name"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
        />
        <button type="submit">Save</button>
        {usernameError && <p className="hint-text error">{usernameError}</p>}
      </form>
    )
  }

  return (
    <div className="auth-panel signed-in">
      <span>Signed in as <strong>{profile.username}</strong></span>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  )
}

function AdminReports({ onClose }) {
  const [reports, setReports] = useState(null)

  function load() {
    supabase
      .from('reports')
      .select('id, reason, created_at, message_id, messages(content, room)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setReports(data || []))
  }

  useEffect(() => {
    load()
  }, [])

  async function deleteMessage(report) {
    if (!window.confirm('Delete this message? This cannot be undone.')) return
    await supabase.from('messages').delete().eq('id', report.message_id)
    await supabase.from('reports').delete().eq('id', report.id)
    load()
  }

  async function dismiss(report) {
    await supabase.from('reports').delete().eq('id', report.id)
    load()
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h3>Reported Messages</h3>
        <button onClick={onClose}>Close</button>
      </div>
      {reports === null && <p className="hint-text">Loading reports…</p>}
      {reports && reports.length === 0 && <p className="hint-text">No open reports.</p>}
      {reports && reports.map((r) => (
        <div className="admin-report" key={r.id}>
          <div className="message-head">
            <strong>#{r.messages?.room || 'unknown'}</strong>
            <span className="message-time">{timeAgo(r.created_at)}</span>
          </div>
          <p className="admin-message-content">
            {r.messages?.content || '(message already deleted)'}
          </p>
          <p className="admin-reason">Reason: {r.reason}</p>
          <div className="message-actions">
            <button onClick={() => deleteMessage(r)}>Delete message</button>
            <button onClick={() => dismiss(r)}>Dismiss report</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Community({ teams }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [blockedIds, setBlockedIds] = useState(new Set())
  const [room, setRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [profileCache, setProfileCache] = useState({})
  const [draft, setDraft] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setBlockedIds(new Set())
      return
    }
    supabase
      .from('profiles')
      .select('id, username, is_admin')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))

    supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', session.user.id)
      .then(({ data }) => setBlockedIds(new Set((data || []).map((b) => b.blocked_id))))
  }, [session])

  async function loadProfilesFor(userIds) {
    const missing = userIds.filter((id) => id && !(id in profileCache))
    if (missing.length === 0) return
    const { data } = await supabase.from('profiles').select('id, username').in('id', missing)
    setProfileCache((prev) => {
      const next = { ...prev }
      ;(data || []).forEach((p) => { next[p.id] = p.username })
      return next
    })
  }

  useEffect(() => {
    if (!room) return
    let active = true

    supabase
      .from('messages')
      .select('id, content, created_at, user_id')
      .eq('room', room)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (!active) return
        setMessages(data || [])
        loadProfilesFor((data || []).map((m) => m.user_id))
      })

    const channel = supabase
      .channel(`room-${room}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${room}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
          loadProfilesFor([payload.new.user_id])
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  async function postMessage(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || !session) return
    const { error } = await supabase.from('messages').insert({
      room,
      user_id: session.user.id,
      content,
    })
    if (!error) setDraft('')
  }

  async function reportMessage(message) {
    const reason = window.prompt('Why are you reporting this message?')
    if (!reason) return
    await supabase.from('reports').insert({
      message_id: message.id,
      reported_by: session.user.id,
      reason,
    })
    window.alert('Thanks — this has been reported.')
  }

  async function blockUser(userId) {
    if (!window.confirm('Block this user? You will no longer see their messages.')) return
    await supabase.from('blocks').insert({ blocker_id: session.user.id, blocked_id: userId })
    setBlockedIds((prev) => new Set(prev).add(userId))
  }

  const visibleMessages = messages.filter((m) => !blockedIds.has(m.user_id))

  return (
    <section className="panel community-panel">
      <div className="community-title-row">
        <h2>Fan Community</h2>
        {profile?.is_admin && !showAdmin && (
          <button className="admin-toggle" onClick={() => setShowAdmin(true)}>
            View Reports
          </button>
        )}
      </div>
      <AuthPanel session={session} profile={profile} onProfileUpdated={setProfile} />

      {showAdmin ? (
        <AdminReports onClose={() => setShowAdmin(false)} />
      ) : (
      <div className="community-body">
        <div className="room-list">
          {teams.map((team) => {
            const slug = slugify(team)
            return (
              <button
                key={slug}
                className={'room-btn' + (room === slug ? ' active' : '')}
                onClick={() => setRoom(slug)}
              >
                {team}
              </button>
            )
          })}
        </div>

        <div className="room-chat">
          {!room && <p className="hint-text">Pick a team to join its chat room.</p>}
          {room && (
            <>
              <div className="message-list">
                {visibleMessages.length === 0 && (
                  <p className="hint-text">No messages yet — be the first.</p>
                )}
                {visibleMessages.map((m) => (
                  <div className="message" key={m.id}>
                    <div className="message-head">
                      <strong>{profileCache[m.user_id] || 'Fan'}</strong>
                      <span className="message-time">{timeAgo(m.created_at)}</span>
                    </div>
                    <p>{m.content}</p>
                    {session && (
                      <div className="message-actions">
                        <button onClick={() => reportMessage(m)}>Report</button>
                        {m.user_id !== session.user.id && (
                          <button onClick={() => blockUser(m.user_id)}>Block</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {session && profile?.username && (
                <form className="message-form" onSubmit={postMessage}>
                  <input
                    type="text"
                    maxLength={500}
                    placeholder={`Message #${room}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button type="submit">Send</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
      )}
    </section>
  )
}
