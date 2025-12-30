import { useState } from "react";

export function Disclaimer() {
  const [show, setShow] = useState(true);
  const [hover, setHover] = useState(false);

  if (!show) return null;

  return (
    <div style={{
      background: "linear-gradient(90deg, #7c3aed 0%, #4c1d95 100%)",
      color: "white",
      padding: "10px 16px",
      fontSize: "13px",
      fontWeight: 500,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.1)"
    }}>
      <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <span style={{ background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>Disclaimer</span>
        <span>
          This model uses illustrative data and opinionated economic theories. It is <b>not</b> a verified security audit.
        </span>
      </span>
      <button
        onClick={() => setShow(false)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: hover ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.2)",
          border: "none",
          color: "white",
          borderRadius: "4px",
          padding: "4px 8px",
          cursor: "pointer",
          marginLeft: "16px",
          fontSize: "11px",
          fontWeight: 600,
          transition: "background 0.2s"
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

