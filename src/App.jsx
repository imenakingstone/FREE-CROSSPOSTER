import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { ArrowUpRight, ImagePlus, LogOut, Send, ShieldCheck, Video, Instagram, ExternalLink, Store, Facebook, Link2 } from 'lucide-react'

const platforms = [
  { id: 'instagram', label: 'Instagram', mark: 'IG' },
  { id: 'facebook', label: 'Facebook', mark: 'f' },
  { id: 'tiktok', label: 'TikTok', mark: '♪' },
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
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram', 'facebook', 'tiktok'])
  const [saving, setSaving] = useState(false)
  const [posts, setPosts] = useState([])
  const [activeView, setActiveView] = useState('publishing')
  const [connectBusy, setConnectBusy] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) loadPosts()
  }, [session?.user?.id])

  async function loadPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('id, caption, media_path, media_type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) setNotice(error.message)
    else setPosts(data ?? [])
  }

  async function handleAuth(event) {
    event.preventDefault()
    setAuthBusy(true)
    setNotice('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        })
        if (error) throw error
        setNotice(data.session
          ? 'Your account is ready.'
          : 'Check your email for a confirmation link, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) {
      setNotice(error.message || 'Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setPosts([])
  }

  async function connectInstagram() {
    setNotice('Direct Instagram login is being configured. This button will use Instagram authorization, not Facebook Login. No account has been connected yet.')
  }

  function togglePlatform(id) {
    setSelectedPlatforms(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    )
  }

  async function createDraft(event) {
    event.preventDefault()
    if (!caption.trim() && !file) {
      setNotice('Add a caption or choose a photo/video first.')
      return
    }
    if (selectedPlatforms.length === 0) {
      setNotice('Choose at least one destination.')
      return
    }
    setSaving(true)
    setNotice('')
    try {
      let mediaPath = null
      let mediaType = null
      if (file) {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
        if (!allowed.includes(file.type)) throw new Error('This file format is not supported.')
        if (file.size > 50 * 1024 * 1024) throw new Error('File is larger than the 50 MB limit.')
        const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
        mediaPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('user-media')
          .upload(mediaPath, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        mediaType = file.type.startsWith('video/') ? 'video' : 'image'
      }

      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: session.user.id,
          caption: caption.trim(),
          media_path: mediaPath,
          media_type: mediaType,
          status: 'draft',
        })
        .select('id')
        .single()
      if (postError) {
        if (mediaPath) await supabase.storage.from('user-media').remove([mediaPath])
        throw postError
      }

      const destinations = selectedPlatforms.map(platform => ({
        post_id: post.id,
        user_id: session.user.id,
        platform,
        status: 'pending',
      }))
      const { error: destinationError } = await supabase.from('post_destinations').insert(destinations)
      if (destinationError) throw destinationError

      setCaption('')
      setFile(null)
      setNotice('Draft saved. Social publishing will become available after you connect and authorize your social accounts.')
      await loadPosts()
    } catch (error) {
      setNotice(error.message || 'Could not save this draft.')
    } finally {
      setSaving(false)
    }
  }

  async function getPrivateMediaUrl(path) {
    const { data, error } = await supabase.storage.from('user-media').createSignedUrl(path, 60 * 5)
    if (error) return null
    return data.signedUrl
  }

  if (!isSupabaseConfigured) return <SetupMessage />
  if (loading) return <main className="center-screen"><div className="loader" />Loading FREE CROSSPOSTER…</main>

  if (!session) {
    return (
      <main className="auth-layout">
        <section className="brand-panel">
          <div className="brand"><span className="brand-icon">FC</span> FREE CROSSPOSTER</div>
          <div className="hero-copy">
            <p className="eyebrow">ONE WORKFLOW. MULTIPLE CHANNELS.</p>
            <h1>Your content.<br /><span>Everywhere.</span></h1>
            <p className="muted">Prepare a post once, organize your destinations, and manage your publishing workflow from one clean workspace.</p>
          </div>
          <div className="brand-foot"><ShieldCheck size={16} /> Your media is stored privately.</div>
        </section>
        <section className="auth-panel">
          <form className="auth-card" onSubmit={handleAuth}>
            <div className="mobile-brand"><span className="brand-icon">FC</span> FREE CROSSPOSTER</div>
            <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</p>
            <h2>{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</h2>
            <p className="muted small">Use your email address to access your publishing dashboard.</p>
            {mode === 'signup' && <label>Your name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>}
            <label>Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
            <label>Password<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            <button className="primary-btn full" disabled={authBusy}>{authBusy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowUpRight size={17} /></button>
            <p className="switch-mode">{mode === 'login' ? "Don't have an account?" : 'Already registered?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setNotice('') }}>{mode === 'login' ? 'Create one' : 'Sign in'}</button></p>
            {notice && <p className="notice">{notice}</p>}
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand"><span className="brand-icon">FC</span> FREE CROSSPOSTER</div>
        <div className="user-area"><span className="user-email">{session.user.email}</span><button className="icon-btn" onClick={handleSignOut} title="Sign out"><LogOut size={18} /></button></div>
      </header>
      <nav className="workspace-nav">
        <button className={activeView === 'publishing' ? 'active' : ''} onClick={() => setActiveView('publishing')}>Publishing workspace</button>
        <button className={activeView === 'accounts' ? 'active' : ''} onClick={() => setActiveView('accounts')}><Link2 size={15} /> Connected accounts</button>
      </nav>
      <div className="dashboard-content">
        {activeView === 'accounts' ? <ConnectedAccounts onConnect={connectInstagram} connectBusy={connectBusy} notice={notice} /> : <>
          <div className="welcome-row"><div><p className="eyebrow">YOUR PUBLISHING WORKSPACE</p><h1>Good to see you.</h1><p className="muted">Create once. Keep your content organized.</p></div><div className="status-pill"><span /> Workspace ready</div></div>
          <div className="dashboard-grid">
            <section className="composer card">
              <div className="section-heading"><div><h2>Create a post</h2><p className="muted small">Your original caption and media are saved as a draft.</p></div><span className="step-label">01 / COMPOSE</span></div>
              <form onSubmit={createDraft}>
                <label>Caption<textarea rows="5" value={caption} onChange={e => setCaption(e.target.value)} placeholder="What would you like to share?" /></label>
                <label className="upload-zone">
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  {file ? <><div className="upload-icon"><Video /></div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(1)} MB · click to replace</span></> : <><div className="upload-icon"><ImagePlus /></div><strong>Add a photo or video</strong><span>JPEG, PNG, WebP, GIF, MP4, MOV or WebM · max 50 MB</span></>}
                </label>
                <div className="destination-block"><div className="destination-title"><span>Choose destinations</span><span className="muted tiny">You can change these later</span></div><div className="platform-list">{platforms.map(platform => <button type="button" key={platform.id} className={`platform-choice ${selectedPlatforms.includes(platform.id) ? 'selected' : ''}`} onClick={() => togglePlatform(platform.id)}><span className={`platform-mark ${platform.id}`}>{platform.mark}</span>{platform.label}<span className="check">{selectedPlatforms.includes(platform.id) ? '✓' : '+'}</span></button>)}</div></div>
                <button className="primary-btn full" disabled={saving}>{saving ? 'Saving draft…' : 'Save post draft'} <Send size={16} /></button>
                <p className="fine-print">Saving a draft does not publish it. Each social network requires its own authorized API connection.</p>
              </form>
              {notice && <p className="notice">{notice}</p>}
            </section>
            <aside className="side-column">
              <section className="card status-card"><div className="section-heading"><div><h2>Connected channels</h2><p className="muted small">Account connections are the next setup stage.</p></div></div>{platforms.map(p => <div className="channel-row" key={p.id}><span className={`platform-mark ${p.id}`}>{p.mark}</span><span>{p.label}</span><span className="not-connected">Not connected</span></div>)}</section>
              <section className="card privacy-card"><div className="privacy-icon"><ShieldCheck /></div><h3>Private by design</h3><p className="muted small">Your uploaded files live in a private storage bucket. Access is limited to your signed-in account.</p></section>
            </aside>
          </div>
          <section className="card recent-card"><div className="section-heading"><div><h2>Your recent drafts</h2><p className="muted small">Posts saved in your workspace.</p></div><span className="step-label">{posts.length} ITEMS</span></div>{posts.length === 0 ? <div className="empty-state">No drafts yet. Create your first post above.</div> : <div className="draft-list">{posts.map(post => <DraftRow key={post.id} post={post} getUrl={getPrivateMediaUrl} />)}</div>}</section>
        </>}
      </div>
    </main>
  )
}

function ConnectedAccounts({ onConnect, connectBusy, notice }) {
  const accounts = [
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Connect a Business or Creator account directly with Instagram.',
      detail: 'Instagram login · No Facebook Page required',
      mark: 'IG',
      action: 'Connect Instagram',
      available: true,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Connect a Facebook Page to publish content to your audience.',
      detail: 'Official Facebook authorization',
      mark: 'f',
      action: 'Coming soon',
      available: false,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Connect your TikTok account for supported video publishing.',
      detail: 'Official TikTok authorization',
      mark: '♪',
      action: 'Coming soon',
      available: false,
    },
  ]

  return <div className="accounts-page">
    <div className="welcome-row">
      <div>
        <p className="eyebrow">YOUR SOCIAL CHANNELS</p>
        <h1>Connected accounts.</h1>
        <p className="muted">Connect each social account once. Manage all your channels from one place.</p>
      </div>
      <div className="status-pill pending-pill"><span /> 0 accounts connected</div>
    </div>
    <section className="accounts-intro card">
      <div className="accounts-intro-icon"><Link2 size={24} /></div>
      <div>
        <h2>One place for every platform</h2>
        <p className="muted small">Choose a platform below. You will authorize access on that platform's official sign-in page. FREE CROSSPOSTER will never ask you to share your social media password with us.</p>
      </div>
    </section>
    <div className="accounts-grid">
      {accounts.map(account => <article className="account-card card" key={account.id}>
        <div className="account-card-top">
          <span className={`platform-mark ${account.id}`}>{account.mark}</span>
          <span className={account.available ? 'account-status pending' : 'account-status soon'}>{account.available ? 'Not connected' : 'Coming soon'}</span>
        </div>
        <h2>{account.name}</h2>
        <p className="muted small">{account.description}</p>
        <p className="account-detail">{account.detail}</p>
        {account.available
          ? <button className="primary-btn full account-connect" type="button" onClick={onConnect} disabled={connectBusy}>{connectBusy ? 'Please wait…' : account.action} <ArrowUpRight size={16} /></button>
          : <button className="secondary-btn full account-connect" type="button" disabled>{account.action}</button>}
      </article>)}
    </div>
    {notice && <p className="notice">{notice}</p>}
    <p className="accounts-footnote"><ShieldCheck size={15} /> Your authorization tokens will be handled securely by the backend. You can disconnect an account at any time once account management is enabled.</p>
  </div>
}

function DraftRow({ post, getUrl }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let active = true
    if (post.media_path) getUrl(post.media_path).then(value => { if (active) setUrl(value) })
    return () => { active = false }
  }, [post.media_path])
  return <div className="draft-row">
    <div className="draft-thumb">{url && post.media_type === 'image' ? <img src={url} alt="Post media" /> : post.media_type === 'video' ? <Video size={19} /> : <ImagePlus size={19} />}</div>
    <div className="draft-info"><strong>{post.caption || 'Media-only post'}</strong><span>{new Date(post.created_at).toLocaleString()} · {post.media_type || 'No media'}</span></div>
    <span className="draft-status">{post.status}</span>
  </div>
}

function SetupMessage() {
  return <main className="center-screen"><div className="setup-card"><span className="brand-icon">FC</span><h1>Connect your Supabase project</h1><p className="muted">Create a local <code>.env</code> file using <code>.env.example</code>, then add your Supabase URL and publishable key.</p></div></main>
}
