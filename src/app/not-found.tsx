import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel login-panel">
      <h2>페이지를 찾을 수 없습니다</h2>
      <p>주소를 확인해주세요. 페이지가 없거나 접근 권한이 없을 수 있습니다.</p>
      <Link className="button-link" href="/handoffs">내 전달함으로</Link>
    </section>
  );
}
