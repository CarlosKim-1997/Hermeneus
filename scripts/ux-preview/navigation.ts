let currentPath="/library";
export function setPreviewPath(path:string){currentPath=path;}
export function usePathname(){const path=typeof window==="undefined"?currentPath:window.location.pathname;return path==="/library"?"/handoffs":path;}
export function useRouter(){return {push:(path:string)=>{window.location.assign(path);},refresh:()=>window.location.reload()};}
