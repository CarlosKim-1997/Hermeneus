import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const exec=promisify(execFile);

async function git(cwd,args){
  const {stdout}=await exec('git',args,{cwd});
  return stdout.trim();
}

function parseWorktrees(text){
  const records=[];
  let current=null;
  for(const line of text.split(/\r?\n/)){
    if(line.startsWith('worktree ')){
      if(current)records.push(current);
      current={path:line.slice(9),head:null,branch:null,detached:false};
    } else if(!current) {
      continue;
    } else if(line.startsWith('HEAD ')) {
      current.head=line.slice(5);
    } else if(line.startsWith('branch ')) {
      current.branch=line.slice(7).replace(/^refs\/heads\//,'');
    } else if(line==='detached') {
      current.detached=true;
    }
  }
  if(current)records.push(current);
  return records;
}

async function compareRef(cwd,ref){
  try{
    const sha=await git(cwd,['rev-parse',ref]);
    const counts=(await git(cwd,['rev-list','--left-right','--count',`HEAD...${ref}`])).split(/\s+/).map(Number);
    const head=await git(cwd,['rev-parse','HEAD']);
    return {ref,sha,ahead:counts[0],behind:counts[1],matches_head:head===sha};
  }catch{
    return {ref,sha:null,ahead:null,behind:null,matches_head:null,unresolved:true};
  }
}

export async function inspectWorkspace(cwd=process.cwd(),expectRef=null){
  let root;
  try{
    root=await git(cwd,['rev-parse','--show-toplevel']);
  }catch{
    return {
      schema:'governance-workspace-preflight/v1',
      git:false,
      inspected_from:cwd,
      note:'Not inside a readable Git worktree. Repository Governance can still operate without Git; this optional helper cannot provide workspace facts.'
    };
  }

  const [branchRaw,head,statusRaw,worktreeRaw]=await Promise.all([
    git(root,['branch','--show-current']).catch(()=>null),
    git(root,['rev-parse','HEAD']).catch(()=>null),
    git(root,['status','--porcelain=v1','--untracked-files=all']).catch(()=>null),
    git(root,['worktree','list','--porcelain']).catch(()=>'')
  ]);

  let upstream=null;
  try{
    const ref=await git(root,['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}']);
    upstream=await compareRef(root,ref);
  }catch{}

  const expected=expectRef?await compareRef(root,expectRef):null;
  const dirtyEntries=statusRaw===null?null:statusRaw.split(/\r?\n/).filter(Boolean);

  return {
    schema:'governance-workspace-preflight/v1',
    git:true,
    root,
    branch:branchRaw||null,
    detached:!branchRaw,
    head,
    clean:dirtyEntries===null?null:dirtyEntries.length===0,
    dirty_entries:dirtyEntries,
    worktrees:parseWorktrees(worktreeRaw),
    upstream,
    expected,
    network_fetch_performed:false,
    note:'Read-only local Git observation. Remote-tracking refs may be stale because this helper never fetches.'
  };
}

function format(result){
  if(!result.git)return [
    'Repository Governance workspace preflight',
    'Git: unavailable or not a worktree',
    result.note
  ].join('\n');

  const lines=[
    'Repository Governance workspace preflight',
    `Root: ${result.root}`,
    `Branch: ${result.branch??'(detached)'}`,
    `HEAD: ${result.head??'(unknown)'}`,
    `Clean: ${result.clean===null?'UNKNOWN':result.clean?'YES':'NO'}`,
    `Linked worktrees: ${result.worktrees.length}`
  ];
  for(const item of result.worktrees)
    lines.push(`  - ${item.path} | ${item.branch??'(detached)'} | ${item.head??'(unknown)'}`);
  if(result.upstream)
    lines.push(`Upstream: ${result.upstream.ref} | ahead ${result.upstream.ahead} | behind ${result.upstream.behind}`);
  if(result.expected)
    lines.push(result.expected.unresolved
      ?`Expected ref: ${result.expected.ref} | unresolved locally`
      :`Expected ref: ${result.expected.ref} | ${result.expected.sha} | ahead ${result.expected.ahead} | behind ${result.expected.behind} | HEAD match ${result.expected.matches_head?'YES':'NO'}`);
  lines.push(result.note);
  return lines.join('\n');
}

function parseArgs(argv){
  let json=false,expectRef=null;
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--json')json=true;
    else if(arg==='--expect'){
      if(!argv[i+1])throw new Error('--expect requires a Git ref');
      expectRef=argv[++i];
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return {json,expectRef};
}

async function main(){
  const {json,expectRef}=parseArgs(process.argv.slice(2));
  const result=await inspectWorkspace(process.cwd(),expectRef);
  process.stdout.write((json?JSON.stringify(result,null,2):format(result))+'\n');
  if(!result.git)process.exitCode=1;
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)main().catch(error=>{process.stderr.write(String(error?.message||error)+'\n');process.exitCode=2;});
