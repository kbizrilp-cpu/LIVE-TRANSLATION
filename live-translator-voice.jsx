import { useState, useRef, useEffect, useCallback } from "react";

const LANGUAGES = [
  { code: "en", name: "English",  native: "English",  flag: "🇬🇧", rtl: false, bcp: "en-US",  tts: "en-US" },
  { code: "ar", name: "Arabic",   native: "العربية",  flag: "🇸🇦", rtl: true,  bcp: "ar-SA",  tts: "ar-SA" },
  { code: "zh", name: "Chinese",  native: "中文",      flag: "🇨🇳", rtl: false, bcp: "zh-CN",  tts: "zh-CN" },
  { code: "tr", name: "Turkish",  native: "Türkçe",   flag: "🇹🇷", rtl: false, bcp: "tr-TR",  tts: "tr-TR" },
  { code: "es", name: "Spanish",  native: "Español",  flag: "🇪🇸", rtl: false, bcp: "es-ES",  tts: "es-ES" },
  { code: "ko", name: "Korean",   native: "한국어",    flag: "🇰🇷", rtl: false, bcp: "ko-KR",  tts: "ko-KR" },
  { code: "fr", name: "French",   native: "Français", flag: "🇫🇷", rtl: false, bcp: "fr-FR",  tts: "fr-FR" },
];

function speak(text, lang) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang.tts;
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}

