const { useCallback, useEffect, useRef, useState } = React;

    // VPData may be injected after this page starts. Wait briefly for it instead
    // of failing immediately when a visitor submits during initialization.
    async function waitForVPData(method, timeoutMs = 10000) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const api = window.VPData;
        if (api && typeof api[method] === "function") return api;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("The guestbook service is taking longer than expected to load.");
    }

    function formatDate(value) {
      if (!value) return "Date unavailable";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Date unavailable";
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(date);
    }

    function Guestbook() {
      const [entries, setEntries] = useState([]);
      const [listState, setListState] = useState("idle");
      const [name, setName] = useState("");
      const [message, setMessage] = useState("");
      const [errors, setErrors] = useState({});
      const [submitState, setSubmitState] = useState("idle");
      const [confirmation, setConfirmation] = useState("");
      const [touched, setTouched] = useState({});
      const submitLock = useRef(false);
      const confirmTimer = useRef(null);

      const loadEntries = useCallback(async () => {
        setListState("loading");
        try {
          const api = await waitForVPData("list");
          const rows = await api.list("entries");
          const normalized = (Array.isArray(rows) ? rows : []).map((row) => ({
            id: row && row.id != null ? String(row.id) : "",
            ...(row && row.data && typeof row.data === "object" ? row.data : {})
          }));
          normalized.sort((a, b) => {
            const ta = new Date(a.createdAt || 0).getTime();
            const tb = new Date(b.createdAt || 0).getTime();
            return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
          });
          setEntries(normalized);
          setListState("ready");
          return true;
        } catch (error) {
          console.error("Could not load guestbook entries:", error);
          setListState("error");
          return false;
        }
      }, []);

      useEffect(() => {
        loadEntries();
        return () => clearTimeout(confirmTimer.current);
      }, [loadEntries]);

      const validate = (field, rawValue) => {
        const value = rawValue.trim();
        if (!value) return field === "name"
          ? "Please enter your name."
          : "Please write a message.";
        if (field === "name" && value.length > 40) return "Name must be 40 characters or fewer.";
        if (field === "message" && value.length > 500) return "Message must be 500 characters or fewer.";
        return "";
      };

      const validateAll = () => {
        const next = {
          name: validate("name", name),
          message: validate("message", message)
        };
        setErrors(next);
        setTouched({ name: true, message: true });
        return !next.name && !next.message;
      };

      const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitLock.current) return;
        if (!validateAll()) return;

        const cleanName = name.trim();
        const cleanMessage = message.trim();
        submitLock.current = true;
        setSubmitState("saving");
        setConfirmation("");

        try {
          const api = await waitForVPData("add");
          await api.add("entries", {
            name: cleanName,
            message: cleanMessage,
            createdAt: new Date().toISOString()
          });

          setName("");
          setMessage("");
          setErrors({});
          setTouched({});
          setSubmitState("idle");
          setConfirmation("Your message has been added. Thank you for stopping by!");
          clearTimeout(confirmTimer.current);
          confirmTimer.current = setTimeout(() => setConfirmation(""), 5000);

          // Refresh independently: a temporary list failure should not report a
          // successfully saved message as a failed submission.
          await loadEntries();
        } catch (error) {
          console.error("Could not submit guestbook entry:", error);
          setSubmitState("error");
        } finally {
          submitLock.current = false;
        }
      };

      const updateField = (field, value) => {
        if (field === "name") setName(value);
        else setMessage(value);
        setSubmitState((current) => current === "error" ? "idle" : current);
        if (touched[field]) {
          setErrors((current) => ({ ...current, [field]: validate(field, value) }));
        }
      };

      const fieldError = (field) => touched[field] ? errors[field] : "";

      return (
        <main className="min-h-screen px-4 py-10 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-2xl">
            <header className="mb-8 text-center sm:mb-10">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7eee8] text-accent" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                  <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 11.5h.01M12.5 11.5h.01M17 11.5h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">A little corner of the internet</p>
              <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Kindred guestbook</h1>
              <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted">
                Leave a note, share a thought, or simply say hello. We’re glad you’re here.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3.5 py-1.5 text-sm text-muted">
                <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true"></span>
                <span><strong className="font-semibold text-ink">{entries.length}</strong> {entries.length === 1 ? "message" : "messages"}</span>
              </div>
            </header>

            <section aria-labelledby="leave-note-heading" className="mb-8 rounded-3xl border border-line bg-white p-5 shadow-[0_8px_30px_rgba(38,51,46,0.04)] sm:p-7">
              <div className="mb-5">
                <h2 id="leave-note-heading" className="text-xl font-semibold tracking-tight">Leave a note</h2>
                <p className="mt-1 text-sm leading-6 text-muted">Your words will be shared with everyone who visits.</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <label htmlFor="guest-name" className="text-sm font-semibold text-ink">Your name <span className="text-accent" aria-hidden="true">*</span></label>
                    <span className="text-xs text-muted">{name.length}/40</span>
                  </div>
                  <input
                    id="guest-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={40}
                    value={name}
                    onChange={(event) => updateField("name", event.target.value)}
                    onBlur={() => {
                      setTouched((current) => ({ ...current, name: true }));
                      setErrors((current) => ({ ...current, name: validate("name", name) }));
                    }}
                    aria-required="true"
                    aria-invalid={Boolean(fieldError("name"))}
                    aria-describedby={fieldError("name") ? "name-error name-count" : "name-count"}
                    placeholder="What should we call you?"
                    className="w-full rounded-xl border border-[#dcded7] bg-[#fcfcfa] px-4 py-3 text-[16px] text-ink placeholder:text-[#9aa29c] transition focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/15"
                  />
                  {fieldError("name") && <p id="name-error" className="mt-1.5 text-sm text-red-700" role="alert">{fieldError("name")}</p>}
                  <span id="name-count" className="sr-only">{name.length} of 40 characters</span>
                </div>

                <div className="mb-5">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <label htmlFor="guest-message" className="text-sm font-semibold text-ink">Your message <span className="text-accent" aria-hidden="true">*</span></label>
                    <span className="text-xs text-muted">{message.length}/500</span>
                  </div>
                  <textarea
                    id="guest-message"
                    name="message"
                    rows="4"
                    maxLength={500}
                    value={message}
                    onChange={(event) => updateField("message", event.target.value)}
                    onBlur={() => {
                      setTouched((current) => ({ ...current, message: true }));
                      setErrors((current) => ({ ...current, message: validate("message", message) }));
                    }}
                    aria-required="true"
                    aria-invalid={Boolean(fieldError("message"))}
                    aria-describedby={fieldError("message") ? "message-error message-count" : "message-count"}
                    placeholder="Write something kind..."
                    className="w-full resize-y rounded-xl border border-[#dcded7] bg-[#fcfcfa] px-4 py-3 text-[16px] leading-6 text-ink placeholder:text-[#9aa29c] transition focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/15"
                  />
                  {fieldError("message") && <p id="message-error" className="mt-1.5 text-sm text-red-700" role="alert">{fieldError("message")}</p>}
                  <span id="message-count" className="sr-only">{message.length} of 500 characters</span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    disabled={submitState === "saving"}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {submitState === "saving" ? (
                      <>
                        <svg className="spinner h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3"/>
                          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        Sending…
                      </>
                    ) : "Sign the guestbook"}
                  </button>
                  <div className="min-h-5 text-sm" aria-live="polite">
                    {confirmation && <p className="text-accent-dark">{confirmation}</p>}
                    {submitState === "error" && <p className="text-red-700" role="alert">Your message couldn’t be sent. Please try again.</p>}
                  </div>
                </div>
              </form>
            </section>

            <section aria-labelledby="messages-heading">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="messages-heading" className="text-xl font-semibold tracking-tight">Messages from visitors</h2>
                {entries.length > 0 && <span className="text-sm text-muted">{entries.length} total</span>}
              </div>

              {listState === "loading" && (
                <div className="rounded-2xl border border-line bg-white px-5 py-8 text-center" role="status" aria-live="polite">
                  <svg className="spinner mx-auto h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3"/>
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  <p className="mt-3 text-sm text-muted">Gathering the kind words…</p>
                </div>
              )}

              {listState === "error" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center" role="alert">
                  <p className="font-medium text-red-900">We couldn’t load the guestbook right now.</p>
                  <p className="mt-1 text-sm text-red-800">Please check your connection and try again.</p>
                  <button type="button" onClick={loadEntries} className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-900 transition hover:bg-red-100">
                    Try again
                  </button>
                </div>
              )}

              {listState === "ready" && entries.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#d6d8cf] bg-white/60 px-5 py-10 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#e7eee8] text-accent" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                      <path d="M7 8h10M7 12h6m-9 9 3.5-3H17a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v14Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="mt-3 font-semibold text-ink">The page is yours to begin.</p>
                  <p className="mt-1 text-sm leading-6 text-muted">There are no messages yet. Leave the first little hello above.</p>
                </div>
              )}

              {listState === "ready" && entries.length > 0 && (
                <ul className="space-y-3" aria-label="Guestbook entries">
                  {entries.map((entry, index) => (
                    <li key={entry.id || `${entry.createdAt || "entry"}-${index}`} className="rounded-2xl border border-line bg-white px-5 py-5 shadow-[0_3px_14px_rgba(38,51,46,0.025)] sm:px-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="font-semibold text-ink">{entry.name || "Guest"}</h3>
                        <time className="text-xs text-muted sm:text-sm" dateTime={entry.createdAt || undefined}>{formatDate(entry.createdAt)}</time>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-7 text-[#47554d]">{entry.message || ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <footer className="pb-2 pt-8 text-center text-xs text-muted">
              A small space for kind words, shared with everyone.
            </footer>
          </div>
        </main>
      );
    }

export default App;
