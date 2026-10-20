type IconName = "library" | "plus" | "account" | "arrow" | "search" | "document";
const paths: Record<IconName, string> = {
  library: "M4 4h16v16H4z M4 9h16 M9 9v11",
  plus: "M12 5v14 M5 12h14",
  account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M4 21v-2a8 8 0 0 1 16 0v2",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  search: "M16.5 16.5 21 21 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0z",
  document: "M14 2H5v20h14V7z M14 2v5h5 M8 12h8 M8 16h6",
};
export function UiIcon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
