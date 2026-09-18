  "use client";
  import { useState, useEffect, useCallback } from "react";
  import { useRouter } from "next/navigation";
  import Link from "next/link";
  import {
    Camera,
    LayoutDashboard,
    Image as ImageIcon,
    LogOut,
    ArrowUpRight,
    Download,
    Upload,
    LockKeyhole,
    Clock3,
    CheckCircle2,
    Heart,
    X,
    ChevronLeft,
    ChevronRight,
    Users,
    Settings2,
    Mail,
    AlertCircle,
    Trash2,
    ArrowRight,
  } from "lucide-react";
  import Auth, { api } from "./auth";
  import { Wordmark } from "./brand";
  export function formatDate(value, timezone = "Asia/Kolkata") {
    return value
      ? new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: timezone,
        }).format(new Date(value))
      : "To be announced";
  }
  function stateLabel(state) {
    return (
      {
        unconfigured: "Schedule to be announced",
        upcoming: "Opening soon",
        open: "Submissions are open",
        closed: "Submissions closed",
      }[state] || "Checking schedule"
    );
  }
  export function Portal({ mode = "dashboard" }) {
    const isAdmin = mode === "admin";
    const router = useRouter();
    const [auth, setAuth] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState(null);
    const [adminTab, setAdminTab] = useState("overview");
    const refreshEvent = useCallback(async () => {
      try {
        setEvent(await api("event"));
      } catch (e) {
        setError(e.message);
      }
    }, []);
    const load = useCallback(async () => {
      setLoading(true);
      setError("");
      try {
        const who = await api("me");
        if (isAdmin && who.role !== "admin") {
          setAuth(null);
        } else if (!isAdmin && who.role === "admin") {
          router.replace("/admin?view=dashboard");
        } else setAuth(who);
      } catch (e) {
        if (e.status === 401) {
          if (!isAdmin) router.replace("/login");
        } else setError(e.message);
      } finally {
        setLoading(false);
      }
    }, [isAdmin, router]);
    useEffect(() => {
      load();
      refreshEvent();
      const timer = setInterval(refreshEvent, 15000);
      return () => clearInterval(timer);
    }, [load, refreshEvent]);
    async function logout() {
      try {
        await api("auth/logout", { method: "POST" });
        window.location.assign("/");
      } catch (e) {
        setError(e.message);
      }
    }
    if (loading)
      return (
        <div className="loading-page">
          <Camera />
          <Wordmark />
          <p>Opening your OffFrame space…</p>
        </div>
      );
    if (!auth) {
      if (error)
        return (
          <div className="loading-page">
            <AlertCircle />
            <h1>We couldn’t connect.</h1>
            <p className="muted">{error}</p>
            <button className="button primary" onClick={load}>
              Try again
            </button>
            <Link href="/">Back to home</Link>
          </div>
        );
      return isAdmin ? (
        <Auth mode="admin" />
      ) : (
        <div className="loading-page">Taking you to sign in…</div>
      );
    }
    const name = auth.user?.name || "ADMIN";
    return (
      <div className="portal">
        <aside className="sidebar">
          <Link href="/" className="sidebar-brand">
            <img src="/assets/offframe-logo.png" alt="OffFrame" />
            <Wordmark />
          </Link>
          <p className="sidebar-label">
            {isAdmin ? "ORGANIZER SPACE" : "PARTICIPANT SPACE"}
          </p>
          <nav>
            {isAdmin ? (
              <>
                <button
                  className={
                    adminTab === "overview" ? "nav-item active" : "nav-item"
                  }
                  onClick={() => setAdminTab("overview")}
                >
                  <LayoutDashboard size={19} />
                  Overview
                </button>
                <button
                  className={
                    adminTab === "gallery" ? "nav-item active" : "nav-item"
                  }
                  onClick={() => setAdminTab("gallery")}
                >
                  <ImageIcon size={19} />
                  Admin gallery
                </button>
                <button
                  className={
                    adminTab === "settings" ? "nav-item active" : "nav-item"
                  }
                  onClick={() => setAdminTab("settings")}
                >
                  <Settings2 size={19} />
                  Event setup
                </button>
              </>
            ) : (
              <>
                <Link
                  className={`nav-item ${mode === "dashboard" ? "active" : ""}`}
                  href="/dashboard"
                >
                  <LayoutDashboard size={19} />
                  My dashboard
                </Link>
                <Link
                  className={`nav-item ${mode === "gallery" ? "active" : ""}`}
                  href="/gallery"
                >
                  <ImageIcon size={19} />
                  Community gallery
                  {event?.state !== "closed" && <LockKeyhole size={13} />}
                </Link>
              </>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className="college-mini">
              <img src="/assets/college-logo.png" alt="GCETTS" />
              <span>
                CSE · GCETTS
                <br />
                <small>Serampore</small>
              </span>
            </div>
            <button className="nav-item logout" onClick={logout}>
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        </aside>
        <div className="portal-body">
          <header className="portal-topbar">
            <span>Photography workshop & competition</span>
            <div className="account-chip">
              <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{name}</strong>
                <small>{isAdmin ? "Event administrator" : "Participant"}</small>
              </div>
            </div>
          </header>
          <main className="workspace">
            {error && (
              <div className="notice error" role="alert">
                {error}
                <button
                  className="text-button"
                  onClick={() => {
                    setError("");
                    refreshEvent();
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {isAdmin ? (
              <AdminContent
                tab={adminTab}
                setTab={setAdminTab}
                event={event}
                refreshEvent={refreshEvent}
              />
            ) : mode === "gallery" ? (
              <Gallery event={event} />
            ) : (
              <Dashboard user={auth.user} event={event} />
            )}
          </main>
          <div className="portal-footer">
            OffFrame · The Photography Club of CSE GCETTS
          </div>
        </div>
      </div>
    );
  }
  function Dashboard({ user, event }) {
    const [submission, setSubmission] = useState(null);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [ready, setReady] = useState(false);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [confirm, setConfirm] = useState(false);
    const reload = useCallback(async () => {
      const data = await api("submission");
      setSubmission(data.submission);
      setReady(true);
    }, []);
    useEffect(() => {
      reload().catch((e) => setError(e.message));
    }, [reload]);
    useEffect(() => {
      if (!file) {
        setPreview("");
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }, [file]);
    async function action(kind, fn) {
      setBusy(kind);
      setError("");
      setNotice("");
      try {
        await fn();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy("");
      }
    }
    async function upload(e) {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      await action("upload", async () => {
        await api("submission", { method: "POST", body: form });
        await reload();
        setFile(null);
        e.target.reset();
        setNotice(
          "Your draft is saved. Use Final Upload when you are ready to submit.",
        );
      });
    }
    const open = event?.state === "open";
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">MAKE EVERY FRAME COUNT</p>
            <h1>
              Hello, {user.name.split(" ")[0]}
              <span className="heading-dot">.</span>
            </h1>
            <p className="muted">
              Your perspective belongs here. Let’s make something memorable.
            </p>
          </div>
          <span className={`status-badge ${open ? "is-open" : ""}`}>
            <Clock3 size={15} />
            {stateLabel(event?.state)}
          </span>
        </div>
        <section className="about-panel">
          <div>
            <span className="eyebrow">ABOUT OFFFRAME</span>
            <h2>See beyond the ordinary.</h2>
            <p>
              OffFrame brings curious minds and creative eyes together through a
              photography workshop and competition. An initiative of the
              Photography Club of CSE, Government College of Engineering and
              Textile Technology, Serampore.
            </p>
            <p>
              Explore a new perspective, put your learning into practice, and
              share one photograph that tells your story.
            </p>
          </div>
          <div className="about-art">
            <img src="/assets/reel.png" alt="" />
            <Camera size={38} />
            <span>
              CAPTURE.
              <br />
              CREATE.
              <br />
              CAPTIVATE.
            </span>
          </div>
        </section>
        <div className="dashboard-grid">
          <section className="panel id-panel">
            <div className="section-heading">
              <span className="number-label">01 / YOUR PASS</span>
              <Camera size={19} />
            </div>
            <h2>Your participation ID</h2>
            <p className="muted">
              A little keepsake. Your name, your college, your place in OffFrame.
            </p>
            <div className="id-preview">
              <img
                src="/assets/id-template.png"
                alt="OffFrame participation ID template"
              />
              <span className="id-preview-label">
                PERSONALIZED WITH YOUR DETAILS
              </span>
            </div>
            <div className="profile-mini">
              <strong>{user.name}</strong>
              <span>{user.college}</span>
              <span>
                {user.year} · {user.branch}
              </span>
            </div>
            <button
              className="button secondary full"
              disabled={!!busy}
              onClick={() =>
                action("id", async () => {
                  const data = await api("id-card", { method: "POST" });
                  const link = document.createElement("a");
                  link.href = data.url;
                  link.download = "OffFrame-Participation-ID.png";
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  setNotice(
                    "Your participation ID is ready and saved to your profile.",
                  );
                })
              }
            >
              <Download size={18} />
              {busy === "id" ? "Creating your ID…" : "Download participation ID"}
            </button>
          </section>
          <section className="panel submission-panel">
            <div className="section-heading">
              <span className="number-label">02 / YOUR BEST FRAME</span>
              {submission?.final ? (
                <LockKeyhole size={19} />
              ) : (
                <Upload size={19} />
              )}
            </div>
            <h2>Your competition entry</h2>
            <div className="schedule-strip">
              <Clock3 size={17} />
              <div>
                <strong>{stateLabel(event?.state)}</strong>
                <span>
                  {event?.opensAt
                    ? `${formatDate(event.opensAt, event.timezone)} — ${formatDate(event.closesAt, event.timezone)}`
                    : "The event team will announce the upload window here."}
                </span>
                {event?.opensAt && <small>{event.timezone}</small>}
              </div>
            </div>
            {!ready && !error && <p className="muted">Loading your entry…</p>}
            {submission && (
              <div className="submission-preview">
                <img src={submission.imageUrl} alt={submission.title} />
                <div>
                  <strong>{submission.title}</strong>
                  <span
                    className={`status-badge ${submission.final ? "is-open" : ""}`}
                  >
                    {submission.final ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <ImageIcon size={14} />
                    )}
                    {submission.final ? "Final submission" : "Draft saved"}
                  </span>
                </div>
                {submission.caption && (
                  <p className="muted">{submission.caption}</p>
                )}
              </div>
            )}
            {submission?.final ? (
              <div className="lock-note">
                <LockKeyhole size={17} />
                <p>
                  Your frame is in. This entry is final and cannot be changed.{" "}
                  {event?.state === "closed"
                    ? "The community gallery is now open."
                    : "Come back after submissions close to explore the gallery."}
                </p>
              </div>
            ) : open ? (
              <form onSubmit={upload}>
                <label className="upload-zone">
                  <input
                    type="file"
                    name="image"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    disabled={!!busy}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {preview ? (
                    <img src={preview} alt="Selected photograph preview" />
                  ) : (
                    <Upload size={27} />
                  )}
                  <strong>
                    {file
                      ? file.name
                      : submission
                        ? "Choose a replacement photograph"
                        : "Choose your photograph"}
                  </strong>
                  <span>JPG, PNG or WebP · up to 10 MB · 25 megapixels</span>
                </label>
                <label>
                  Photo title
                  <input
                    name="title"
                    required
                    maxLength={100}
                    placeholder="Give your frame a name"
                    defaultValue={submission?.title || ""}
                  />
                </label>
                <label>
                  Caption <span className="optional">(optional)</span>
                  <textarea
                    name="caption"
                    maxLength={500}
                    placeholder="The story behind your shot"
                    defaultValue={submission?.caption || ""}
                  />
                </label>
                <p className="upload-hint">
                  Images are saved as PNG, up to 3,000 px on the longest side.
                  Uploading replaces your current draft.
                </p>
                <button className="button secondary" disabled={!!busy || !file}>
                  <Upload size={17} />
                  {busy === "upload" ? "Saving your photograph…" : "Upload image"}
                </button>
              </form>
            ) : (
              !submission && (
                <div className="empty-upload">
                  <LockKeyhole size={30} />
                  <h3>
                    {event?.state === "closed"
                      ? "The submission window has ended."
                      : "Your moment is coming."}
                  </h3>
                  <p>
                    {event?.state === "closed"
                      ? "No photograph was submitted from this account."
                      : "Upload your photograph when the event window opens."}
                  </p>
                </div>
              )
            )}
            {submission && !submission.final && open && (
              <div className="final-actions">
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() => setConfirm(true)}
                >
                  <CheckCircle2 size={17} />
                  Final Upload
                </button>
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() =>
                    action("delete", async () => {
                      await api("submission", { method: "DELETE" });
                      await reload();
                      setNotice(
                        "Your draft was deleted. You can upload a new image before the window closes.",
                      );
                    })
                  }
                >
                  <Trash2 size={16} />
                  Delete draft
                </button>
              </div>
            )}
            {submission && !submission.final && event?.state === "closed" && (
              <div className="notice error">
                This draft was not finalized before the deadline and will not
                appear in the gallery.
              </div>
            )}
          </section>
        </div>
        {(error || notice) && (
          <div
            className={`notice ${error ? "error" : "success"}`}
            role={error ? "alert" : "status"}
          >
            {error || notice}
          </div>
        )}
        <section className="gallery-banner">
          <div className="section-icon">
            <ImageIcon size={23} />
          </div>
          <div>
            <h3>A hundred eyes. A hundred stories.</h3>
            <p>
              {event?.state === "closed"
                ? "The gallery is open. Explore, appreciate, and download the community’s final frames."
                : "The community gallery opens after submissions close. Explore every final frame, leave a like, and find a little inspiration."}
            </p>
          </div>
          <Link className="button secondary" href="/gallery">
            {event?.state === "closed"
              ? "Explore gallery"
              : "View gallery status"}
            <ArrowUpRight size={17} />
          </Link>
        </section>
        {confirm && (
          <Modal
            title="Make this your final frame?"
            onClose={() => setConfirm(false)}
          >
            <p className="muted">
              “{submission.title}” will become your official entry. Once
              submitted, it cannot be deleted or replaced.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                disabled={!!busy}
                onClick={() => setConfirm(false)}
              >
                Keep editing
              </button>
              <button
                className="button primary"
                disabled={!!busy}
                onClick={() =>
                  action("final", async () => {
                    await api("submission/finalize", { method: "POST" });
                    await reload();
                    setConfirm(false);
                    setNotice("Your final entry has been submitted.");
                  })
                }
              >
                {busy === "final" ? "Submitting…" : "Confirm final submission"}
              </button>
            </div>
            {error && (
              <div role="alert" className="notice error">
                {error}
              </div>
            )}
          </Modal>
        )}
      </>
    );
  }
  function Modal({ title, onClose, children, wide = false }) {
    useEffect(() => {
      const prev = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');
      const controls = () =>
        [
          ...dialog.querySelectorAll(
            'button,a,input,select,textarea,[tabindex="0"]',
          ),
        ].filter((el) => !el.disabled);
      controls()[0]?.focus();
      const handle = (e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const list = controls();
          if (e.shiftKey && document.activeElement === list[0]) {
            e.preventDefault();
            list.at(-1)?.focus();
          } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
            e.preventDefault();
            list[0]?.focus();
          }
        }
      };
      const old = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handle);
      return () => {
        document.body.style.overflow = old;
        window.removeEventListener("keydown", handle);
        prev?.focus?.();
      };
    }, [onClose]);
    return (
      <div
        className="modal-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <section
          className={`modal ${wide ? "wide" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="modal-header">
            <h2>{title}</h2>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X />
            </button>
          </div>
          {children}
        </section>
      </div>
    );
  }
  function Gallery({ event, admin = false }) {
    const [items, setItems] = useState([]),
      [total, setTotal] = useState(0),
      [page, setPage] = useState(1),
      [loading, setLoading] = useState(true),
      [error, setError] = useState(""),
      [selected, setSelected] = useState(null),
      [liking, setLiking] = useState(null);
    const available = admin || event?.state === "closed";
    const load = useCallback(async () => {
      if (!available) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await api(`gallery?page=${page}`);
        setItems(data.items);
        setTotal(data.total);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, [available, page]);
    useEffect(() => {
      load();
    }, [load]);
    async function like(item) {
      setLiking(item.id);
      setError("");
      try {
        const data = await api(`likes/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({ liked: !item.liked }),
        });
        setItems((old) =>
          old.map((i) => (i.id === item.id ? { ...i, ...data } : i)),
        );
        if (selected?.id === item.id) setSelected((old) => ({ ...old, ...data }));
      } catch (e) {
        setError(e.message);
      } finally {
        setLiking(null);
      }
    }
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {admin ? "EVERY FINAL FRAME" : "THROUGH EACH OTHER’S EYES"}
            </p>
            <h1>
              {admin ? "Admin gallery" : "Community gallery"}
              <span className="heading-dot">.</span>
            </h1>
            <p className="muted">
              {admin
                ? "Explore the final entries and meet the photographers behind them."
                : "A collection of perspectives, captured by the OffFrame community."}
            </p>
          </div>
          {available && (
            <span className="status-badge">
              {total} final {total === 1 ? "frame" : "frames"}
            </span>
          )}
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button className="text-button" onClick={load}>
              Try again
            </button>
          </div>
        )}
        {!available ? (
          <section className="gallery-locked panel">
            <div className="large-icon">
              <LockKeyhole size={35} />
            </div>
            <p className="eyebrow">GOOD THINGS TAKE A LITTLE TIME</p>
            <h2>The gallery is still developing.</h2>
            <p>
              Every photograph deserves its moment. The community gallery will
              open once the submission window closes.
            </p>
            <div className="status-badge">
              <Clock3 size={16} />
              {event?.closesAt
                ? `Opens ${formatDate(event.closesAt, event.timezone)} (${event.timezone})`
                : "Opening time to be announced"}
            </div>
            <Link className="back-link" href="/dashboard">
              <ChevronLeft size={17} />
              Back to my dashboard
            </Link>
          </section>
        ) : loading ? (
          <div className="panel empty-state">Loading the latest frames…</div>
        ) : items.length === 0 ? (
          <section className="panel empty-state">
            <ImageIcon size={40} />
            <h2>No final frames yet.</h2>
            <p>
              {admin
                ? "Finalized entries will appear here as participants submit them."
                : "There are no final submissions to show."}
            </p>
            <button className="button secondary" onClick={load}>
              Refresh gallery
            </button>
          </section>
        ) : (
          <>
            <div className="gallery-grid">
              {items.map((item) => (
                <article className="photo-card" key={item.id}>
                  <button
                    className="photo-open"
                    onClick={() => setSelected(item)}
                    aria-label={`View ${item.title} by ${item.photographer.name}`}
                  >
                    <img src={item.imageUrl} alt={item.title} loading="lazy" />
                    <span>
                      <ArrowUpRight size={21} />
                    </span>
                  </button>
                  <div className="photo-info">
                    <button
                      className="photo-title"
                      onClick={() => setSelected(item)}
                    >
                      {item.title}
                    </button>
                    <p>{item.photographer.name}</p>
                    <div className="photo-bottom">
                      <span>
                        {item.photographer.branch} · {item.photographer.year}
                      </span>
                      <button
                        className={`like-button ${item.liked ? "liked" : ""}`}
                        aria-label={
                          item.liked ? "Unlike photograph" : "Like photograph"
                        }
                        aria-pressed={item.liked}
                        disabled={admin || liking === item.id}
                        onClick={() => like(item)}
                      >
                        <Heart
                          size={17}
                          fill={item.liked ? "currentColor" : "none"}
                        />
                        {item.likes}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {total > 24 && (
              <div className="pagination">
                <button
                  className="button secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={17} />
                  Previous
                </button>
                <span>
                  Page {page} of {Math.ceil(total / 24)}
                </span>
                <button
                  className="button secondary"
                  disabled={page * 24 >= total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </>
        )}
        {selected && (
          <Modal title={selected.title} wide onClose={() => setSelected(null)}>
            <div className="photo-detail">
              <img src={selected.imageUrl} alt={selected.title} />
              <div>
                <p className="eyebrow">BEHIND THE FRAME</p>
                <h3>{selected.photographer.name}</h3>
                {selected.caption && <p className="muted">{selected.caption}</p>}
                <dl>
                  <dt>College</dt>
                  <dd>{selected.photographer.college}</dd>
                  <dt>Year & branch</dt>
                  <dd>
                    {selected.photographer.year} · {selected.photographer.branch}
                  </dd>
                  <dt>Email</dt>
                  <dd>{selected.photographer.email}</dd>
                </dl>
                <div className="detail-actions">
                  {!admin && (
                    <button
                      className={`button secondary ${selected.liked ? "liked" : ""}`}
                      disabled={liking === selected.id}
                      onClick={() => like(selected)}
                    >
                      <Heart
                        size={17}
                        fill={selected.liked ? "currentColor" : "none"}
                      />
                      {selected.likes} {selected.likes === 1 ? "like" : "likes"}
                    </button>
                  )}
                  <a
                    className="button primary"
                    href={`${selected.imageUrl}?download=1`}
                    download
                  >
                    <Download size={17} />
                    Download PNG
                  </a>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </>
    );
  }
  function AdminContent({ tab, setTab, event, refreshEvent }) {
    const [stats, setStats] = useState(null),
      [error, setError] = useState(""),
      [message, setMessage] = useState(""),
      [busy, setBusy] = useState(false),
      [csv, setCsv] = useState("");
    const load = useCallback(async () => {
      try {
        setStats(await api("admin/stats"));
      } catch (e) {
        setError(e.message);
      }
    }, []);
    useEffect(() => {
      load();
    }, [load, tab]);
    async function save(e, path, transform) {
      e.preventDefault();
      setBusy(true);
      setError("");
      setMessage("");
      try {
        const body = transform(Object.fromEntries(new FormData(e.currentTarget)));
        const data = await api(path, {
          method: path.endsWith("schedule") ? "PUT" : "POST",
          body: JSON.stringify(body),
        });
        setMessage(
          path.endsWith("emails")
            ? `${data.added} emails added. ${data.existing} already on the list. ${data.invalid} invalid rows skipped.`
            : "The submission schedule has been saved.",
        );
        await load();
        await refreshEvent();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }
    if (tab === "gallery") return <Gallery admin event={event} />;
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {tab === "settings"
                ? "GET READY FOR THE EVENT"
                : "THE BIGGER PICTURE"}
            </p>
            <h1>
              {tab === "settings" ? "Event setup" : "Welcome, ADMIN"}
              <span className="heading-dot">.</span>
            </h1>
            <p className="muted">
              {tab === "settings"
                ? "Manage eligible participants and the submission schedule."
                : "Your event at a glance. Every participant, every final frame."}
            </p>
          </div>
          <span className="status-badge">
            <Clock3 size={15} />
            {stateLabel(event?.state)}
          </span>
        </div>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="notice success">
            {message}
          </div>
        )}
        {tab === "overview" ? (
          <>
            <div className="stats-grid">
              {[
                [Users, "Registered students", stats?.participants],
                [Mail, "Eligible emails", stats?.eligible],
                [CheckCircle2, "Final submissions", stats?.finals],
                [ImageIcon, "Saved drafts", stats?.drafts],
              ].map(([Icon, label, value]) => (
                <section className="stat-card" key={label}>
                  <Icon size={21} />
                  <strong>{value ?? "—"}</strong>
                  <span>{label}</span>
                </section>
              ))}
            </div>
            <div className="admin-overview-grid">
              <section className="panel">
                <span className="number-label">EVENT SCHEDULE</span>
                <h2>The submission window</h2>
                <dl className="schedule-list">
                  <div>
                    <dt>Opens</dt>
                    <dd>{formatDate(event?.opensAt, event?.timezone)}</dd>
                  </div>
                  <div>
                    <dt>Closes</dt>
                    <dd>{formatDate(event?.closesAt, event?.timezone)}</dd>
                  </div>
                  <div>
                    <dt>Time zone</dt>
                    <dd>{event?.timezone || "Asia/Kolkata"}</dd>
                  </div>
                </dl>
                <button
                  className="button secondary"
                  onClick={() => setTab("settings")}
                >
                  Manage event
                  <Settings2 size={17} />
                </button>
              </section>
              <section className="panel admin-gallery-callout">
                <ImageIcon size={37} />
                <h2>A room full of perspectives.</h2>
                <p className="muted">
                  Browse every final photograph, view participant details, and
                  download the original PNG submission.
                </p>
                <button
                  className="button primary"
                  onClick={() => setTab("gallery")}
                >
                  Open admin gallery
                  <ArrowUpRight size={17} />
                </button>
              </section>
            </div>
            {stats?.eligible === 0 && (
              <div className="notice">
                <strong>One step before registration opens:</strong> import the
                pre-registered email sheet from Event setup. Only listed emails
                can create a student account.
              </div>
            )}
          </>
        ) : (
          <div className="settings-grid">
            <section className="panel">
              <span className="number-label">01 / ELIGIBLE PARTICIPANTS</span>
              <h2>Import your email sheet</h2>
              <p className="muted">
                Export your sheet as a CSV with an <strong>Email</strong> column,
                or paste one email address per line. Existing emails are kept.
              </p>
              <form onSubmit={(e) => save(e, "admin/emails", () => ({ csv }))}>
                <label>
                  Choose CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1000000) {
                        setError("Use a CSV smaller than 1 MB.");
                        return;
                      }
                      setCsv(await file.text());
                    }}
                  />
                </label>
                <label>
                  Email list
                  <textarea
                    required
                    value={csv}
                    onChange={(e) => setCsv(e.target.value)}
                    placeholder={"Email\nstudent@college.edu"}
                    rows={7}
                  />
                </label>
                <button className="button primary" disabled={busy || !csv.trim()}>
                  <Upload size={17} />
                  {busy ? "Saving…" : "Import eligible emails"}
                </button>
              </form>
              <p className="upload-hint">
                Up to 10,000 rows per import. Duplicate emails are ignored.
              </p>
            </section>
            <section className="panel">
              <span className="number-label">02 / SUBMISSION WINDOW</span>
              <h2>Set the date & time</h2>
              <p className="muted">
                Enter local event times in India Standard Time. The window closes
                at the exact closing time. The schedule locks once it opens.
              </p>
              <form
                onSubmit={(e) =>
                  save(e, "admin/schedule", (values) => ({
                    opensAt: `${values.opensAt}:00+05:30`,
                    closesAt: `${values.closesAt}:00+05:30`,
                    timezone: "Asia/Kolkata",
                  }))
                }
              >
                <label>
                  Opening date & time (IST)
                  <input
                    name="opensAt"
                    type="datetime-local"
                    required
                    defaultValue={toIST(event?.opensAt)}
                  />
                </label>
                <label>
                  Closing date & time (IST)
                  <input
                    name="closesAt"
                    type="datetime-local"
                    required
                    defaultValue={toIST(event?.closesAt)}
                  />
</label>
                <button
                  className="button primary"
                  disabled={busy || ["open", "closed"].includes(event?.state)}
                >
                  <Clock3 size={17} />
                  {busy ? "Saving…" : "Save submission window"}
                </button>
              </form>
              <div className="lock-note">
                <LockKeyhole size={17} />
                <p>
                  Students can replace their draft during this window. Final
                  Upload permanently locks their entry. The community gallery
                  opens after the window closes.
                </p>
              </div>
            </section>
          </div>
        )}
      </>
    );
  }
  function toIST(value) {
    if (!value) return "";
    return new Date(+new Date(value) + 330 * 60000).toISOString().slice(0, 16);
  }
