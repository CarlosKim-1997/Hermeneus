import {renderToString} from "react-dom/server";
import {Preview} from "./view";
import {setPreviewPath} from "./navigation";
export function render(path:string,query:string){setPreviewPath(path);return renderToString(<Preview path={path} query={query}/>);}
import {items,handoffId,publishedAt} from "./data";
import {buildReceiverPacket} from "../../src/portable/receiver-packet";
import {unavailableVerdict} from "../../src/receiver/external/verifier";
export {items,handoffId};
export const packet=buildReceiverPacket({handoffId,version:1,publishedAt,items});
export const verdict=unavailableVerdict(packet);
