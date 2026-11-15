import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { LayoutDashboard, CalendarDays, FileText, History, Link2, Settings, LogOut, ImagePlus, Send, ShieldCheck, Video, Instagram, Trash2, Clock3, Plus, Save, X, RefreshCw, Bell, CheckCheck } from 'lucide-react'

const platforms = [
  { id: 'instagram', label: 'Instagram', mark: 'IG' },
  { id: 'facebook', label: 'Facebook', mark: 'f' },
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
]

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('login')
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
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram'])
  const [schedulePostId, setSchedulePostId] = useState('')
  const [scheduleDestinationId, setScheduleDestinationId] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [publishingPostId, setPublishingPostId] = useState(null)

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
  async function loadPosts() {
    const { data, error } = await supabase.from('posts').select('id,caption,media_path,media_type,original_filename,status,created_at,updated_at').order('created_at', { ascending: false }).limit(100)
    if (error) setNotice(error.message); else setPosts(data || [])
  }
  async function loadAccounts() {
    const { data, error } = await supabase.from('social_accounts').select('id,platform,platform_user_id,username,display_name,account_status,token_expires_at,connected_at').order('connected_at', { ascending: false })
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
      const { data, error } = await supabase.functions.invoke('meta-oauth-start', { body: {} })
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
    const date = new Date(scheduleAt)
    if (Number.isNaN(date.getTime()) || date <= new Date()) return setNotice('Choose a future date and time.')
    setBusy(true)
    try {
      const { error } = await supabase.from('scheduled_posts').insert({ destination_id: scheduleDestinationId, user_id: session.user.id, scheduled_at: date.toISOString(), status: 'scheduled' })
      if (error) throw error
      const { error: destError } = await supabase.from('post_destinations').update({ status: 'scheduled', updated_at: new Date().toISOString() }).eq('id', scheduleDestinationId).eq('user_id', session.user.id)
      if (destError) throw destError
      setNotice('Schedule saved. Automatic publishing still requires the scheduler worker to be enabled.'); setSchedulePostId(''); setScheduleDestinationId(''); setScheduleAt(''); await refreshWorkspace()
    } catch (error) { setNotice(error.message || 'Could not schedule this post.') }
    finally { setBusy(false) }
  }
  async function cancelSchedule(item) {
    const { error } = await supabase.from('scheduled_posts').delete().eq('id', item.id).eq('user_id', session.user.id)
    if (error) setNotice(error.message)
    else { await supabase.from('post_destinations').update({ status: 'pending' }).eq('id', item.destination_id).eq('user_id', session.user.id); setNotice('Schedule cancelled.'); await refreshWorkspace() }
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
  const draftPosts = posts.filter(post => ['draft','failed'].includes(post.status) || !['published','partially_published'].includes(post.status))
  const selectedPostDestinations = posts.find(post => post.id === schedulePostId)
  const [destRows, setDestRows] = useState([])
  useEffect(() => {
    if (!session?.user || !schedulePostId) { setDestRows([]); return }
    supabase.from('post_destinations').select('id,platform,status,social_account_id').eq('post_id', schedulePostId).then(({ data }) => setDestRows(data || []))
  }, [schedulePostId, session?.user?.id])

  if (!isSupabaseConfigured) return <SetupMessage />
  if (loading) return <main className="center-screen"><div className="loader" />Loading FREE CROSSPOSTER…</main>
  if (!session) return <AuthScreen mode={mode} setMode={setMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} displayName={displayName} setDisplayName={setDisplayName} busy={authBusy} notice={notice} onSubmit={handleAuth} />

  const activeTitle = navItems.find(item => item.id === activeView)?.label || 'Overview'
  return <main className="dashboard socialync-shell">
    <aside className="app-sidebar">
      <div className="brand"><span className="brand-icon">FC</span><span>FREE CROSSPOSTER</span></div>
      <p className="sidebar-label">WORKSPACE</p>
      {navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={activeView === item.id ? 'sidebar-link active' : 'sidebar-link'} onClick={() => { setActiveView(item.id); setNotice('') }}><Icon size={17} /> {item.label}</button> })}
      <div className="sidebar-bottom"><div className="sidebar-user"><span className="avatar">{(session.user.email || 'U').slice(0,1).toUpperCase()}</span><span className="sidebar-user-email">{session.user.email}</span></div><button className="sidebar-signout" onClick={handleSignOut}><LogOut size={16} /> Sign out</button></div>
    </aside>
    <section className="app-main">
      <header className="topbar"><div><span className="topbar-kicker">YOUR WORKSPACE</span><strong>{activeTitle}</strong></div><div className="user-area"><span className="user-email">{session.user.email}</span><div className="notification-wrap"><button className="icon-btn notification-trigger" onClick={()=>setNotificationOpen(v=>!v)} title="Notifications"><Bell size={17}/>{notifications.some(n=>!n.read_at)&&<i/>}</button>{notificationOpen&&<div className="notification-panel"><div className="notification-heading"><strong>Notifications</strong><button onClick={markAllNotificationsRead}><CheckCheck size={13}/> Mark all read</button></div>{notifications.map(item=><button key={item.id} className={'notification-item '+(!item.read_at?'unread':'')} onClick={()=>markNotificationRead(item)}><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString()}</small></button>)}{!notifications.length&&<p className="empty-state">No notifications yet.</p>}</div>}</div><button className="icon-btn" onClick={refreshWorkspace} title="Refresh workspace"><RefreshCw size={17}/></button></div></header>
      <div className="dashboard-content">
        {activeView === 'overview' && <Overview posts={posts} accounts={socialAccounts} schedules={schedules} logs={logs} onNavigate={setActiveView} />}
        {activeView === 'create' && <CreatePost caption={caption} setCaption={setCaption} file={file} setFile={setFile} selectedPlatforms={selectedPlatforms} setSelectedPlatforms={setSelectedPlatforms} onSubmit={createDraft} busy={busy} />}
        {activeView === 'drafts' && <Drafts posts={draftPosts} destinations={postDestinations} accounts={socialAccounts} onDelete={deleteDraft} onSave={saveCaption} onPublish={publishInstagram} publishingPostId={publishingPostId} />}
        {activeView === 'calendar' && <CalendarView posts={posts} schedules={schedules} onSchedule={schedulePost} onCancel={cancelSchedule} busy={busy} schedulePostId={schedulePostId} setSchedulePostId={setSchedulePostId} destinationId={scheduleDestinationId} setDestinationId={setScheduleDestinationId} scheduleAt={scheduleAt} setScheduleAt={setScheduleAt} destinations={destRows} />}
        {activeView === 'history' && <HistoryView logs={logs} posts={posts} />}
        {activeView === 'accounts' && <Accounts accounts={socialAccounts} onConnect={connectInstagram} onDisconnect={disconnectAccount} busy={busy} />}
        {activeView === 'settings' && <SettingsView profile={profile} setProfile={setProfile} settings={settings} setSettings={setSettings} onProfileSave={saveProfile} onSettingsSave={saveSettings} onPasswordReset={sendPasswordReset} busy={busy} email={session.user.email} />}
        {notice && <p className="notice workspace-notice">{notice}</p>}
      </div>
    </section>
  </main>
}

