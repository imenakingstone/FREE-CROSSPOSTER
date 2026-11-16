import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { LayoutDashboard, CalendarDays, FileText, History, Link2, Settings, LogOut, ImagePlus, Send, ShieldCheck, Video, Trash2, Clock3, Plus, Save, X, RefreshCw, Bell, CheckCheck, Sparkles, Activity } from 'lucide-react'

function CrossposterLogo() { return <span className="brand-icon crossposter-logo" aria-label="FREE CROSSPOSTER"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 13h17l-4-4m4 4-4 4M32 27H15l4-4m-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 20h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".55"/></svg></span> }
function PlatformLogo({ platform }) {
  if (platform === 'instagram') return <svg className="platform-logo" viewBox="0 0 24 24" aria-label="Instagram"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.8" r="1.2" fill="currentColor"/></svg>
  if (platform === 'tiktok') return <svg className="platform-logo tiktok-logo" viewBox="0 0 24 24" aria-label="TikTok"><path d="M15.5 3v11.1a4.1 4.1 0 1 1-3.5-4.05v3.1a1.2 1.2 0 1 0 .5 1V3h3c.2 2.2 1.5 3.8 4 4.2v3.1c-1.6-.1-3-.7-4-1.7" fill="currentColor"/><path d="M14.1 4.1v10.2a4.1 4.1 0 0 1-3.1 4" fill="none" stroke="#25F4EE" strokeWidth="1.3"/><path d="M15.5 3v4.1c1 .9 2.2 1.4 3.5 1.5" fill="none" stroke="#FE2C55" strokeWidth="1.3"/></svg>
  if (platform === 'youtube') return <svg className="platform-logo" viewBox="0 0 24 24" aria-label="YouTube"><path d="M23 7.1a3 3 0 0 0-2.1-2.1C19 4.5 12 4.5 12 4.5s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9Z" fill="currentColor"/><path d="m9.5 15.5 6-3.5-6-3.5z" fill="#101522"/></svg>
  return null
}

