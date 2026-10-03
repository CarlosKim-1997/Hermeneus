import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

async function exists(path){
  try{return await lstat(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}
}

async function findRoot(start){
  let current=resolve(start);
  while(true){
    const manifest=await exists(join(current,'governance/manifest.yaml'));
    if(manifest?.isFile())return current;
    const parent=dirname(current);
    if(parent===current)throw new Error('governance/manifest.yaml not found from current path');
    current=parent;
  }
}

function scalar(value){
  const text=value.trim();
  if((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
    return text.slice(1,-1);
  return text;
}

function parseSimpleYaml(text,path){
  const result={};
  const lines=text.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const raw=lines[i];
    if(!raw.trim() || raw.trimStart().startsWith('#'))continue;
    if(/^\s/.test(raw))throw new Error(`unsupported nested YAML in ${path}: ${raw}`);
    const match=raw.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if(!match)throw new Error(`unsupported YAML line in ${path}: ${raw}`);
    const key=match[1],tail=(match[2]??'').trim();
    if(Object.hasOwn(result,key))throw new Error(`duplicate YAML key in ${path}: ${key}`);
    if(tail===''){
      const values=[];
      while(i+1<lines.length){
        const next=lines[i+1];
        const item=next.match(/^\s+-\s+(.+)$/);
        if(!item)break;
        values.push(scalar(item[1]));
        i++;
      }
      result[key]=values;
    }else if(tail.startsWith('[') && tail.endsWith(']')){
      const inner=tail.slice(1,-1).trim();
      result[key]=inner?inner.split(',').map(scalar):[];
    }else{
      result[key]=scalar(tail);
    }
  }
  return result;
}

function parseFrontmatter(content,path){
  if(!content.startsWith('---\n') && !content.startsWith('---\r\n'))return null;
  const match=content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if(!match)return null;
  return parseSimpleYaml(match[1],path);
}

async function walkMarkdown(root,relDir){
  const dir=join(root,relDir);
  const info=await exists(dir);
  if(!info?.isDirectory() || info.isSymbolicLink())return [];
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const rel=`${relDir}/${entry.name}`;
    if(entry.isSymbolicLink())continue;
    if(entry.isDirectory())out.push(...await walkMarkdown(root,rel));
    else if(entry.isFile() && entry.name.endsWith('.md'))out.push(rel);
  }
  return out.sort();
}

async function loadRecord(root,path){
  const abs=resolve(root,path);
  const rel=relative(root,abs);
  if(rel.startsWith('..'+sep) || rel==='..' || resolve(root,rel)!==abs)throw new Error(`path escapes repository root: ${path}`);
  const info=await exists(abs);
  if(!info?.isFile() || info.isSymbolicLink())return null;
  const content=await readFile(abs,'utf8');
  const fm=parseFrontmatter(content,path);
  if(!fm)return null;
  return {
    id:typeof fm.id==='string'?fm.id:null,
    schema:typeof fm.schema==='string'?fm.schema:null,
    status:typeof fm.status==='string'?fm.status:null,
    areas:Array.isArray(fm.areas)?fm.areas.filter(x=>typeof x==='string'):[],
    relations:{
      depends_on:Array.isArray(fm.depends_on)?fm.depends_on:[],
      blocked_by:Array.isArray(fm.blocked_by)?fm.blocked_by:[],
      implements:Array.isArray(fm.implements)?fm.implements:[],
      related_to:Array.isArray(fm.related_to)?fm.related_to:[],
      supersedes:Array.isArray(fm.supersedes)?fm.supersedes:[]
    },
    resolved_by:typeof fm.resolved_by==='string'?fm.resolved_by:null,
    path
  };
}

function isCurrentRecord(record){
  if(record.schema==='decision/v1')return ['APPROVED','ACTIVE'].includes(record.status);
  if(record.schema==='constraint/v1')return record.status==='ACTIVE';
  if(record.schema==='open-question/v1')return ['OPEN','BLOCKING'].includes(record.status);
  if(record.schema==='task/v1')return !['COMPLETE','CANCELLED'].includes(record.status);
  return false;
}

function overlaps(recordAreas,targetAreas){
  return recordAreas.includes('global') || targetAreas.includes('global') ||
    recordAreas.some(area=>targetAreas.includes(area));
}

export async function discoverContext(start,target){
  const root=await findRoot(start);
  const manifestText=await readFile(join(root,'governance/manifest.yaml'),'utf8');
  const manifest=parseSimpleYaml(manifestText,'governance/manifest.yaml');
  const currentState=manifest.current_state;

  const paths=[];
  for(const dir of [
    'governance/constraints',
    'canon/decisions',
    'canon/constraints',
    'canon/open-questions',
    'work/tasks'
  ])paths.push(...await walkMarkdown(root,dir));

  const records=[];
  const byId=new Map();
  for(const path of paths){
    const record=await loadRecord(root,path);
    if(!record)continue;
    records.push(record);
    if(record.id)byId.set(record.id,record);
  }

  let targetRecord=null;
  if(target.includes('/') || target.endsWith('.md')){
    const normalized=target.replaceAll('\\','/');
    targetRecord=await loadRecord(root,normalized);
    if(!targetRecord)throw new Error(`target record not found or not structured: ${target}`);
  } else {
    targetRecord=byId.get(target)||null;
    if(!targetRecord)throw new Error(`target ID not found: ${target}`);
  }

  const targetAreas=targetRecord.areas;
  const directIds=new Set([
    ...targetRecord.relations.depends_on,
    ...targetRecord.relations.blocked_by,
    ...targetRecord.relations.implements,
    ...targetRecord.relations.related_to,
    ...(targetRecord.resolved_by?[targetRecord.resolved_by]:[])
  ]);

  const candidates=new Map();
  const add=(record,reason)=>{
    if(!record?.path)return;
    const current=candidates.get(record.path);
    if(current){if(!current.reasons.includes(reason))current.reasons.push(reason);return;}
    candidates.set(record.path,{
      id:record.id,
      schema:record.schema,
      status:record.status,
      areas:record.areas,
      path:record.path,
      reasons:[reason]
    });
  };

  add(targetRecord,'target');

  for(const id of directIds){
    const record=byId.get(id);
    if(record)add(record,'direct-reference');
  }

  for(const record of records){
    if(!isCurrentRecord(record))continue;
    if(record.schema==='constraint/v1' && record.path.startsWith('governance/constraints/'))
      add(record,'active-governance-constraint');
    if(overlaps(record.areas,targetAreas))
      add(record,'area-candidate');
  }

  const selectedPaths=new Set(candidates.keys());
  const otherCurrent=records
    .filter(record=>isCurrentRecord(record) && !selectedPaths.has(record.path))
    .map(record=>({id:record.id,schema:record.schema,status:record.status,areas:record.areas,path:record.path}))
    .sort((a,b)=>a.path.localeCompare(b.path,'en'));

  return {
    schema:'governance-context-discovery/v1',
    root,
    target:{id:targetRecord.id,schema:targetRecord.schema,status:targetRecord.status,areas:targetRecord.areas,path:targetRecord.path},
    bootstrap:[
      'AGENTS.md',
      'governance/manifest.yaml',
      'governance/SPEC.md',
      currentState
    ],
    candidates:[...candidates.values()].sort((a,b)=>a.path.localeCompare(b.path,'en')),
    other_current_records:otherCurrent,
    disclaimer:'Advisory discovery only. Areas and relations help preload context but do not prove ownership, permission, or complete applicability. Unloaded authoritative material may still apply.'
  };
}

function format(result){
  const lines=[
    'Repository Governance context discovery',
    `Target: ${result.target.id??result.target.path} | ${result.target.path}`,
    `Areas: ${result.target.areas.join(', ')||'(none)'}`,
    '',
    'Bootstrap:',
    ...result.bootstrap.map(path=>`  - ${path}`),
    '',
    'Suggested candidates:'
  ];
  for(const item of result.candidates)
    lines.push(`  - ${item.id??'-'} | ${item.path} | ${item.reasons.join(', ')}`);
  lines.push('',`Other current structured records not selected: ${result.other_current_records.length}`,result.disclaimer);
  return lines.join('\n');
}

function parseArgs(argv){
  let json=false,target=null;
  for(const arg of argv){
    if(arg==='--json')json=true;
    else if(!target)target=arg;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if(!target)throw new Error('usage: context.mjs <record-id-or-path> [--json]');
  return {json,target};
}

async function main(){
  const {json,target}=parseArgs(process.argv.slice(2));
  const result=await discoverContext(process.cwd(),target);
  process.stdout.write((json?JSON.stringify(result,null,2):format(result))+'\n');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)main().catch(error=>{process.stderr.write(String(error?.message||error)+'\n');process.exitCode=2;});
