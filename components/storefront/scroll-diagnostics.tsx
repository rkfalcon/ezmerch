"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getMode = () => new URLSearchParams(window.location.search).get("scrollDebug");

// Opt-in, read-only device diagnostics. No data is sent to a server.
export function ScrollDiagnostics() {
  const mode = useSyncExternalStore(subscribe, getMode, () => null);
  const [report, setReport] = useState("");

  const read = () => {
    const viewport = window.visualViewport;
      const html = document.documentElement;
      const body = document.body;
      const logo = document.querySelector('main section img');
      const round = (n: number | undefined) => n === undefined ? "-" : Math.round(n);
      const style = (el: Element) => {
        const s = getComputedStyle(el);
        return `${s.position}/${s.overflowY}`;
      };
      setReport([
        mode === "2" ? "SCROLL SNAPSHOT v2 (before display)" : "SCROLL CHECK v1",
        `window Y ${round(window.scrollY)} | html ${round(html.scrollTop)} | body ${round(body.scrollTop)}`,
        `viewport top ${round(viewport?.offsetTop)} | page ${round(viewport?.pageTop)}`,
        `height ${round(window.innerHeight)} / ${round(viewport?.height)} | scale ${viewport?.scale.toFixed(2) ?? "-"}`,
        `logo top ${round(logo?.getBoundingClientRect().top)} | body top ${round(body.getBoundingClientRect().top)}`,
        `html ${style(html)} | body ${style(body)}`,
        `scroll root ${document.scrollingElement?.tagName ?? "-"}`,
      ].join("\n"));
    };
  useEffect(() => {
    if (mode !== "1") return;
    let frame = 0;
    const viewport = window.visualViewport;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(read);
    };
    schedule();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("touchend", schedule);
    viewport?.addEventListener("scroll", schedule);
    viewport?.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("touchend", schedule);
      viewport?.removeEventListener("scroll", schedule);
      viewport?.removeEventListener("resize", schedule);
    };
  }, [mode]);

  if (mode === "2" && !report) return <button type="button" onClick={read} style={{ position: "absolute", right: 8, top: 65, background: "#111", color: "#fff", font: "12px monospace", padding: "6px 8px", borderRadius: 4 }}>Capture scroll</button>;
  if (!report) return null;
  return <pre style={{ position: "fixed", bottom: 64, left: 8, right: 8, zIndex: 100, pointerEvents: "none", margin: 0, padding: 8, background: "#111", color: "#fff", font: "11px/1.5 monospace", whiteSpace: "pre-wrap", border: "1px solid #fff", borderRadius: 6 }}>{report}</pre>;
}