export default function App() {
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx]     = useState(1);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen,   setToOpen]   = useState(false);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [recording, setRecording] = useState(false);
  const [micError,  setMicError]  = useState("");

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const fromLang = LANGUAGES[fromIdx];
  const toLang   = LANGUAGES[toIdx];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setFromOpen(false); setToOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function swap() {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
    setMessages([]);
    setInput("");
  }

  function pickFrom(i) {
    if (i === toIdx) setToIdx(fromIdx);
    setFromIdx(i);
    setFromOpen(false);
    setMessages([]);
    setInput("");
  }

  function pickTo(i) {
    if (i === fromIdx) setFromIdx(toIdx);
    setToIdx(i);
    setToOpen(false);
    setMessages([]);
    setInput("");
  }

  const doTranslate = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    setInput("");
    setLoading(true);

    const id = Date.now();
    setMessages(prev => [...prev, { id, original: text, translation: null, error: null }]);

    const sys = `You are a professional interpreter. Translate the user's text from ${fromLang.name} to ${toLang.name}.
Return ONLY valid JSON, no markdown, no backticks:
{"translation":"translated text here"}
Preserve tone and intent. Be natural.`;

    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: sys,
          messages: [{ role: "user", content: text }]
        })
      });
      const data = await res.json();
      const raw  = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const translation = parsed.translation || "";
      setMessages(prev => prev.map(m => m.id === id ? { ...m, translation } : m));
      if (translation) speak(translation, toLang);
    } catch {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, error: "Translation failed." } : m));
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [fromLang, toLang, loading]);

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doTranslate(input); }
  }

  function startRecording() {
    setMicError("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMicError("Speech recognition not supported in this browser."); return; }
    const rec = new SR();
    rec.lang = fromLang.bcp;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setRecording(false);
      doTranslate(transcript);
    };
    rec.onerror = (e) => {
      setMicError(e.error === "not-allowed" ? "Microphone access denied." : "Could not hear you. Try again.");
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  // Dropdown component (inline, no portal needed)
  function Dropdown({ open, onToggle, selectedIdx, onPick, alignRight }) {
    const lang = LANGUAGES[selectedIdx];
    return (
      <div style={{ position: "relative", flex: 1 }} onMouseDown={e => e.stopPropagation()}>
        <button
          onClick={onToggle}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            background: open ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)",
            border: "1.5px solid rgba(255,255,255,0.18)",
            borderRadius: 12, padding: "10px 14px", cursor: "pointer",
            color: "#f0f4ff", fontFamily: "inherit", transition: "all 0.15s"
          }}
        >
          <span style={{ fontSize: 22 }}>{lang.flag}</span>
          <div style={{ textAlign: "left", flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>{lang.native}</div>
            <div style={{ fontSize: 10, opacity: 0.55, letterSpacing: "1px", marginTop: 2 }}>{lang.name.toUpperCase()}</div>
          </div>
          <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)",
            ...(alignRight ? { right: 0 } : { left: 0 }),
            width: 190,
            background: "#151b2e",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 14, overflow: "hidden", zIndex: 999,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)"
          }}>
            {LANGUAGES.map((l, i) => (
              <div
                key={l.code}
                onClick={() => onPick(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px", cursor: "pointer",
                  background: i === selectedIdx ? "rgba(99,179,237,0.18)" : "transparent",
                  borderLeft: i === selectedIdx ? "3px solid #63b3ed" : "3px solid transparent",
                  color: "#e2eaff", transition: "background 0.1s"
                }}
                onMouseEnter={e => { if (i !== selectedIdx) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { if (i !== selectedIdx) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 20 }}>{l.flag}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{l.native}</div>
                  <div style={{ fontSize: 10, opacity: 0.45 }}>{l.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #080d1a 0%, #0e1525 55%, #080d1a 100%)",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", color: "#e2eaff",
      position: "relative", overflow: "hidden"
    }}>
      {/* Subtle radial glow bg */}
      <div style={{
        position: "fixed", top: "-20%", left: "30%", width: "60vw", height: "60vw",
        borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(circle, rgba(56,139,253,0.06) 0%, transparent 70%)"
      }} />

      {/* ── HEADER ── */}
      <div style={{
        padding: "18px 20px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.025)",
        backdropFilter: "blur(10px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #388bfd, #1a5ccc)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            boxShadow: "0 4px 14px rgba(56,139,253,0.4)"
          }}>🌐</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#e8f0ff", letterSpacing: "-0.3px" }}>Live Interpreter</div>
            <div style={{ fontSize: 10, color: "#3d5070", letterSpacing: "1.5px" }}>VOICE · TEXT · 7 LANGUAGES</div>
          </div>
        </div>

        {/* Language pickers */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Dropdown open={fromOpen} onToggle={() => { setFromOpen(p => !p); setToOpen(false); }} selectedIdx={fromIdx} onPick={pickFrom} alignRight={false} />
          <button onClick={swap} style={{
            flexShrink: 0, width: 38, height: 38,
            background: "rgba(56,139,253,0.12)", border: "1px solid rgba(56,139,253,0.3)",
            borderRadius: 10, cursor: "pointer", color: "#388bfd", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s"
          }}>⇄</button>
          <Dropdown open={toOpen} onToggle={() => { setToOpen(p => !p); setFromOpen(false); }} selectedIdx={toIdx} onPick={pickTo} alignRight={true} />
        </div>
      </div>

      {/* ── COLUMN HEADERS ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        background: "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.05)"
      }}>
        {[{ lang: fromLang, color: "#388bfd" }, { lang: toLang, color: "#4ade80" }].map(({ lang, color }, i) => (
          <div key={i} style={{
            padding: "7px 16px", display: "flex", alignItems: "center", gap: 6,
            borderRight: i === 0 ? "1px solid rgba(255,255,255,0.05)" : "none"
          }}>
            <span style={{ fontSize: 13 }}>{lang.flag}</span>
            <span style={{ fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color, fontWeight: 600 }}>{lang.name}</span>
          </div>
        ))}
      </div>

      {/* ── MESSAGES ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0 8px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 50, marginBottom: 12 }}>{fromLang.flag} ⇄ {toLang.flag}</div>
            <p style={{ margin: 0, color: "#2d3f5f", fontSize: 14 }}>Type or tap the mic to speak in {fromLang.name}</p>
            <p style={{ margin: "6px 0 0", color: "#1e2d44", fontSize: 12 }}>Translation will be spoken aloud automatically</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={msg.id} style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            borderBottom: idx < messages.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.013)"
          }}>
            {/* Original */}
            <div style={{ padding: "15px 16px", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{
                margin: 0, fontSize: 15, lineHeight: 1.7, color: "#c8d8f0",
                direction: fromLang.rtl ? "rtl" : "ltr",
                textAlign: fromLang.rtl ? "right" : "left"
              }}>{msg.original}</p>
            </div>
            {/* Translation */}
            <div style={{ padding: "15px 16px", display: "flex", alignItems: "flex-start", gap: 8 }}>
              {msg.error ? (
                <p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>{msg.error}</p>
              ) : msg.translation ? (
                <>
                  <p style={{
                    margin: 0, flex: 1, fontSize: 15, lineHeight: 1.7, color: "#86efac",
                    direction: toLang.rtl ? "rtl" : "ltr",
                    textAlign: toLang.rtl ? "right" : "left"
                  }}>{msg.translation}</p>
                  <button
                    onClick={() => speak(msg.translation, toLang)}
                    title="Play audio"
                    style={{
                      flexShrink: 0, marginTop: 2, background: "rgba(74,222,128,0.1)",
                      border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8,
                      width: 28, height: 28, cursor: "pointer", color: "#4ade80",
                      fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center"
                    }}>🔊</button>
                </>
              ) : (
                <div style={{ display: "flex", gap: 5, alignItems: "center", paddingTop: 8 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: "50%", background: "#4ade80",
                      animation: "pulse 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`, opacity: 0.6
                    }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── INPUT BAR ── */}
      <div style={{
        padding: "12px 16px 20px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(10px)"
      }}>
        {micError && (
          <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8, textAlign: "center" }}>{micError}</div>
        )}

        <div style={{
          display: "flex", gap: 8, alignItems: "flex-end",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: 14, padding: "10px 12px"
        }}>
          {/* Mic button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            title={recording ? "Stop recording" : `Speak in ${fromLang.name}`}
            style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: 12,
              background: recording
                ? "linear-gradient(135deg, #ef4444, #b91c1c)"
                : "rgba(255,255,255,0.07)",
              border: recording ? "none" : "1px solid rgba(255,255,255,0.14)",
              cursor: "pointer", color: recording ? "#fff" : "#94a3b8",
              fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
              animation: recording ? "micPulse 1s ease-in-out infinite" : "none",
              boxShadow: recording ? "0 0 18px rgba(239,68,68,0.5)" : "none",
              transition: "all 0.2s"
            }}>🎤</button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={recording ? "Listening…" : `Type in ${fromLang.name}…`}
            rows={1}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#e2eaff", fontSize: 15, lineHeight: 1.6, resize: "none",
              fontFamily: "inherit", maxHeight: 120, overflowY: "auto",
              direction: fromLang.rtl ? "rtl" : "ltr"
            }}
            onInput={e => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />

          {/* Send button */}
          <button
            onClick={() => doTranslate(input)}
            disabled={!input.trim() || loading}
            style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: 12,
              background: input.trim() && !loading
                ? "linear-gradient(135deg, #388bfd, #1a5ccc)"
                : "rgba(255,255,255,0.05)",
              border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              color: "#fff", fontSize: 17,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: input.trim() && !loading ? "0 3px 14px rgba(56,139,253,0.4)" : "none",
              transition: "all 0.2s"
            }}>
            {loading ? "⟳" : "↑"}
          </button>
        </div>

        <p style={{ margin: "7px 0 0", fontSize: 11, color: "#1e2d44", textAlign: "center" }}>
          🎤 Tap mic to speak · Enter to send · 🔊 Tap speaker to replay
        </p>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.5);opacity:1} }
        @keyframes micPulse { 0%,100%{box-shadow:0 0 18px rgba(239,68,68,0.5)} 50%{box-shadow:0 0 28px rgba(239,68,68,0.9)} }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px}
        textarea::placeholder{color:#1e2d44}
      `}</style>
    </div>
  );
}
