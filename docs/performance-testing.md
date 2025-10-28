# Front‑End Performance and Memory Profiling Guide

This guide shows how to identify what parts of a JavaScript/TypeScript web app consume the most CPU or RAM, including how to measure when the app is "idle".

## Quick Checklist

- **Performance panel**: CPU timeline + flame chart; record 20–30s while idle.
- **Memory panel**: Heap snapshots and Allocation timeline; check for growth while idle.
- **Performance monitor**: Live JS heap, CPU, DOM nodes, FPS.
- **Browser Task Manager**: Per‑tab/process CPU and memory.
- **React DevTools Profiler**: Find components re‑rendering while idle.
- **Console CPU profile**: `console.profile('idle'); … console.profileEnd('idle');`

---

## 1) CPU: Chrome/Edge DevTools Performance Panel

- Open DevTools → Performance → Record.
- Leave the app idle for ~20–30 seconds, then Stop.
- Inspect:
  - **Main** thread flame chart: long or repeated stacks mean work is happening during idle.
  - **Bottom‑Up** / **Call Tree**: sort by Self Time to identify hot functions.
  - **Timings** / **Interactions**: timers or rAF loops.
  - **Summary**: time breakdown by Scripting, Rendering, Painting.

Tips:
- If the flame chart shows frequent `requestAnimationFrame`, `setInterval`, or observer callbacks during idle, consider gating them behind visibility/interaction, debouncing, or pausing when tabs are hidden.

### Console CPU profile (lightweight)

```js
console.profile('idle');
// Wait 20–30s without interacting
console.profileEnd('idle');
```
Open the recording in Performance to analyze stacks.

---

## 2) Memory: DevTools Memory Panel

Use it to find leaks and high allocation sources.

- **Heap Snapshot**
  - Take Snapshot A, wait idle 30–60s, take Snapshot B.
  - Compare retained sizes. If types/objects grow while idle, investigate their retainers.

- **Allocation instrumentation on timeline**
  - Start recording, leave idle, Stop.
  - Expand stacks to see which code allocated memory during idle.

Clues:
- Increasing **Detached HTMLDivElement** or listeners retained by closures signals leaks.
- Growing arrays/maps/sets in singletons or contexts often indicate polling/interval code.

---

## 3) Performance Monitor (Live HUD)

DevTools → More tools → Performance monitor.

- Watch **CPU usage**, **JS heap size**, **DOM nodes**, **JS event listeners**.
- Keep it open while idling on different tabs/screens.
- If heap grows steadily while idle, you likely have a leak.

---

## 4) Browser Task Manager

Chrome/Edge: Shift+Esc.

- Shows per‑tab/process **CPU**, **Memory footprint**, **JavaScript memory**, **GPU memory**.
- Sort by CPU; confirm that your tab is the offender before deep‑diving.

---

## 5) React DevTools Profiler (if using React)

- React DevTools → Profiler → Start profiling.
- Leave the app idle; Stop.
- Look for components that re‑rendered. Inspect "Why did this render?" and prop/state changes.

Remedies:
- Memoize computed props; narrow context providers; split large providers; use `React.memo`/`useMemo`/`useCallback` judiciously.

---

## 6) Profiling “Idle” Work Precisely

1. Record in Performance for 20–30s with no interaction.
2. Select the idle region in the timeline.
3. In Bottom‑Up, sort by Self Time and expand stacks to find periodic work while idle.
4. In Memory → Allocation timeline, confirm whether new objects are being created during idle.

Common culprits:
- `requestAnimationFrame` loops updating UI even when nothing changes.
- `setInterval`/`setTimeout` running frequent computations or DOM queries.
- `MutationObserver`/`ResizeObserver` firing continuously (e.g., layout thrash).
- Canvas/WebGL draw loops left running offscreen.
- Polling/fetch loops or websocket messages updating state.
- Animations/transitions with JS-driven updates.

---

## 7) Lightweight Instrumentation

Add minimal timing logs around suspected hotspots:

```ts
const t0 = performance.now();
// do work
const dt = performance.now() - t0;
if (dt > 8) console.log('Expensive tick', dt.toFixed(2), 'ms');
```

Mark periodic activity:

```ts
const interval = setInterval(() => performance.mark('idle-tick'), 1000);
// Check console + Performance marks to correlate with spikes
```

Detect hidden‑tab conditions:

```ts
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // pause animations/polling
  } else {
    // resume
  }
});
```

---

## 8) Measuring Network/Paint Impact

- **Network panel**: Look for polling or chatty endpoints during idle.
- **Rendering stats** in Performance: layout + paint costs; large style recalcs indicate thrash.
- **Screenshots lane** in Performance can correlate paints with state updates.

---

## 9) Methodology for a Repro Case

1. Define the scenario (e.g., open Manual tab, change a color, then idle 30s).
2. Record CPU (Performance) and Memory (Allocation timeline) once per scenario.
3. Save recordings with scenario names for comparison.
4. Fix one cause at a time; re‑record to confirm delta.

---

## 10) Preventative Engineering Practices

- **Debounce** UI sync and derived state updates (100–200 ms) to cut unnecessary renders.
- **Memoize** expensive computations and selectors; avoid broad dependency arrays.
- **Defer** heavy work with `requestIdleCallback` when appropriate.
- **Pause** animations/timers when offscreen or idle; gate by `document.hidden`.
- **Break up** large renders; prefer virtualization for big lists.
- **Audit** effects: ensure early returns if inputs haven’t changed.
- **Use Web Workers** for heavy pure computations.

---

## 11) What “Good” Looks Like While Idle

- Performance Monitor shows near‑zero CPU and flat JS heap.
- Performance recording has minimal Main‑thread activity (no repeating timers/rAF stacks).
- Allocation timeline shows negligible allocations.
- React Profiler shows zero renders.

---

## 12) Useful Links

- Chrome DevTools Performance: https://developer.chrome.com/docs/devtools/performance/reference
- Chrome DevTools Memory: https://developer.chrome.com/docs/devtools/memory-problems
- React Profiler: https://react.dev/learn/profiling-components
- Web Vitals & Lighthouse (lab checks): https://web.dev/

---

## Appendix: Quick Recipes

- **Record idle CPU**: Performance → Record 30s idle → Stop → Bottom‑Up by Self Time.
- **Check idle allocations**: Memory → Allocation timeline 30s → Stop → Expand stacks.
- **Watch live**: More tools → Performance monitor; and Chrome Task Manager.
- **Find re‑renders**: React Profiler idle session; check which components rendered.
- **Suspect timers**: In Sources search for `setInterval`, `requestAnimationFrame`, `observe`.
