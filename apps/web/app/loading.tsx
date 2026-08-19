export default function Loading() {
  return (
    <main className="route-loading shell">
      <section
        aria-atomic="true"
        aria-busy="true"
        aria-live="polite"
        className="panel route-loading__panel"
        role="status"
      >
        <span aria-hidden="true" className="route-loading__spinner" />
        <div>
          <p className="eyebrow">Page transition</p>
          <h1>관제 화면 불러오는 중</h1>
          <p>선택한 메뉴로 이동하고 있습니다.</p>
        </div>
      </section>
    </main>
  );
}
