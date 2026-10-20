import { formatDateTimeUtc } from "./ui-dates";
import type { HandoffItemType, HandoffPriority } from "../../handoff/schema";
import { ItemMeaning, ITEM_LABELS } from "./handoff-presentation";

type DocumentItem = { id: string; type: HandoffItemType; priority: HandoffPriority; statement: string };

function excerpt(statement: string) {
  const characters = Array.from(statement);
  return characters.slice(0, 38).join("") + (characters.length > 38 ? "…" : "");
}

/** Presentation only: retain the snapshot's order and exact statements, with no generated summary. */
export function PublishedDocument({ items, version, publishedAt, heading = "보낸 사람이 확정한 내용" }: {
  items: readonly DocumentItem[]; version: number; publishedAt: string; heading?: string;
}) {
  return <section className="panel panel-receiver canon-document" aria-labelledby="canon-document-title">
    <header className="document-heading">
      <div className="document-stamp"><span>확정 전달본</span><span>버전 {version} · {items.length}개 항목</span></div>
      <h2 id="canon-document-title">{heading}</h2>
      <p className="field-help">확정 {formatDateTimeUtc(publishedAt)} · 보낸 사람이 확정한 전달 내용입니다.</p>
    </header>
    <div className="document-layout">
      <nav className="document-outline" aria-label="전달본 목차">
        <p className="eyebrow">이 전달본에서</p>
        <ol>{items.map((item, index) => <li key={item.id}><a href={`#canon-item-${index}`}><span className="outline-number">{String(index + 1).padStart(2, "0")}</span><span>{ITEM_LABELS[item.type]}<small>{excerpt(item.statement)}</small></span></a></li>)}</ol>
      </nav>
      <div className="document-body">{items.map((item, index) => <article key={item.id} id={`canon-item-${index}`} tabIndex={-1} className="item-card canon-entry">
        <div className="document-item-heading"><span className="entry-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><ItemMeaning type={item.type} priority={item.priority} /></div>
        <p>{item.statement}</p>
      </article>)}</div>
    </div>
  </section>;
}
