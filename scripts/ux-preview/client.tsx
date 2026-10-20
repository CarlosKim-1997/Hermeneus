import {hydrateRoot} from "react-dom/client";
import {Preview} from "./view";
hydrateRoot(document.getElementById("preview-root")!,<Preview path={window.location.pathname} query={window.location.search}/>);
