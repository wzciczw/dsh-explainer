/**
 * One stylesheet for the whole surface.
 *
 * It is injected once by `apply` and removed with the plugin fiber, so the
 * bundle needs no CSS loader and no global side effects after unload. Colors
 * ride the harness `--dsw-alias-*` variables: light and dark themes, and any
 * future palette change, follow automatically.
 */
export const STYLES = `
.dx-pill{position:fixed;z-index:1190;pointer-events:auto;display:inline-flex;align-items:center;gap:6px;
  padding:6px 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));
  background:var(--dsw-alias-bg-base,#1b1e23);color:var(--dsw-alias-label-primary,#e7e9ee);
  font-size:12.5px;line-height:1;cursor:pointer;user-select:none;
  box-shadow:0 8px 24px rgba(0,0,0,.35);animation:dx-rise .12s ease-out}
.dx-pill:hover{border-color:var(--dx-accent)}
.dx-pill .dx-spark{color:var(--dx-accent);font-size:13px}

.dx-card{--dx-accent:var(--dsw-alias-state-business-primary,#4a86ff);--dx-border:var(--dsw-alias-border-l2,rgba(255,255,255,.14));
  --dx-soft:var(--dsw-alias-bg-l2,rgba(255,255,255,.045));--dx-muted:var(--dsw-alias-label-secondary,#a3abb8);
  position:fixed;z-index:1200;pointer-events:auto;display:flex;flex-direction:column;
  width:min(440px,calc(100vw - 24px));overflow:hidden;font-size:13px;line-height:1.6;
  border:1px solid var(--dx-border);border-radius:12px;color:var(--dsw-alias-label-primary,#e7e9ee);
  background:var(--dsw-alias-bg-base,#1b1e23);box-shadow:0 18px 50px rgba(0,0,0,.45);
  animation:dx-pop .14s ease-out;outline:none}
.dx-card[data-dragging="true"]{user-select:none}
.dx-head{display:flex;align-items:center;gap:7px;padding:9px 10px 8px 12px;cursor:grab;
  border-bottom:1px solid var(--dx-border);flex:none}
.dx-head:active{cursor:grabbing}
.dx-title{font-size:12.5px;font-weight:600;letter-spacing:.01em;display:inline-flex;align-items:center;gap:6px}
.dx-title .dx-spark{color:var(--dx-accent)}
.dx-badge{font-size:11px;line-height:1;padding:3px 7px;border-radius:999px;border:1px solid var(--dx-border);
  color:var(--dx-muted);background:transparent}
.dx-badge[data-on="true"]{color:var(--dx-accent);border-color:var(--dx-accent);background:rgba(74,134,255,.1)}
button.dx-badge{cursor:pointer}
.dx-head .dx-grow{flex:1}
.dx-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;
  border:0;border-radius:6px;background:transparent;color:var(--dx-muted);cursor:pointer;font-size:13px;line-height:1}
.dx-icon:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff)}
.dx-icon[disabled]{opacity:.35;cursor:default}

.dx-quote{margin:8px 12px 0;padding:7px 10px;border-left:2px solid var(--dx-accent);border-radius:0 7px 7px 0;
  background:rgba(74,134,255,.1);color:var(--dx-muted);font-size:12px;line-height:1.55;white-space:pre-wrap;
  overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dx-quote[data-expanded="true"]{display:block;max-height:150px;overflow:auto;-webkit-line-clamp:unset}
.dx-link{font:inherit;font-size:11px;border:0;background:transparent;color:var(--dx-muted);cursor:pointer;padding:0}
.dx-link:hover{color:var(--dx-accent)}

.dx-body{flex:1;min-height:0;overflow-y:auto;padding:10px 12px 4px;overscroll-behavior:contain}
.dx-turn{display:flex;flex-direction:column;margin-bottom:10px}
.dx-turn[data-role="user"]{align-items:flex-end}
.dx-bubble{max-width:100%;border-radius:9px;padding:7px 10px;overflow-wrap:anywhere}
.dx-turn[data-role="user"] .dx-bubble{max-width:88%;background:var(--dx-soft);color:var(--dsw-alias-label-primary,#e7e9ee)}
.dx-turn[data-role="assistant"] .dx-bubble{background:transparent;padding:0 2px}
.dx-turn[data-role="assistant"] .dx-bubble[data-error="true"]{color:var(--dsw-alias-state-error-primary,#f85149);font-size:12.5px}
.dx-cursor{display:inline-block;width:6px;height:13px;margin-left:2px;vertical-align:-2px;border-radius:1px;
  background:var(--dx-accent);animation:dx-blink 1s steps(1) infinite}
.dx-turn-actions{display:flex;gap:4px;margin-top:6px;opacity:0;transition:opacity .12s}
.dx-turn:hover .dx-turn-actions,.dx-turn[data-active="true"] .dx-turn-actions{opacity:1}
.dx-mini{font:inherit;font-size:11px;line-height:1;padding:4px 7px;border-radius:6px;cursor:pointer;
  border:1px solid var(--dx-border);background:transparent;color:var(--dx-muted)}
.dx-mini:hover{color:var(--dsw-alias-label-primary,#fff);border-color:var(--dx-accent)}
.dx-mini[disabled]{opacity:.35;cursor:default}

.dx-presets{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0}
.dx-chip{font:inherit;font-size:12px;padding:4px 9px;border-radius:999px;cursor:pointer;
  border:1px solid var(--dx-border);background:transparent;color:var(--dx-muted)}
.dx-chip:hover{border-color:var(--dx-accent);color:var(--dsw-alias-label-primary,#fff);background:rgba(74,134,255,.1)}

.dx-compose{flex:none;border-top:1px solid var(--dx-border);padding:8px 10px 8px 12px;display:flex;align-items:flex-end;gap:8px}
.dx-input{flex:1;min-height:36px;max-height:132px;resize:none;border:0;outline:none;background:transparent;
  color:var(--dsw-alias-label-primary,#e7e9ee);font:inherit;font-size:13px;line-height:1.55;padding:6px 0}
.dx-input::placeholder{color:var(--dx-muted);opacity:.8}
.dx-send{flex:none;width:30px;height:30px;border-radius:8px;border:1px solid var(--dx-accent);background:var(--dx-accent);
  color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;transition:filter .12s}
.dx-send:hover{filter:brightness(1.08)}
.dx-send[disabled]{opacity:.4;cursor:default;filter:none}
.dx-send[data-mode="stop"]{background:transparent;color:var(--dsw-alias-state-error-primary,#f85149);border-color:var(--dsw-alias-state-error-primary,#f85149)}

.dx-meta{flex:none;display:flex;gap:8px;align-items:center;padding:0 12px 8px;font-size:10.5px;color:var(--dx-muted)}
.dx-meta .dx-dot{opacity:.5}


.dx-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:1300;pointer-events:none;
  padding:7px 13px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));
  background:var(--dsw-alias-bg-base,#1b1e23);color:var(--dsw-alias-label-primary,#e7e9ee);font-size:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.35);animation:dx-rise .14s ease-out}

.dx-md{font-size:13px;line-height:1.68}
.dx-md p{margin:0 0 7px}.dx-md p:last-child{margin-bottom:0}
.dx-md strong{font-weight:600;color:var(--dsw-alias-label-primary,#fff)}
.dx-md em{font-style:italic}
.dx-md ul,.dx-md ol{margin:4px 0 8px;padding-left:18px}
.dx-md li{margin:2px 0}
.dx-md code{font-family:var(--dx-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;
  background:var(--dx-soft);padding:1px 5px;border-radius:4px}
.dx-md pre{margin:7px 0;padding:8px 10px;border-radius:8px;border:1px solid var(--dx-border);background:var(--dx-soft);
  overflow:auto;font-family:var(--dx-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;line-height:1.55}
.dx-md pre code{background:none;padding:0;font-size:inherit}
.dx-md h1,.dx-md h2,.dx-md h3{font-size:13px;margin:8px 0 5px;font-weight:600}
.dx-md blockquote{margin:6px 0;padding-left:9px;border-left:2px solid var(--dx-border);color:var(--dx-muted)}
.dx-md a{color:var(--dx-accent);text-decoration:none}
.dx-md a:hover{text-decoration:underline}

.dx-model{max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.75}

.dx-launcher{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12px;line-height:1;
  padding:5px 9px;border-radius:7px;cursor:pointer;border:1px solid transparent;background:transparent;
  color:var(--dsw-alias-label-secondary,#a3abb8)}
.dx-launcher:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#fff)}
.dx-launcher .dx-spark{color:var(--dx-accent)}

@keyframes dx-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes dx-pop{from{opacity:0;transform:translateY(5px) scale(.99)}to{opacity:1;transform:none}}
@keyframes dx-blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){
  .dx-pill,.dx-card,.dx-toast{animation:none}
  .dx-cursor{animation:none}
  .dx-turn-actions{transition:none}
}
`