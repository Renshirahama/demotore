export default function LineLinkPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#f6f7f9",
      color: "#111827",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif",
      padding: "40px 20px",
    }}>
      <section style={{
        maxWidth: 520,
        margin: "0 auto",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 24,
      }}>
        <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>LINE連携</h1>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "#374151" }}>
          LINE連携コードを発行するには、ログイン後にもう一度このページを開いてください。
        </p>
        <a
          href="/api/line/link"
          style={{
            display: "block",
            marginTop: 18,
            padding: "13px 16px",
            borderRadius: 8,
            background: "#06c755",
            color: "#fff",
            textAlign: "center",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          連携コードを発行する
        </a>
      </section>
    </main>
  );
}
