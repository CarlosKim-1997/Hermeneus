"use client";

import Link from "next/link";
import { useState } from "react";
import { UiIcon } from "./ui-icon";
import { formatDateUtc } from "./ui-dates";
import type { CreatorHandoffSummary } from "../../handoff/creator-handoff-summary.js";

export function HandoffLibrary({ handoffs }: { handoffs: readonly CreatorHandoffSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const publishedCount = handoffs.filter((handoff) => handoff.latestPublishedVersion !== undefined).length;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleHandoffs = handoffs.filter((handoff) => {
    const published = handoff.latestPublishedVersion !== undefined;
    return (filter === "all" || (filter === "published" ? published : !published))
      && `${handoff.displayTitle ?? ""} ${handoff.handoffId}`.toLocaleLowerCase().includes(normalizedQuery);
  });
  return (
    <section className="panel handoff-library" aria-labelledby="library-title">
      <header className="library-header">
        <div>

          <h2 id="library-title">내 전달함</h2>
          <p className="library-description">작성 중인 초안과 공유할 전달본을 관리합니다.</p>
        </div>
        <Link className="button-link library-create" href="/new">새 전달 만들기 <span aria-hidden="true">＋</span></Link>
      </header>

      {handoffs.length === 0 ? (
        <div className="library-empty">

          <h3>아직 만든 전달이 없습니다</h3>
          <p>동료에게 부탁할 일이나 설명할 배경을 정리해보세요. 내용을 확인한 뒤 링크로 보낼 수 있습니다.</p>

          <p className="library-empty-hint">초안은 나만 볼 수 있습니다. 내용을 검토하고 확정한 뒤 공유하세요.</p>
        </div>
      ) : (
        <>
          <div className="library-toolbar">
            <div className="library-filters" role="group" aria-label="전달 상태 필터">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>전체 <span>{handoffs.length}</span></button>
              <button type="button" aria-pressed={filter === "draft"} onClick={() => setFilter("draft")}>초안만 <span>{handoffs.length - publishedCount}</span></button>
              <button type="button" aria-pressed={filter === "published"} onClick={() => setFilter("published")}>확정본 있음 <span>{publishedCount}</span></button>
            </div>
            <div className="library-search"><UiIcon name="search"/><label className="sr-only" htmlFor="handoff-search">전달 이름 또는 관리 번호 검색</label><input id="handoff-search" type="search" placeholder="이름 또는 관리 번호로 찾기" value={query} onChange={(event) => setQuery(event.target.value)}/></div>
          </div>
          <p className="library-count" role="status">{visibleHandoffs.length}건 <span>· 날짜 기준 UTC · 이름은 나에게만 표시</span></p>
          {visibleHandoffs.length === 0 ? <div className="library-no-results"><h3>조건에 맞는 전달이 없어요.</h3><p>다른 이름으로 검색하거나 필터를 바꿔보세요.</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>검색·필터 초기화</button></div> : null}
          <ul className="handoff-library-list">
            {visibleHandoffs.map((handoff) => {
              const published = handoff.latestPublishedVersion !== undefined;
              return (
                <li key={handoff.handoffId} className="handoff-library-item">
                  <div className="library-card-header">
                    <span className="library-document-icon" aria-hidden="true"><UiIcon name="document"/></span>
                    <div className="library-record-title">
                    <h3>{handoff.displayTitle ?? "이름 없는 전달"}</h3>

                    </div>
                    <span className={`library-status ${published ? "library-status-published" : "library-status-draft"}`}>
                      {published ? "전달본 확정" : "초안"}
                    </span>
                  </div>
                  <dl className="library-metadata">
                    <div><dt>초안</dt><dd>수정 {handoff.draftRevision}</dd></div>
                    <div><dt>최근 수정</dt><dd><time dateTime={handoff.draftUpdatedAt}>{formatDateUtc(handoff.draftUpdatedAt)}</time></dd></div>
                    <div><dt>확정 전달본</dt><dd>{published ? `버전 ${handoff.latestPublishedVersion}` : "아직 확정 전"}</dd></div>
                  </dl>
                  <details className="library-dates">
                    <summary>관리 정보 보기</summary>
                    <p className="record-id">관리 번호 {handoff.handoffId}</p>
                    <p>만든 날 <time dateTime={handoff.createdAt}>{formatDateUtc(handoff.createdAt)}</time></p>
                    {handoff.latestPublishedAt ? <p>최근 확정 <time dateTime={handoff.latestPublishedAt}>{formatDateUtc(handoff.latestPublishedAt)}</time></p> : null}
                  </details>
                  <div className="library-card-actions">
                    <Link className="library-action" href={`/handoffs/${handoff.handoffId}/review`}>초안 편집</Link>
                    {published ? <Link className="library-action library-action-published" href={`/handoffs/${handoff.handoffId}/published/${handoff.latestPublishedVersion}`}>전달본 보기</Link> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
