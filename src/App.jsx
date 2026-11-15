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
    setConnectBusy(true)
    setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-start', { body: {} })
      if (error) throw error
      if (!data?.url) throw new Error('Meta did not return a login URL. Please try again.')
      window.location.assign(data.url)
    } catch (error) {
      setNotice(error.message || 'Could not start Instagram connection.')
      setConnectBusy(false)
    }
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
        <button className={activeView === 'instagram' ? 'active' : ''} onClick={() => setActiveView('instagram')}><Instagram size={15} /> Instagram & Shop setup</button>
      </nav>
      <div className="dashboard-content">
        {activeView === 'instagram' ? <InstagramSetup onConnect={connectInstagram} connectBusy={connectBusy} notice={notice} /> : <>
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

function InstagramSetup({ onConnect, connectBusy, notice }) {
  const steps = [
    { title: 'Switch Instagram to a professional account', detail: 'Use a Business or Creator account. Personal accounts cannot use the Instagram professional publishing APIs.', link: 'https://www.instagram.com/accounts/convert_to_professional_account/', label: 'Open Instagram settings' },
    { title: 'Connect Instagram to a Facebook Page', detail: 'For the Facebook Login API route and many Commerce setups, connect the Instagram account to the correct Facebook Page. The newer Instagram Login API can publish without a linked Page, so this is not required for every publishing connection.', link: 'https://business.facebook.com/latest/settings/business_assets', label: 'Open business assets' },
    { title: 'Set up your Meta business portfolio', detail: 'Make sure you have full control of the correct business portfolio and assign the Instagram account, Page (if used), catalog and app assets as needed.', link: 'https://business.facebook.com/settings', label: 'Open business settings' },
    { title: 'Create or connect a product catalog', detail: 'For Instagram Shop and product tagging, connect a catalog in Commerce Manager. This is separate from granting a crossposting app permission to publish ordinary posts.', link: 'https://www.facebook.com/commerce_manager', label: 'Open Commerce Manager' },
    { title: 'Review Instagram Shopping eligibility', detail: 'Check country availability before spending time on setup. If your business is in Rwanda, Instagram Shop/product-tagging availability may be restricted; confirm the current decision inside Commerce Manager. Meta makes the final eligibility decision.', link: 'https://www.facebook.com/business/help/2347002662267537', label: 'Read eligibility requirements' },
    { title: 'Authorize the app when its Meta connection is ready', detail: "The app will use Meta's official Instagram Login OAuth flow and request only the permissions needed for publishing. Never give your Instagram password to a third-party app; approve access only on an official Meta page.", link: 'https://developers.facebook.com/apps/', label: 'Open Meta for Developers' },
  ]
  return <div className="ig-setup-page">
    <div className="welcome-row"><div><p className="eyebrow">META BUSINESS CONNECTION</p><h1>Set up Instagram.</h1><p className="muted">Prepare your professional account, business assets, catalog and app permissions in the right order.</p></div><div className="status-pill pending-pill"><span /> Setup guide · not connected</div></div>
    <section className="ig-hero card"><div className="ig-hero-icon"><Instagram size={27} /></div><div><p className="eyebrow">INSTAGRAM PROFESSIONAL</p><h2>Connect the account you want to publish from</h2><p className="muted small">FREE CROSSPOSTER does not have Meta OAuth credentials or an approved publishing connection yet. This page helps you prepare the account; it does not claim that your account or shop is connected.</p></div><button className="primary-btn ig-connect-btn" type="button" onClick={onConnect} disabled={connectBusy}>{connectBusy ? 'Opening Meta login…' : 'Connect Instagram'} <ArrowUpRight size={16} /></button></section>{notice && <p className="notice">{notice}</p>}
    <div className="ig-setup-grid">
      <section className="card ig-checklist"><div className="section-heading"><div><h2>Instagram setup checklist</h2><p className="muted small">Complete these steps in Meta. Your changes are made in their official tools.</p></div><span className="step-label">ACCOUNT SETUP</span></div>
        {steps.map((step, i) => <article className="ig-step" key={step.title}><div className="ig-step-number">{String(i + 1).padStart(2, '0')}</div><div className="ig-step-copy"><h3>{step.title}</h3><p className="muted small">{step.detail}</p><a href={step.link} target="_blank" rel="noreferrer">{step.label} <ExternalLink size={13} /></a></div></article>)}
      </section>
      <aside className="side-column">
        <section className="card status-card"><div className="section-heading"><div><h2>What you can connect</h2><p className="muted small">The full Meta setup includes these assets.</p></div></div>
          <div className="asset-row"><Instagram /><div><strong>Instagram professional account</strong><span>Business or Creator</span></div><b>Not connected</b></div>
          <div className="asset-row"><Facebook /><div><strong>Facebook Page</strong><span>Linked business Page</span></div><b>Not connected</b></div>
          <div className="asset-row"><Store /><div><strong>Commerce catalog / Shop</strong><span>Products and shopping eligibility</span></div><b>Not connected</b></div>
          <div className="asset-row"><Link2 /><div><strong>Meta app authorization</strong><span>OAuth permissions for publishing</span></div><b>Not connected</b></div>
        </section>
        <section className="card meta-note"><ShieldCheck size={21} /><h3>Keep your account safe</h3><p className="muted small">Only sign in on instagram.com or facebook.com. Do not paste passwords, access tokens or secret keys into this dashboard or GitHub.</p></section>
        <section className="card meta-note"><h3>Important about Instagram Shop</h3><p className="muted small">Connecting a shop is separate from connecting an account for posting. Shop availability, product tagging and checkout features depend on Meta's current country, commerce and account eligibility rules.</p><a href="https://www.facebook.com/business/help/2347002662267537" target="_blank" rel="noreferrer">Check Meta requirements <ExternalLink size={13} /></a></section>
      </aside>
    </div>
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