function AuthScreen({ mode,setMode,email,setEmail,password,setPassword,displayName,setDisplayName,busy,notice,onSubmit }) {
  return <main className="auth-layout"><section className="brand-panel"><div className="brand"><span className="brand-icon">FC</span> FREE CROSSPOSTER</div><div className="hero-copy"><p className="eyebrow">ONE WORKFLOW. MULTIPLE CHANNELS.</p><h1>Your content.<br/><span>Everywhere.</span></h1><p className="muted">Prepare a post once, organize your destinations, and manage your publishing workflow from one workspace.</p></div><div className="brand-foot"><ShieldCheck size={16}/> Your media is stored privately.</div></section><section className="auth-panel"><form className="auth-card" onSubmit={onSubmit}><div className="mobile-brand"><span className="brand-icon">FC</span> FREE CROSSPOSTER</div><p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</h2><p className="muted small">Use your email address to access your publishing dashboard.</p>{mode === 'signup' && <label>Your name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name"/></label>}<label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label><label>Password<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label><button className="primary-btn full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button><p className="switch-mode">{mode === 'login' ? "Don't have an account?" : 'Already registered?'} <button type="button" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Create one':'Sign in'}</button></p>{notice && <p className="notice">{notice}</p>}</form></section></main>
}
function PageHeader({eyebrow,title,description,action}) { return <div className="welcome-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div> }
function Overview({posts,accounts,schedules,logs,onNavigate}) {
  const connected=accounts.filter(a=>a.account_status==='connected').length
  const stats=[['Total posts',posts.length],['Connected accounts',connected],['Scheduled',schedules.filter(s=>s.status==='scheduled').length],['Published events',logs.filter(l=>l.status==='published').length]]
  return <><PageHeader eyebrow="YOUR PUBLISHING WORKSPACE" title="Good to see you." description="A clear view of your content and connected channels." action={<span className="status-pill"><span/> Workspace ready</span>}/><div className="stats-grid">{stats.map(([label,value])=><div className="card stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="dashboard-grid overview-grid"><section className="card"><div className="section-heading"><div><h2>Quick actions</h2><p className="muted small">Pick up where you left off.</p></div></div><div className="quick-actions"><button className="quick-action" onClick={()=>onNavigate('create')}><Plus/>Create a post</button><button className="quick-action" onClick={()=>onNavigate('calendar')}><CalendarDays/>Schedule content</button><button className="quick-action" onClick={()=>onNavigate('accounts')}><Link2/>Connect an account</button></div></section><section className="card"><div className="section-heading"><div><h2>Channels</h2><p className="muted small">Connection status</p></div></div>{platforms.map(p=><div className="channel-row" key={p.id}><span className={'platform-mark '+p.id}>{p.mark}</span><span>{p.label}</span><span className="not-connected">{accounts.filter(a=>a.platform===p.id&&a.account_status==='connected').length} connected</span></div>)}</section></div><section className="card recent-card"><div className="section-heading"><div><h2>Recent content</h2><p className="muted small">Your latest posts.</p></div><button className="text-action" onClick={()=>onNavigate('drafts')}>View drafts</button></div>{posts.slice(0,5).map(p=><div className="simple-row" key={p.id}><div><strong>{p.caption || 'Media-only post'}</strong><span>{new Date(p.created_at).toLocaleString()}</span></div><span className="draft-status">{p.status}</span></div>)}{!posts.length&&<div className="empty-state">No posts yet. Create your first post.</div>}</section></>
}
function CreatePost({caption,setCaption,file,setFile,selectedPlatforms,setSelectedPlatforms,onSubmit,busy}) {
  return <><PageHeader eyebrow="CONTENT STUDIO" title="Create a post." description="Prepare your content once and choose where it should go."/><div className="card composer"><form onSubmit={onSubmit}><label>Caption<textarea rows="6" value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Write your caption…"/></label><label className="upload-zone"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" onChange={e=>setFile(e.target.files?.[0]||null)}/>{file?<><div className="upload-icon"><Video/></div><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(1)} MB · click to replace</span></>:<><div className="upload-icon"><ImagePlus/></div><strong>Add a photo or video</strong><span>JPEG, PNG, WebP, GIF, MP4, MOV or WebM · max 50 MB</span></>}</label><div className="destination-block"><div className="destination-title"><span>Choose destinations</span><span className="muted tiny">Publishing requires an authorized account</span></div><div className="platform-list">{platforms.map(p=><button type="button" key={p.id} disabled={p.id!=='instagram'} className={'platform-choice '+(selectedPlatforms.includes(p.id)?'selected':'')+(p.id!=='instagram'?' platform-disabled':'')} onClick={()=>setSelectedPlatforms(current=>current.includes(p.id)?current.filter(x=>x!==p.id):[...current,p.id])}><span className={'platform-mark '+p.id}>{p.mark}</span>{p.label}{p.id!=='instagram'&&<small>API setup required</small>}<span className="check">{selectedPlatforms.includes(p.id)?'✓':p.id==='instagram'?'+':'—'}</span></button>)}</div></div><button className="primary-btn full" disabled={busy}>{busy?'Saving…':'Save post draft'} <Send size={16}/></button></form></div></>
}
function Drafts({posts,destinations,accounts,onDelete,onSave,onPublish,publishingPostId}) {
  const [edits,setEdits]=useState({})
  return <><PageHeader eyebrow="CONTENT LIBRARY" title="Drafts." description="Edit captions, publish to connected channels or remove content."/><section className="card"><div className="draft-list">{posts.map(post=><div className="draft-editor" key={post.id}><textarea rows="3" value={edits[post.id]??post.caption} onChange={e=>setEdits(v=>({...v,[post.id]:e.target.value}))}/><div className="draft-editor-footer"><span>{post.media_type||'Text post'} · {new Date(post.created_at).toLocaleDateString()} · {post.status}</span><div className="button-row"><button className="secondary-action" onClick={()=>onSave(post.id,edits[post.id]??post.caption)}><Save size={14}/> Save</button>{destinations.filter(d=>d.post_id===post.id&&d.platform==='instagram').map(d=>{const account=accounts.find(a=>a.id===d.social_account_id);return d.status==='published'?<span className="draft-status success-status" key={d.id}>{account?.username?'@'+account.username+' · ':''}Published</span>:<button key={d.id} className="secondary-action" onClick={()=>onPublish(post.id,d.id)} disabled={publishingPostId===post.id||!account}>{publishingPostId===post.id?'Publishing…':`Publish ${account?.username?'@'+account.username:'to Instagram'}`}</button>})}{!destinations.some(d=>d.post_id===post.id&&d.platform==='instagram')&&<span className="muted tiny">No Instagram destination selected</span>}<button className="danger-action" onClick={()=>onDelete(post)}><Trash2 size={14}/> Delete</button></div></div></div>)}{!posts.length&&<div className="empty-state">No drafts to show.</div>}</div></section></>
}
function CalendarView({posts,schedules,onSchedule,onCancel,busy,schedulePostId,setSchedulePostId,destinationId,setDestinationId,scheduleAt,setScheduleAt,destinations}) {
  const [scheduleRows,setScheduleRows]=useState([])
  useEffect(()=>{let alive=true;async function load(){if(!schedules.length){setScheduleRows([]);return}const ids=schedules.map(s=>s.destination_id);const {data:dest}=await supabase.from('post_destinations').select('id,post_id,platform').in('id',ids);const map=new Map((dest||[]).map(d=>[d.id,d]));const postIds=[...new Set((dest||[]).map(d=>d.post_id))];const {data:postData}=postIds.length?await supabase.from('posts').select('id,caption').in('id',postIds):{data:[]};const postMap=new Map((postData||[]).map(p=>[p.id,p]));if(alive)setScheduleRows(schedules.map(s=>({...s,destination:map.get(s.destination_id),post:postMap.get(map.get(s.destination_id)?.post_id)})))}load();return()=>{alive=false}},[schedules])
  return <><PageHeader eyebrow="PUBLISHING PLANNER" title="Calendar." description="Schedule individual destinations and review upcoming posts."/><div className="dashboard-grid calendar-grid"><section className="card"><h2>Schedule a post</h2><form onSubmit={onSchedule}><label>Choose a draft<select required value={schedulePostId} onChange={e=>setSchedulePostId(e.target.value)}><option value="">Select a draft…</option>{posts.filter(p=>p.status!=='published').map(p=><option key={p.id} value={p.id}>{(p.caption||'Media-only post').slice(0,65)}</option>)}</select></label><label>Destination<select required value={destinationId} onChange={e=>setDestinationId(e.target.value)}><option value="">Select destination…</option>{destinations.map(d=><option key={d.id} value={d.id}>{d.platform} · {d.status}</option>)}</select></label><label>Date and time<input required type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)}/></label><button className="primary-btn full" disabled={busy||!schedulePostId||!destinationId||!scheduleAt}>Save schedule <Clock3 size={15}/></button></form><p className="fine-print">Schedules are saved in your workspace. Automatic publishing needs a scheduler worker and platform authorization before it can run.</p></section><section className="card"><div className="section-heading"><div><h2>Upcoming schedule</h2><p className="muted small">{scheduleRows.length} scheduled destinations</p></div></div>{scheduleRows.map(row=><div className="simple-row" key={row.id}><div><strong>{row.post?.caption||'Scheduled post'}</strong><span>{row.destination?.platform||'Social'} · {new Date(row.scheduled_at).toLocaleString()}</span></div><button className="danger-action" onClick={()=>onCancel(row)}><X size={14}/> Cancel</button></div>)}{!scheduleRows.length&&<div className="empty-state">Nothing scheduled yet.</div>}</section></div></>
}
function HistoryView({logs,posts}) {
  const postMap=new Map(posts.map(p=>[p.id,p]))
  return <><PageHeader eyebrow="ACTIVITY" title="Publishing history." description="Review publishing events and errors recorded by connected platforms."/><section className="card"><div className="history-list">{logs.map(log=><div className="simple-row" key={log.id}><div><strong>{postMap.get(log.post_id)?.caption||'Post activity'} · {log.platform}</strong><span>{new Date(log.created_at).toLocaleString()} · {log.message||'No additional details'}</span></div><span className={'draft-status '+(log.status==='published'?'success-status':'')}>{log.status}</span></div>)}{!logs.length&&<div className="empty-state">No publishing events have been recorded yet.</div>}</div></section></>
}
function Accounts({accounts,onConnect,onDisconnect,busy}) {
  return <><PageHeader eyebrow="YOUR SOCIAL CHANNELS" title="Connected accounts." description="Manage multiple authorized social profiles. Never share your social passwords."/><div className="accounts-grid">{platforms.map(p=><article className="account-card card" key={p.id}><div className="account-card-top"><span className={'platform-mark '+p.id}>{p.mark}</span><span className="account-status pending">{accounts.filter(a=>a.platform===p.id&&a.account_status==='connected').length} connected</span></div><h2>{p.label}</h2><p className="muted small">{p.id==='instagram'?'Meta Unified Login for professional Instagram accounts.':p.id==='facebook'?'Facebook Page publishing integration.':'TikTok Content Posting API integration.'}</p>{accounts.filter(a=>a.platform===p.id).map(a=><div className="channel-row" key={a.id}><span>{a.username?'@'+a.username:a.display_name||a.platform_user_id}</span><button className="danger-action" onClick={()=>onDisconnect(a)}><Trash2 size={13}/> Disconnect</button></div>)}{p.id==='instagram'?<button className="primary-btn full" onClick={onConnect} disabled={busy}>Connect another Instagram <Instagram size={16}/></button>:<div className="integration-block"><strong>Not connected yet</strong><span>{p.id==='facebook'?'Requires Facebook Login permissions, Page access and Meta review.':'Requires a TikTok developer app, Content Posting API access and approval.'}</span></div>}</article>)}</div></>
}
function SettingsView({profile,setProfile,settings,setSettings,onProfileSave,onSettingsSave,onPasswordReset,busy,email}) {
  return <><PageHeader eyebrow="WORKSPACE PREFERENCES" title="Settings." description="Manage your profile, timezone and notification preferences."/><div className="dashboard-grid settings-grid"><form className="card" onSubmit={onProfileSave}><h2>Profile</h2><p className="muted small">Your account details.</p><label>Email address<input value={email} disabled/></label><label>Display name<input value={profile.display_name} onChange={e=>setProfile(p=>({...p,display_name:e.target.value}))} placeholder="Your name"/></label><label>Avatar URL<input value={profile.avatar_url} onChange={e=>setProfile(p=>({...p,avatar_url:e.target.value}))} placeholder="https://…"/></label><button className="primary-btn full" disabled={busy}>Save profile <Save size={15}/></button></form><form className="card" onSubmit={onSettingsSave}><h2>Preferences</h2><p className="muted small">Choose how your workspace behaves.</p><label>Timezone<select value={settings.timezone} onChange={e=>setSettings(s=>({...s,timezone:e.target.value}))}><option>Africa/Kigali</option><option>Africa/Nairobi</option><option>UTC</option><option>Europe/London</option></select></label>{[['email_notifications','Email notifications'],['publish_success_notifications','Successful publishing alerts'],['publish_failure_notifications','Failed publishing alerts'],['weekly_summary','Weekly summary']].map(([key,label])=><label className="toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={!!settings[key]} onChange={e=>setSettings(s=>({...s,[key]:e.target.checked}))}/></label>)}<button className="primary-btn full" disabled={busy}>Save preferences <Save size={15}/></button></form></div><section className="card security-card"><h2>Security</h2><p className="muted small">Social access tokens are stored encrypted by the server. You can revoke a social connection from Connected accounts. Use a unique password for your FREE CROSSPOSTER account.</p><button type="button" className="secondary-action" onClick={onPasswordReset}>Send password reset email</button><div className="settings-api-note"><strong>Platform API credentials</strong><span>Meta and TikTok app secrets stay in Supabase Edge Function secrets. They are never stored in browser settings or exposed in this page.</span></div></section></>
}
function SetupMessage(){return <main className="center-screen"><div className="setup-card"><span className="brand-icon">FC</span><h1>Connect your Supabase project</h1><p className="muted">Create a local <code>.env</code> file using <code>.env.example</code>, then add your Supabase URL and publishable key.</p></div></main>}
