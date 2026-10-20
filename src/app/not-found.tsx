import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel login-panel">
      <p className="eyebrow">페이지를 찾을 수 없어요</p>
      <h2>주소를 다시 확인해주세요.</h2>
      <p>주소가 바뀌었거나 접근할 수 없는 페이지일 수 있습니다.</p>
      <Link className="button-link" href="/handoffs">내 전달함으로</Link>
    </section>
  );
}
