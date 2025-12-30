import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { STORAGE_KEY } from "@domain/schema";

// Global error handler
window.addEventListener('error', (e) => {
  console.error('[DEBUG] Global error:', e.error, e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[DEBUG] Unhandled promise rejection:', e.reason);
});

// #region agent log
try {
  console.log('[DEBUG] main.tsx:8 Entry point started', {hasWindow:typeof window!=='undefined',hasDocument:typeof document!=='undefined'});
  fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.tsx:8',message:'Entry point started',data:{hasWindow:typeof window!=='undefined',hasDocument:typeof document!=='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch((e)=>console.error('[DEBUG] Fetch failed:',e));
} catch (e) { console.error('[DEBUG] main.tsx error:', e); }
// #endregion

try {
  const params = new URLSearchParams(window.location.search);
  if (params.has("reset")) {
    localStorage.removeItem(STORAGE_KEY);
  }
} catch {}

// #region agent log
try {
  const rootEl = document.getElementById("root");
  console.log('[DEBUG] main.tsx:20 Before ReactDOM.render', {rootExists:!!rootEl,rootId:rootEl?.id});
  fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.tsx:20',message:'Before ReactDOM.render',data:{rootExists:!!rootEl,rootId:rootEl?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch((e)=>console.error('[DEBUG] Fetch failed:',e));
} catch (e) { console.error('[DEBUG] main.tsx:20 error:', e); }
// #endregion

try {
  console.log('[DEBUG] main.tsx:38 Calling ReactDOM.createRoot...');
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found!");
  }
  console.log('[DEBUG] main.tsx:42 Root element found, creating React root...');
  const reactRoot = ReactDOM.createRoot(root);
  console.log('[DEBUG] main.tsx:44 React root created, rendering App...');
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // #region agent log
  console.log('[DEBUG] main.tsx:50 ReactDOM.render completed successfully');
  fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.tsx:50',message:'ReactDOM.render completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch((e)=>console.error('[DEBUG] Fetch failed:',e));
  // #endregion
} catch (err) {
  // #region agent log
  console.error('[DEBUG] main.tsx:53 ReactDOM.render ERROR', err);
  const rootEl = document.getElementById("root");
  if (rootEl) {
    rootEl.innerHTML = `<div style="padding:20px;color:red;font-family:monospace;"><h1>Error Loading App</h1><pre>${String(err)}</pre><pre>${(err as any)?.stack || 'No stack trace'}</pre></div>`;
  }
  fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.tsx:53',message:'ReactDOM.render ERROR',data:{error:String(err),errorName:(err as any)?.name,errorMessage:(err as any)?.message,errorStack:(err as any)?.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch((e)=>console.error('[DEBUG] Fetch failed:',e));
  // #endregion
  throw err;
}


