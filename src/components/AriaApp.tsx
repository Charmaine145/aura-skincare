"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, ChevronDown, CircleAlert, Info, Leaf, Moon, Sprout, Sun, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { BRAND_IDS, BRANDS, brandById, DEFAULT_BRAND, type BrandId } from "@/data/brand";
import { useTheme } from "@/hooks/useTheme";
import { useVoiceCall, type Notice } from "@/hooks/useVoiceCall";
import { Conversation } from "./Conversation";
import { HowItWorks } from "./HowItWorks";
import { Stage } from "./Stage";
import { SummarySheet } from "./SummarySheet";
import { TestOrders } from "./TestOrders";
import { TraceDrawer } from "./TraceDrawer";

const NOTICE_ICON = { info: Info, warning: TriangleAlert, error: CircleAlert };

function Toast({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const Icon = notice ? NOTICE_ICON[notice.tone] : Info;
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.text}
          className={`toast ${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
          initial={{ opacity: 0, y: -16, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -12, x: "-50%" }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
        >
          <Icon size={17} aria-hidden />
          <span>{notice.text}</span>
          <button onClick={onDismiss} aria-label="Dismiss"><X size={15} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AriaApp() {
  const call = useVoiceCall();
  const brand = brandById(call.brand);
  const router = useRouter();
  // The brand lives in the URL (?brand=veda), so a link opens the right brand and the tab title follows.
  const chooseBrand = (id: BrandId) => {
    if (call.setBrand(id)) router.replace(id === DEFAULT_BRAND ? "/" : `/?brand=${id}`, { scroll: false });
  };
  const { theme, toggle } = useTheme();
  const [traceOpen, setTraceOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const tools = call.activity.filter(item => item.kind === "tool").length;

  // Present the summary as soon as it's ready.
  useEffect(() => {
    if (call.summary) setSummaryOpen(true);
  }, [call.summary]);

  const engine = !call.config ? "Connecting…" : call.config.mode === "demo" ? "Rule-based demo" : call.config.modelLabel;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden>
        <span className="blob one" />
        <span className="blob two" />
        <span className="blob three" />
      </div>

      <header className="topbar">
        {/* One agent, several brands: the picker only works between calls, since a call is bound to its brand. */}
        <label className={`brand ${call.phase === "idle" ? "" : "locked"}`} title={call.phase === "idle" ? "Switch brand" : "The brand is fixed for this call"}>
          <span className="brand-mark">{call.brand === "veda" ? <Sprout size={16} strokeWidth={1.8} /> : <Leaf size={16} strokeWidth={1.8} />}</span>
          <span className="brand-name">{brand.wordmark}</span>
          <ChevronDown size={14} className="brand-caret" aria-hidden />
          <select className="brand-select" aria-label="Brand" value={call.brand} disabled={call.phase !== "idle"} onChange={e => chooseBrand(e.target.value as BrandId)}>
            {BRAND_IDS.map(id => <option key={id} value={id}>{BRANDS[id].name}</option>)}
          </select>
        </label>
        <nav className="topbar-actions" aria-label="Tools">
          <span className={`engine ${call.config?.mode === "demo" ? "demo" : ""}`} title={call.config?.mode === "demo" ? "No API key configured: built-in rules cover the assessment scenarios." : `Conversation model: ${call.config?.model ?? ""}`}>
            <span className="engine-dot" /> <span className="engine-label">{engine}</span>
          </span>
          <button className="nav-btn" onClick={() => setTraceOpen(true)}>
            <Activity size={15} /> <span className="nav-label">Trace</span>
            {tools > 0 && <span className="count">{tools}</span>}
          </button>
          <button className="nav-btn" onClick={() => setHowOpen(true)}><span>How it works</span></button>
          <button className="icon-btn" onClick={toggle} aria-label={theme === "dark" ? "Light theme" : "Dark theme"}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </header>

      <main className="layout">
        <motion.div className="left" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <Stage call={call} />
          <TestOrders call={call} />
        </motion.div>
        <motion.div className="right" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
          <Conversation call={call} onShowSummary={() => setSummaryOpen(true)} />
        </motion.div>
      </main>

      <Toast notice={call.notice} onDismiss={call.dismissNotice} />
      <TraceDrawer call={call} open={traceOpen} onClose={() => setTraceOpen(false)} />
      <HowItWorks brand={brand} open={howOpen} onClose={() => setHowOpen(false)} />
      <SummarySheet call={call} open={summaryOpen} onClose={() => setSummaryOpen(false)} />
    </div>
  );
}