const platforms = [
  { id: 'instagram', label: 'Instagram', mark: 'IG' },
  { id: 'tiktok', label: 'TikTok', mark: '♪' },
]
const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'create', label: 'Create post', icon: Plus },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'history', label: 'Publishing history', icon: History },
  { id: 'accounts', label: 'Connected accounts', icon: Link2 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'system-health', label: 'System Health', icon: Activity },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('login')
  const [showAuth, setShowAuth] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeView, setActiveView] = useState('overview')
  const [posts, setPosts] = useState([])
  const [socialAccounts, setSocialAccounts] = useState([])
  const [postDestinations, setPostDestinations] = useState([])
  const [notifications, setNotifications] = useState([])
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [logs, setLogs] = useState([])
  const [schedules, setSchedules] = useState([])
  const [profile, setProfile] = useState({ display_name: '', avatar_url: '' })
  const [settings, setSettings] = useState({ timezone: 'Africa/Kigali', email_notifications: true, publish_success_notifications: true, publish_failure_notifications: true, weekly_summary: false })
  const [busy, setBusy] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [hashtagSuggestions, setHashtagSuggestions] = useState([])
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram'])
  const [schedulePostId, setSchedulePostId] = useState('')
  const [scheduleDestinationId, setScheduleDestinationId] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [publishingPostId, setPublishingPostId] = useState(null)
  const [healthReport, setHealthReport] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1' && params.get('connection') === 'instagram') {
      const account = params.get('account')
      setNotice('Instagram connected successfully' + (account ? ': ' + account : '') + '. Your account is now available in Connected accounts.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) refreshWorkspace()
  }, [session?.user?.id])

  async function refreshWorkspace() {
    await Promise.all([loadPosts(), loadAccounts(), loadDestinations(), loadNotifications(), loadLogs(), loadSchedules(), loadProfile(), loadSettings()])
  }
  async function runSystemHealth() {
    setHealthLoading(true); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('system-health', { body: {} })
      if (error) {
        let details = null
        try { details = await error.context?.json() } catch {}
        throw new Error(details?.error || data?.error || error.message || 'System scan failed.')
      }
      if (data?.error) throw new Error(data.error)
      setHealthReport(data)
    } catch (error) { setNotice(error.message || 'Could not run the system scan.') }
    finally { setHealthLoading(false) }
  }
  async function loadPosts() {
    const { data, error } = await supabase.from('posts').select('id,caption,media_path,media_type,original_filename,status,created_at,updated_at').order('created_at', { ascending: false }).limit(100)
    if (error) setNotice(error.message); else setPosts(data || [])
  }
  async function loadAccounts() {
    const { data, error } = await supabase.from('social_accounts').select('id,platform,platform_user_id,username,display_name,account_status,token_expires_at,connected_at,environment').eq('environment', 'production').order('connected_at', { ascending: false })
    if (error) setNotice(error.message); else setSocialAccounts(data || [])
  }
  async function loadDestinations() {
    const { data, error } = await supabase.from('post_destinations').select('id,post_id,platform,status,social_account_id,platform_post_id,published_at,error_message').order('created_at', { ascending: false }).limit(300)
    if (error) setNotice(error.message); else setPostDestinations(data || [])
  }
  async function loadNotifications() {
    const { data, error } = await supabase.from('notifications').select('id,type,title,body,read_at,created_at,related_post_id').order('created_at', { ascending: false }).limit(25)
    if (error) { if (!error.message?.includes('not find')) setNotice(error.message) } else setNotifications(data || [])
  }
  async function markNotificationRead(item) {
    if (!item.read_at) {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id)
      if (error) setNotice(error.message); else await loadNotifications()
    }
  }
  async function markAllNotificationsRead() {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    if (error) setNotice(error.message); else await loadNotifications()
  }
  async function loadLogs() {
    const { data, error } = await supabase.from('publishing_logs').select('id,post_id,destination_id,platform,status,message,created_at').order('created_at', { ascending: false }).limit(100)
    if (!error) setLogs(data || [])
  }
  async function loadSchedules() {
    const { data, error } = await supabase.from('scheduled_posts').select('id,destination_id,scheduled_at,status').order('scheduled_at', { ascending: true })
    if (!error) setSchedules(data || [])
  }
  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('display_name,avatar_url').eq('id', session.user.id).maybeSingle()
    if (data) setProfile({ display_name: data.display_name || '', avatar_url: data.avatar_url || '' })
  }
  async function loadSettings() {
    const { data } = await supabase.from('user_settings').select('timezone,email_notifications,publish_success_notifications,publish_failure_notifications,weekly_summary').eq('user_id', session.user.id).maybeSingle()
    if (data) setSettings(data)
  }

  async function handleAuth(event) {
    event.preventDefault(); setAuthBusy(true); setNotice('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
        if (error) throw error
        setNotice(data.session ? 'Your account is ready.' : 'Check your email for a confirmation link, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) { setNotice(error.message || 'Authentication failed.') } finally { setAuthBusy(false) }
  }
  async function handleSignOut() { await supabase.auth.signOut(); setPosts([]); setSocialAccounts([]); setPostDestinations([]); setNotifications([]); setLogs([]); setSchedules([]) }

  async function connectInstagram() {
    setBusy(true); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-start', { body: { return_url: window.location.origin } })
      if (error) throw error
      if (!data?.url) throw new Error(data?.error || 'Instagram authorization could not start.')
      window.location.assign(data.url)
    } catch (error) { setNotice(error.message || 'Could not start Instagram authorization.'); setBusy(false) }
  }
  async function publishInstagram(postId, destinationId) {
    setPublishingPostId(postId); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('instagram-publish', { body: { post_id: postId, destination_id: destinationId } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setNotice('Meta confirmed that the post was published to Instagram.')
      await refreshWorkspace()
    } catch (error) { setNotice(error.message || 'Instagram publishing failed.'); await refreshWorkspace() }
    finally { setPublishingPostId(null) }
  }
  async function connectPlatform(platform, environment = 'production') {
    setBusy(true); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke(platform + '-oauth-start', { body: { environment } })
      if (error) {
        let details = null
        try { details = await error.context?.json() } catch {}
        throw new Error(details?.error || data?.error || error.message || platform + ' authorization could not start.')
      }
      if (!data?.url) throw new Error(data?.error || platform + ' authorization could not start.')
      window.location.assign(data.url)
    } catch (error) { setNotice(error.message || 'Could not start ' + platform + ' authorization.'); setBusy(false) }
  }
  async function publishDestination(postId, destinationId, platform) {
    if (platform === 'instagram') return publishInstagram(postId, destinationId)
    setPublishingPostId(postId); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke(platform + '-publish', { body: { post_id: postId, destination_id: destinationId } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setNotice(platform === 'tiktok' ? 'TikTok accepted the video upload. Check TikTok for final processing status.' : platform + ' confirmed the post was published.')
      await refreshWorkspace()
    } catch (error) { setNotice(error.message || (platform + ' publishing failed.')); await refreshWorkspace() }
    finally { setPublishingPostId(null) }
  }
  async function suggestHashtags() {
    if (!caption.trim()) return setNotice('Write a caption first so AI can suggest relevant hashtags.')
    if (!selectedPlatforms.length) return setNotice('Choose at least one platform first.')
    setAiLoading(true); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('ai-hashtags', {
        body: { caption: caption.trim(), platforms: selectedPlatforms }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const tags = Array.isArray(data?.hashtags) ? data.hashtags : []
      if (!tags.length) throw new Error('No hashtag suggestions were returned. Try a more detailed caption.')
      setHashtagSuggestions(tags)
      setNotice('AI prepared hashtag ideas. Choose the ones you want to add.')
    } catch (error) {
      setNotice(error.message || 'Could not generate hashtag suggestions.')
    } finally { setAiLoading(false) }
  }
  function addSuggestedHashtag(tag) {
    const clean = String(tag || '').trim()
    if (!clean) return
    const existing = caption.match(/#[\\p{L}\\p{N}_]+/gu) || []
    if (existing.some(item => item.toLowerCase() === clean.toLowerCase())) return
    setCaption(current => (current.trim() ? current.trim() + ' ' : '') + clean)
  }

  async function createDraft(event) {
    event.preventDefault()
    if (!caption.trim() && !file) return setNotice('Add a caption or choose a photo/video first.')
    if (!selectedPlatforms.length) return setNotice('Choose at least one destination.')
    setBusy(true); setNotice('')
    try {
      let mediaPath = null, mediaType = null
      if (file) {
        const allowed = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
        if (!allowed.includes(file.type)) throw new Error('This file format is not supported.')
        if (file.size > 50 * 1024 * 1024) throw new Error('File is larger than the 50 MB limit.')
        const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
        mediaPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`
        const { error } = await supabase.storage.from('user-media').upload(mediaPath, file, { contentType: file.type, upsert: false })
        if (error) throw error
        mediaType = file.type.startsWith('video/') ? 'video' : 'image'
      }
      const { data: post, error: postError } = await supabase.from('posts').insert({ user_id: session.user.id, caption: caption.trim(), media_path: mediaPath, media_type: mediaType, original_filename: file?.name || null, status: 'draft' }).select('id').single()
      if (postError) throw postError
      const destinations = selectedPlatforms.flatMap(platform => {
        const linkedAccounts = socialAccounts.filter(item => item.platform === platform && item.account_status === 'connected')
        return linkedAccounts.length
          ? linkedAccounts.map(account => ({ post_id: post.id, user_id: session.user.id, platform, social_account_id: account.id, status: 'pending' }))
          : [{ post_id: post.id, user_id: session.user.id, platform, social_account_id: null, status: 'pending' }]
      })
      const { error: destinationError } = await supabase.from('post_destinations').insert(destinations)
      if (destinationError) throw destinationError
      setCaption(''); setFile(null); setSelectedPlatforms(['instagram'])
      setNotice('Draft saved successfully.'); await refreshWorkspace(); setActiveView('drafts')
    } catch (error) { setNotice(error.message || 'Could not save this draft.') }
    finally { setBusy(false) }
  }
  async function deleteDraft(post) {
    if (!window.confirm('Delete this post and its destinations?')) return
    setBusy(true)
    try {
      const { data: linkedDestinations } = await supabase.from('post_destinations').select('id').eq('post_id', post.id).eq('user_id', session.user.id)
      const linkedIds = (linkedDestinations || []).map(item => item.id)
      if (linkedIds.length) await supabase.from('scheduled_posts').delete().in('destination_id', linkedIds).eq('user_id', session.user.id)
      await supabase.from('post_destinations').delete().eq('post_id', post.id).eq('user_id', session.user.id)
      const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('user_id', session.user.id)
      if (error) throw error
      if (post.media_path) await supabase.storage.from('user-media').remove([post.media_path])
      setNotice('Post deleted.'); await refreshWorkspace()
    } catch (error) { setNotice(error.message || 'Could not delete post.') }
    finally { setBusy(false) }
  }
  async function saveCaption(postId, nextCaption) {
    const { error } = await supabase.from('posts').update({ caption: nextCaption, updated_at: new Date().toISOString() }).eq('id', postId).eq('user_id', session.user.id)
    if (error) setNotice(error.message); else { setNotice('Draft updated.'); await loadPosts() }
  }
  async function schedulePost(event) {
    event.preventDefault()
    if (!schedulePostId || !scheduleDestinationId || !scheduleAt) return setNotice('Choose a post, destination and date/time.')
    const chosenDestination = destRows.find(item => item.id === scheduleDestinationId)
    if (!chosenDestination || chosenDestination.platform !== 'instagram' || !chosenDestination.social_account_id) return setNotice('Choose a connected Instagram account for automatic scheduling.')
    const date = new Date(scheduleAt)
    if (Number.isNaN(date.getTime()) || date <= new Date()) return setNotice('Choose a future date and time.')
    setBusy(true)
    try {
      const { error } = await supabase.from('scheduled_posts').insert({ destination_id: scheduleDestinationId, user_id: session.user.id, scheduled_at: date.toISOString(), status: 'scheduled' })
      if (error) throw error
      const { error: destError } = await supabase.from('post_destinations').update({ status: 'scheduled', updated_at: new Date().toISOString() }).eq('id', scheduleDestinationId).eq('user_id', session.user.id)
      if (destError) throw destError
      setNotice('Schedule saved. The Instagram scheduler checks due posts every minute.'); setSchedulePostId(''); setScheduleDestinationId(''); setScheduleAt(''); await refreshWorkspace()
    } catch (error) { setNotice(error.message || 'Could not schedule this post.') }
    finally { setBusy(false) }
  }
  async function cancelSchedule(item) {
    const { error } = await supabase.from('scheduled_posts').delete().eq('id', item.id).eq('user_id', session.user.id)
    if (error) setNotice(error.message)
    else { await supabase.from('post_destinations').update({ status: 'pending' }).eq('id', item.destination_id).eq('user_id', session.user.id); setNotice('Schedule cancelled.'); await refreshWorkspace() }
  }
  async function assignDestinationAccount(destinationId, accountId) {
    const { error } = await supabase.from('post_destinations').update({ social_account_id: accountId, status: 'pending', updated_at: new Date().toISOString() }).eq('id', destinationId).eq('user_id', session.user.id)
    if (error) setNotice(error.message)
    else { setNotice('Instagram account assigned to this post.'); await loadDestinations() }
  }
  async function disconnectAccount(account) {
    if (!window.confirm(`Disconnect ${account.platform} account ${account.username ? '@' + account.username : ''}?`)) return
    const { error } = await supabase.from('social_accounts').delete().eq('id', account.id).eq('user_id', session.user.id)
    if (error) setNotice(error.message); else { setNotice('Account disconnected.'); await loadAccounts() }
  }
  async function sendPasswordReset() {
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, { redirectTo: window.location.origin })
    if (error) setNotice(error.message); else setNotice('Password reset email sent. Check your inbox.')
  }
  async function saveProfile(event) {
    event.preventDefault(); setBusy(true)
    try {
      const { error } = await supabase.from('profiles').upsert({ id: session.user.id, display_name: profile.display_name, avatar_url: profile.avatar_url, updated_at: new Date().toISOString() })
      if (error) throw error
      setNotice('Profile saved.')
    } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  async function saveSettings(event) {
    event.preventDefault(); setBusy(true)
    try {
      const { error } = await supabase.from('user_settings').upsert({ ...settings, user_id: session.user.id, updated_at: new Date().toISOString() })
      if (error) throw error
      setNotice('Settings saved.')
    } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }

  const destinations = useMemo(() => posts.map(post => ({ post, items: [] })), [posts])
  const draftPosts = posts.filter(post => post.status !== 'published')
  const selectedPostDestinations = posts.find(post => post.id === schedulePostId)
  const [destRows, setDestRows] = useState([])
  useEffect(() => {
    if (!session?.user || !schedulePostId) { setDestRows([]); return }
    supabase.from('post_destinations').select('id,platform,status,social_account_id').eq('post_id', schedulePostId).then(({ data }) => setDestRows(data || []))
  }, [schedulePostId, session?.user?.id])

  if (!isSupabaseConfigured) return <SetupMessage />
  if (loading) return <main className="center-screen"><div className="loader" />Loading FREE CROSSPOSTER…</main>
  if (!session) return showAuth ? <AuthScreen mode={mode} setMode={setMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} displayName={displayName} setDisplayName={setDisplayName} busy={authBusy} notice={notice} onSubmit={handleAuth} /> : <LandingPage onGetStarted={() => { setMode('signup'); setShowAuth(true) }} onSignIn={() => { setMode('login'); setShowAuth(true) }} />

  const activeTitle = navItems.find(item => item.id === activeView)?.label || 'Overview'
  return <main className="dashboard socialync-shell">
    <aside className="app-sidebar">
      <div className="brand"><CrossposterLogo /><span>FREE CROSSPOSTER</span></div>
      <p className="sidebar-label">WORKSPACE</p>
      {navItems.filter(item => item.id !== 'system-health' || session.user.email?.toLowerCase() === 'imenaking12@gmail.com').map(item => { const Icon = item.icon; return <button key={item.id} className={activeView === item.id ? 'sidebar-link active' : 'sidebar-link'} onClick={() => { setActiveView(item.id); setNotice('') }}><Icon size={17} /> {item.label}</button> })}
      <div className="sidebar-bottom"><div className="sidebar-user"><span className="avatar">{(session.user.email || 'U').slice(0,1).toUpperCase()}</span><span className="sidebar-user-email">{session.user.email}</span></div><button className="sidebar-signout" onClick={handleSignOut}><LogOut size={16} /> Sign out</button></div>
    </aside>
    <section className="app-main">
      <header className="topbar"><div><span className="topbar-kicker">YOUR WORKSPACE</span><strong>{activeTitle}</strong></div><div className="user-area"><span className="user-email">{session.user.email}</span><div className="notification-wrap"><button className="icon-btn notification-trigger" onClick={()=>setNotificationOpen(v=>!v)} title="Notifications"><Bell size={17}/>{notifications.some(n=>!n.read_at)&&<i/>}</button>{notificationOpen&&<div className="notification-panel"><div className="notification-heading"><strong>Notifications</strong><button onClick={markAllNotificationsRead}><CheckCheck size={13}/> Mark all read</button></div>{notifications.map(item=><button key={item.id} className={'notification-item '+(!item.read_at?'unread':'')} onClick={()=>markNotificationRead(item)}><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString()}</small></button>)}{!notifications.length&&<p className="empty-state">No notifications yet.</p>}</div>}</div><button className="icon-btn" onClick={refreshWorkspace} title="Refresh workspace"><RefreshCw size={17}/></button></div></header>
      <div className="dashboard-content">
        {activeView === 'overview' && <Overview posts={posts} accounts={socialAccounts} schedules={schedules} logs={logs} onNavigate={setActiveView} />}
        {activeView === 'create' && <CreatePost caption={caption} setCaption={setCaption} file={file} setFile={setFile} selectedPlatforms={selectedPlatforms} setSelectedPlatforms={setSelectedPlatforms} onSubmit={createDraft} busy={busy} onSuggestHashtags={suggestHashtags} aiLoading={aiLoading} hashtagSuggestions={hashtagSuggestions} onAddHashtag={addSuggestedHashtag} />}
        {activeView === 'drafts' && <Drafts posts={draftPosts} destinations={postDestinations} accounts={socialAccounts} onDelete={deleteDraft} onSave={saveCaption} onPublish={publishDestination} onAssignAccount={assignDestinationAccount} publishingPostId={publishingPostId} />}
        {activeView === 'calendar' && <CalendarView posts={posts} schedules={schedules} onSchedule={schedulePost} onCancel={cancelSchedule} busy={busy} schedulePostId={schedulePostId} setSchedulePostId={setSchedulePostId} destinationId={scheduleDestinationId} setDestinationId={setScheduleDestinationId} scheduleAt={scheduleAt} setScheduleAt={setScheduleAt} destinations={destRows} />}
        {activeView === 'history' && <HistoryView logs={logs} posts={posts} />}
        {activeView === 'accounts' && <Accounts accounts={socialAccounts} onConnect={connectInstagram} onConnectTikTok={() => connectPlatform('tiktok')} onDisconnect={disconnectAccount} busy={busy} />}
        {activeView === 'settings' && <SettingsView profile={profile} setProfile={setProfile} settings={settings} setSettings={setSettings} onProfileSave={saveProfile} onSettingsSave={saveSettings} onPasswordReset={sendPasswordReset} busy={busy} email={session.user.email} />}
        {activeView === 'system-health' && session.user.email?.toLowerCase() === 'imenaking12@gmail.com' && <SystemHealthView report={healthReport} loading={healthLoading} onScan={runSystemHealth} />}
        {notice && <p className="notice workspace-notice">{notice}</p>}
      </div>
    </section>
  </main>
}


function SystemHealthView({ report, loading, onScan }) {
  const statusLabel = status => status === 'critical' ? 'Critical' : status === 'warning' ? 'Warning' : status === 'info' ? 'Review' : 'Healthy'
  return <section className="system-health-page">
    <PageHeader eyebrow="ADMINISTRATOR ONLY" title="System Health." description="Read-only checks for Supabase security, configuration and database risks." action={<button className="primary-btn" onClick={onScan} disabled={loading}><Activity size={16}/>{loading ? 'Scanning…' : 'Run full scan'}</button>}/>
    {!report && <div className="card health-empty"><ShieldCheck size={30}/><h2>Ready to inspect your backend</h2><p className="muted">Run a scan to check database access controls, integration secret configuration, extensions and index usage.</p></div>}
    {report && <>
      <div className={'health-summary '+report.overall}><div><span>Overall status</span><strong>{statusLabel(report.overall)}</strong><small>Last checked {new Date(report.checkedAt).toLocaleString()}</small></div><div className="health-counts"><span><b>{report.counts.critical}</b> Critical</span><span><b>{report.counts.warnings}</b> Warnings</span><span><b>{report.counts.info}</b> Review</span><span><b>{report.counts.healthy}</b> Healthy</span></div></div>
      <div className="health-check-list">{report.checks.map(check=><article className="card health-check" key={check.id}><div className="health-check-head"><div><h2>{check.title}</h2><p>{check.summary}</p></div><span className={'health-status '+check.status}>{statusLabel(check.status)}</span></div>
        {check.id === 'credentials' && check.details && <div className="health-details"><strong>Missing secret names</strong>{check.details.missing?.length ? <ul>{check.details.missing.map(name=><li key={name}><code>{name}</code></li>)}</ul> : <p>All expected secrets are present.</p>}<p className="fine-print">Add actual values in Supabase → Project Settings → Edge Functions → Secrets. Never paste secret values into chat or GitHub.</p></div>}
        {check.id === 'rls' && check.details && <div className="health-details">{check.details.rlsDisabled?.length>0 && <><strong>RLS disabled</strong><ul>{check.details.rlsDisabled.map(t=><li key={t.schema+'.'+t.name}>{t.schema}.{t.name}</li>)}</ul></>}{check.details.publicTablesWithoutPolicies?.length>0 && <><strong>Public tables with no policies</strong><ul>{check.details.publicTablesWithoutPolicies.map(t=><li key={t.schema+'.'+t.name}>{t.schema}.{t.name}</li>)}</ul></>}</div>}
        {check.id === 'extensions' && check.details?.extensions?.length>0 && <p className="health-details">Review: {check.details.extensions.join(', ')}</p>}
        {check.id === 'indexes' && check.details?.indexes?.length>0 && <ul className="health-details">{check.details.indexes.map(i=><li key={i.schema+'.'+i.index}>{i.schema}.{i.table} — {i.index} ({i.scans} scans)</li>)}</ul>}
        {check.id === 'database' && check.details?.sizeBytes && <p className="health-details">Database size: {(check.details.sizeBytes/1024/1024).toFixed(1)} MB</p>}
      </article>)}</div>
      <p className="fine-print">{report.note}</p>
    </>}
  </section>
}

function AuthScreen({ mode,setMode,email,setEmail,password,setPassword,displayName,setDisplayName,busy,notice,onSubmit }) {
  return <main className="auth-layout"><section className="brand-panel"><div className="brand"><span className="brand-icon">FC</span> FREE CROSSPOSTER</div><div className="hero-copy"><p className="eyebrow">ONE WORKFLOW. MULTIPLE CHANNELS.</p><h1>Your content.<br/><span>Everywhere.</span></h1><p className="muted">Prepare a post once, organize your destinations, and manage your publishing workflow from one workspace.</p></div><div className="brand-foot"><ShieldCheck size={16}/> Your media is stored privately.</div></section><section className="auth-panel"><form className="auth-card" onSubmit={onSubmit}><div className="mobile-brand"><span className="brand-icon">FC</span> FREE CROSSPOSTER</div><p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</h2><p className="muted small">Use your email address to access your publishing dashboard.</p>{mode === 'signup' && <label>Your name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name"/></label>}<label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label><label>Password<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label><button className="primary-btn full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button><p className="switch-mode">{mode === 'login' ? "Don't have an account?" : 'Already registered?'} <button type="button" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Create one':'Sign in'}</button></p>{notice && <p className="notice">{notice}</p>}</form></section></main>
}
function PageHeader({eyebrow,title,description,action}) { return <div className="welcome-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div> }
function Overview({posts,accounts,schedules,logs,onNavigate}) {
  const connected=accounts.filter(a=>a.account_status==='connected').length
  const stats=[['Total posts',posts.length],['Connected accounts',connected],['Scheduled',schedules.filter(s=>s.status==='scheduled').length],['Published events',logs.filter(l=>l.status==='published').length]]
  return <><PageHeader eyebrow="YOUR PUBLISHING WORKSPACE" title="Good to see you." description="A clear view of your content and connected channels." action={<span className="status-pill"><span/> Workspace ready</span>}/><div className="stats-grid">{stats.map(([label,value])=><div className="card stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="dashboard-grid overview-grid"><section className="card"><div className="section-heading"><div><h2>Quick actions</h2><p className="muted small">Pick up where you left off.</p></div></div><div className="quick-actions"><button className="quick-action" onClick={()=>onNavigate('create')}><Plus/>Create a post</button><button className="quick-action" onClick={()=>onNavigate('calendar')}><CalendarDays/>Schedule content</button><button className="quick-action" onClick={()=>onNavigate('accounts')}><Link2/>Connect an account</button></div></section><section className="card"><div className="section-heading"><div><h2>Channels</h2><p className="muted small">Connection status</p></div></div>{platforms.map(p=><div className="channel-row" key={p.id}><span className={'platform-mark '+p.id}><PlatformLogo platform={p.id} /></span><span>{p.label}</span><span className="not-connected">{accounts.filter(a=>a.platform===p.id&&a.account_status==='connected').length} connected</span></div>)}</section></div><section className="card recent-card"><div className="section-heading"><div><h2>Recent content</h2><p className="muted small">Your latest posts.</p></div><button className="text-action" onClick={()=>onNavigate('drafts')}>View drafts</button></div>{posts.slice(0,5).map(p=><div className="simple-row" key={p.id}><div><strong>{p.caption || 'Media-only post'}</strong><span>{new Date(p.created_at).toLocaleString()}</span></div><span className="draft-status">{p.status}</span></div>)}{!posts.length&&<div className="empty-state">No posts yet. Create your first post.</div>}</section></>
}
function CreatePost({caption,setCaption,file,setFile,selectedPlatforms,setSelectedPlatforms,onSubmit,busy,onSuggestHashtags,aiLoading,hashtagSuggestions,onAddHashtag}) {
  return <><PageHeader eyebrow="CONTENT STUDIO" title="Create a post." description="Prepare your content once and choose where it should go."/><div className="card composer"><form onSubmit={onSubmit}><label>Caption<textarea rows="6" value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Write your caption…"/></label><section className="ai-hashtag-panel"><div className="ai-hashtag-heading"><div><strong><Sparkles size={15}/> AI hashtag ideas</strong><span>Suggestions based on your caption and selected platforms</span></div><button type="button" className="secondary-action" onClick={onSuggestHashtags} disabled={aiLoading||!caption.trim()}>{aiLoading?'Thinking…':'Suggest hashtags'}</button></div>{hashtagSuggestions.length>0&&<div className="ai-hashtag-chips">{hashtagSuggestions.map(tag=><button type="button" key={tag} onClick={()=>onAddHashtag(tag)} title="Add this hashtag to your caption">{tag}<span>+</span></button>)}</div>}<p className="fine-print">AI suggestions are ideas, not live trend data or a promise of viral reach.</p></section><label className="upload-zone"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" onChange={e=>setFile(e.target.files?.[0]||null)}/>{file?<><div className="upload-icon"><Video/></div><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(1)} MB · click to replace</span></>:<><div className="upload-icon"><ImagePlus/></div><strong>Add a photo or video</strong><span>JPEG, PNG, WebP, GIF, MP4, MOV or WebM · max 50 MB</span></>}</label><div className="destination-block"><div className="destination-title"><span>Choose destinations</span><span className="muted tiny">Publishing requires an authorized account</span></div><div className="platform-list">{platforms.map(p=><button type="button" key={p.id} disabled={false} className={'platform-choice '+(selectedPlatforms.includes(p.id)?'selected':'')+''} onClick={()=>setSelectedPlatforms(current=>current.includes(p.id)?current.filter(x=>x!==p.id):[...current,p.id])}><span className={'platform-mark '+p.id}><PlatformLogo platform={p.id} /></span>{p.label}{p.id==='tiktok'&&<small>Video posts</small>}<span className="check">{selectedPlatforms.includes(p.id)?'✓':p.id==='instagram'?'+':'—'}</span></button>)}</div></div><button className="primary-btn full" disabled={busy}>{busy?'Saving…':'Save post draft'} <Send size={16}/></button></form></div></>
}
function Drafts({posts,destinations,accounts,onDelete,onSave,onPublish,onAssignAccount,publishingPostId}) {
  const [edits,setEdits]=useState({})
  return <>
    <PageHeader eyebrow="CONTENT LIBRARY" title="Drafts." description="Edit captions, assign each destination account and publish."/>
    <section className="card"><div className="draft-list">
      {posts.map(post=>{
        const targets=destinations.filter(item=>item.post_id===post.id&&['instagram','tiktok'].includes(item.platform))
        return <article className="draft-editor" key={post.id}>
          <textarea rows="3" value={edits[post.id]??post.caption} onChange={event=>setEdits(value=>({...value,[post.id]:event.target.value}))}/>
          <div className="draft-editor-footer"><span>{post.media_type||'Text post'} · {new Date(post.created_at).toLocaleDateString()} · {post.status}</span>
            <div className="button-row">
              <button className="secondary-action" onClick={()=>onSave(post.id,edits[post.id]??post.caption)}><Save size={14}/> Save</button>
              {targets.map(destination=>{
                const platform=destination.platform
                const linked=accounts.filter(item=>item.platform===platform&&item.account_status==='connected')
                const account=accounts.find(item=>item.id===destination.social_account_id&&item.account_status==='connected')
                const label=platform==='instagram'?'Instagram':'TikTok'
                return <div className="draft-target" key={destination.id}>
                  {account?<span className="draft-target-name">{account.username?'@'+account.username:account.display_name||label}</span>
                  :<select aria-label={'Choose '+label+' account'} value="" onChange={event=>event.target.value&&onAssignAccount(destination.id,event.target.value)} disabled={!linked.length}>
                    <option value="">{linked.length?'Choose '+label+' account…':'Connect '+label+' first'}</option>
                    {linked.map(item=><option key={item.id} value={item.id}>{item.username?'@'+item.username:item.display_name||item.platform_user_id}</option>)}
                  </select>}
                  {destination.status==='published'?<span className="draft-status success-status">Published</span>
                  :destination.status==='scheduled'||destination.status==='processing'||destination.status==='publishing'?<span className="draft-status">{destination.status}</span>
                  :<button className="secondary-action" onClick={()=>onPublish(post.id,destination.id,platform)} disabled={publishingPostId===post.id||!account||(platform==='tiktok'&&post.media_type!=='video')} title={platform==='tiktok'&&post.media_type!=='video'?'TikTok Direct Post currently supports video only.':''}>{publishingPostId===post.id?'Publishing…':'Publish '+label}</button>}
                </div>
              })}
              {!targets.length&&<span className="muted tiny">No destinations selected</span>}
              <button className="danger-action" onClick={()=>onDelete(post)}><Trash2 size={14}/> Delete</button>
            </div>
          </div>
        </article>
      })}
      {!posts.length&&<div className="empty-state">No drafts to show.</div>}
    </div></section>
  </>
}
function CalendarView({posts,schedules,onSchedule,onCancel,busy,schedulePostId,setSchedulePostId,destinationId,setDestinationId,scheduleAt,setScheduleAt,destinations}) {
  const [scheduleRows,setScheduleRows]=useState([])
  useEffect(()=>{
    let alive=true
    async function load(){
      const upcoming=schedules.filter(item=>['scheduled','processing'].includes(item.status))
      if(!upcoming.length){setScheduleRows([]);return}
      const ids=upcoming.map(item=>item.destination_id)
      const {data:dest}=await supabase.from('post_destinations').select('id,post_id,platform').in('id',ids)
      const destinationMap=new Map((dest||[]).map(item=>[item.id,item]))
      const postIds=[...new Set((dest||[]).map(item=>item.post_id))]
      const {data:postData}=postIds.length
        ? await supabase.from('posts').select('id,caption').in('id',postIds)
        : {data:[]}
      const postMap=new Map((postData||[]).map(item=>[item.id,item]))
      if(alive)setScheduleRows(upcoming.map(item=>({...item,destination:destinationMap.get(item.destination_id),post:postMap.get(destinationMap.get(item.destination_id)?.post_id)})))
    }
    load()
    return()=>{alive=false}
  },[schedules])
  return <>
    <PageHeader eyebrow="PUBLISHING PLANNER" title="Calendar." description="Schedule Instagram destinations and review upcoming posts."/>
    <div className="dashboard-grid calendar-grid">
      <section className="card">
        <h2>Schedule a post</h2>
        <form onSubmit={onSchedule}>
          <label>Choose a draft
            <select required value={schedulePostId} onChange={event=>{setSchedulePostId(event.target.value);setDestinationId('')}}>
              <option value="">Select a draft…</option>
              {posts.filter(post=>post.status!=='published').map(post=><option key={post.id} value={post.id}>{(post.caption||'Media-only post').slice(0,65)}</option>)}
            </select>
          </label>
          <label>Instagram account
            <select required value={destinationId} onChange={event=>setDestinationId(event.target.value)}>
              <option value="">Select a connected account…</option>
              {destinations.filter(item=>item.platform==='instagram'&&item.social_account_id).map(item=><option key={item.id} value={item.id}>Instagram · {item.status}</option>)}
            </select>
          </label>
          <label>Date and time<input required type="datetime-local" value={scheduleAt} onChange={event=>setScheduleAt(event.target.value)}/></label>
          <button className="primary-btn full" disabled={busy||!schedulePostId||!destinationId||!scheduleAt}>Save schedule <Clock3 size={15}/></button>
        </form>
        <p className="fine-print">Instagram schedules are checked automatically every minute. Keep the connected account authorized and the post media available.</p>
      </section>
      <section className="card">
        <div className="section-heading"><div><h2>Upcoming schedule</h2><p className="muted small">{scheduleRows.length} scheduled destinations</p></div></div>
        {scheduleRows.map(row=><div className="simple-row" key={row.id}>
          <div><strong>{row.post?.caption||'Scheduled post'}</strong><span>{row.destination?.platform||'Instagram'} · {new Date(row.scheduled_at).toLocaleString()} · {row.status}</span></div>
          {row.status==='scheduled'&&<button className="danger-action" onClick={()=>onCancel(row)}><X size={14}/> Cancel</button>}
        </div>)}
        {!scheduleRows.length&&<div className="empty-state">Nothing scheduled yet.</div>}
      </section>
    </div>
  </>
}

function HistoryView({logs,posts}) {
  const postMap=new Map(posts.map(p=>[p.id,p]))
  return <><PageHeader eyebrow="ACTIVITY" title="Publishing history." description="Review publishing events and errors recorded by connected platforms."/><section className="card"><div className="history-list">{logs.map(log=><div className="simple-row" key={log.id}><div><strong>{postMap.get(log.post_id)?.caption||'Post activity'} · {log.platform}</strong><span>{new Date(log.created_at).toLocaleString()} · {log.message||'No additional details'}</span></div><span className={'draft-status '+(log.status==='published'?'success-status':'')}>{log.status}</span></div>)}{!logs.length&&<div className="empty-state">No publishing events have been recorded yet.</div>}</div></section></>
}
function Accounts({accounts,onConnect,onConnectTikTok,onDisconnect,busy}) {
  return <><PageHeader eyebrow="YOUR SOCIAL CHANNELS" title="Connected accounts." description="Manage Instagram and TikTok now; YouTube connection is being prepared."/><div className="accounts-grid">
    {platforms.map(p=><article className="account-card card" key={p.id}>
      <div className="account-card-top"><span className={'platform-mark '+p.id}><PlatformLogo platform={p.id} /></span><span className="account-status pending">{accounts.filter(a=>a.platform===p.id&&a.account_status==='connected').length} connected</span></div>
      <h2>{p.label}</h2>
      <p className="muted small">{p.id==='instagram'?'Meta login for professional Instagram accounts.':'TikTok Content Posting API for video publishing.'}</p>
      {accounts.filter(a=>a.platform===p.id&&a.environment==='production').map(a=><div className="channel-row" key={a.id}><span>{a.username?'@'+a.username:a.display_name||a.platform_user_id}</span><button className="danger-action" onClick={()=>onDisconnect(a)}><Trash2 size={13}/> Disconnect</button></div>)}
      <button className="primary-btn full" onClick={p.id==='instagram'?onConnect:onConnectTikTok} disabled={busy}>
        Connect {p.label} <PlatformLogo platform={p.id} />
      </button>
    </article>)}
    <article className="account-card card">
      <div className="account-card-top"><span className="platform-mark youtube"><PlatformLogo platform="youtube" /></span><span className="account-status pending">Setup required</span></div>
      <h2>YouTube</h2>
      <p className="muted small">YouTube channel connection and video publishing are the next integration to build.</p>
      <button className="primary-btn full" disabled title="YouTube OAuth setup is not deployed yet">YouTube setup in progress</button>
      <p className="fine-print">Requires a Google Cloud project, YouTube Data API v3, OAuth consent screen and client credentials.</p>
    </article>
  </div></>
}
function SettingsView({profile,setProfile,settings,setSettings,onProfileSave,onSettingsSave,onPasswordReset,busy,email}) {
  return <><PageHeader eyebrow="WORKSPACE PREFERENCES" title="Settings." description="Manage your profile, timezone and notification preferences."/><div className="dashboard-grid settings-grid"><form className="card" onSubmit={onProfileSave}><h2>Profile</h2><p className="muted small">Your account details.</p><label>Email address<input value={email} disabled/></label><label>Display name<input value={profile.display_name} onChange={e=>setProfile(p=>({...p,display_name:e.target.value}))} placeholder="Your name"/></label><label>Avatar URL<input value={profile.avatar_url} onChange={e=>setProfile(p=>({...p,avatar_url:e.target.value}))} placeholder="https://…"/></label><button className="primary-btn full" disabled={busy}>Save profile <Save size={15}/></button></form><form className="card" onSubmit={onSettingsSave}><h2>Preferences</h2><p className="muted small">Choose how your workspace behaves. In-app alerts appear in the bell menu; email delivery still needs an email provider.</p><label>Timezone<select value={settings.timezone} onChange={e=>setSettings(s=>({...s,timezone:e.target.value}))}><option>Africa/Kigali</option><option>Africa/Nairobi</option><option>UTC</option><option>Europe/London</option></select></label>{[['email_notifications','Email notifications (delivery not enabled)'],['publish_success_notifications','Successful publishing alerts'],['publish_failure_notifications','Failed publishing alerts'],['weekly_summary','Weekly summary']].map(([key,label])=><label className="toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={!!settings[key]} onChange={e=>setSettings(s=>({...s,[key]:e.target.checked}))}/></label>)}<button className="primary-btn full" disabled={busy}>Save preferences <Save size={15}/></button></form></div><section className="card security-card"><h2>Security</h2><p className="muted small">Social access tokens are stored encrypted by the server. You can revoke a social connection from Connected accounts. Use a unique password for your FREE CROSSPOSTER account.</p><button type="button" className="secondary-action" onClick={onPasswordReset}>Send password reset email</button><div className="settings-api-note"><strong>Platform API credentials</strong><span>Meta and TikTok app secrets stay in Supabase Edge Function secrets. They are never stored in browser settings or exposed in this page.</span></div></section></>
}
function SetupMessage(){return <main className="center-screen"><div className="setup-card"><span className="brand-icon">FC</span><h1>Connect your Supabase project</h1><p className="muted">Create a local <code>.env</code> file using <code>.env.example</code>, then add your Supabase URL and publishable key.</p></div></main>}


function LandingPage({ onGetStarted, onSignIn }) {
  return <main className="landing-page">
    <header className="landing-nav">
      <a className="landing-brand" href="#home"><span className="brand-icon">FC</span> FREE CROSSPOSTER</a>
      <nav><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a></nav>
      <div className="landing-actions"><button className="landing-signin" onClick={onSignIn}>Sign in</button><button className="landing-nav-cta" onClick={onGetStarted}>Get started <span>↗</span></button></div>
    </header>
    <section className="landing-hero" id="home">
      <div className="landing-glow landing-glow-one"/><div className="landing-glow landing-glow-two"/>
      <div className="landing-hero-copy">
        <span className="landing-eyebrow"><i/> ONE WORKFLOW. MULTIPLE CHANNELS.</span>
        <h1>Create once.<br/><em>Show up everywhere.</em></h1>
        <p>Plan, organize and publish your social content from one calm, powerful workspace. Spend less time switching apps and more time creating.</p>
        <div className="landing-hero-buttons"><button className="landing-primary" onClick={onGetStarted}>Start for free <span>→</span></button><a className="landing-secondary" href="#how-it-works">See how it works <span>↓</span></a></div>
        <div className="landing-proof"><span>✓</span> Your content stays yours <b>·</b> Connect accounts when you're ready</div>
      </div>
      <div className="landing-visual" aria-label="Animated preview of the publishing workspace">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
        <div className="preview-window">
          <div className="preview-top"><span className="preview-dots"><i/><i/><i/></span><b>YOUR WORKSPACE</b><span className="preview-live">● LIVE</span></div>
          <div className="preview-body"><aside className="preview-side"><span className="preview-logo">FC</span><i/><i/><i/><i/><i/></aside>
            <div className="preview-main"><small>CONTENT OVERVIEW</small><h3>Your content, organized.</h3><div className="preview-stats"><span><b>Posts</b><strong>12</strong></span><span><b>Channels</b><strong>02</strong></span><span><b>Scheduled</b><strong>04</strong></span></div>
              <div className="preview-post"><div className="preview-thumb"><span>✦</span></div><div><b>Weekend story</b><small>Ready for your channels</small><div className="preview-tags"><i>Instagram</i><i>TikTok</i></div></div><span className="preview-check">✓</span></div>
              <div className="preview-timeline"><span/><span/><span/><span/><span/><span/><span/></div>
            </div>
          </div>
        </div>
        <div className="float-chip chip-ai"><span>✦</span> AI ideas <b>soon</b></div>
        <div className="float-chip chip-calendar"><span>▦</span> Content calendar</div>
        <div className="float-chip chip-social"><span>◎</span><span>♪</span> Connected channels</div>
      </div>
    </section>
    <section className="landing-strip"><span>MADE FOR CREATORS & SMALL TEAMS</span><b>Instagram</b><b>TikTok</b><b>One simple workflow</b></section>
    <section className="landing-section" id="features"><div className="landing-section-heading"><span className="landing-eyebrow">LESS CHAOS, MORE CREATING</span><h2>Everything you need to stay<br/><em>consistent online.</em></h2><p>A practical toolkit for planning and publishing without juggling a dozen tabs.</p></div>
      <div className="landing-feature-grid">
        <article className="landing-feature feature-lime"><span className="feature-symbol">▤</span><h3>One content studio</h3><p>Prepare captions and upload photos or videos, then choose the channels you want to target.</p><small>CREATE · ORGANIZE · PUBLISH</small></article>
        <article className="landing-feature feature-violet"><span className="feature-symbol">▦</span><h3>Plan ahead</h3><p>Keep drafts and publishing activity organized, with a calendar for supported scheduled posts.</p><small>CALENDAR · DRAFTS · HISTORY</small></article>
        <article className="landing-feature feature-blue"><span className="feature-symbol">✧</span><h3>Smarter content ideas</h3><p>AI-powered hashtag and caption suggestions are planned to help you discover relevant ideas for each post.</p><small>AI ASSISTANCE · COMING SOON</small></article>
      </div>
    </section>
    <section className="landing-how" id="how-it-works"><div><span className="landing-eyebrow">A SIMPLE WORKFLOW</span><h2>From idea to<br/><em>published.</em></h2><p>Start with one post. Add your channels. Keep your publishing workflow in one place.</p><button className="landing-primary" onClick={onGetStarted}>Build your workspace <span>→</span></button></div>
      <div className="landing-steps"><article><span>01</span><div><h3>Create your account</h3><p>Sign up securely and open your personal publishing workspace.</p></div><b>↗</b></article><article><span>02</span><div><h3>Connect your channels</h3><p>Authorize the social accounts you want to manage. You stay in control of access.</p></div><b>↗</b></article><article><span>03</span><div><h3>Create and publish</h3><p>Upload your media, write a caption, choose destinations and publish where supported.</p></div><b>↗</b></article></div>
    </section>
    <section className="landing-cta"><span className="landing-eyebrow">YOUR NEXT POST STARTS HERE</span><h2>Make consistency<br/><em>feel effortless.</em></h2><button className="landing-primary" onClick={onGetStarted}>Get started for free <span>→</span></button></section>
    <footer className="landing-footer"><a className="landing-brand" href="#home"><span className="brand-icon">FC</span> FREE CROSSPOSTER</a><span>© 2026 FREE CROSSPOSTER</span><div><a href="/terms.html">Terms of Service</a><a href="/privacy.html">Privacy Policy</a><a href="mailto:imenaking@gmail.com">Contact</a></div></footer>
  </main>
}
