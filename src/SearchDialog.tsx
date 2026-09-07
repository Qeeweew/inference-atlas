import {useEffect,useMemo,useRef,useState} from 'react';
import {Search,X,FileCode2,BookOpen,ArrowUpRight} from 'lucide-react';
import {topics,guideFor} from './curriculum';
import type {Framework} from './curriculumTypes';
import {sourceIndex,repoName,type OpenCode} from './data';
export function SearchDialog({initial,close,go,open,engine}:{initial:string;close:()=>void;go:(id:string)=>void;open:OpenCode;engine:Framework}){
 const [query,setQuery]=useState(initial);const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{dialog.current?.showModal();input.current?.focus();return()=>dialog.current?.close()},[]);
 const results=useMemo(()=>{const q=query.toLowerCase().trim();if(!q)return [];
 const articles=topics.filter(t=>{const g=guideFor(engine,t.id);return (t.title+' '+g.question+' '+g.answer+' '+g.nodes.map(n=>n.title+' '+n.detail).join(' ')+' '+g.decisions.map(d=>d.title+' '+d.reason).join(' ')).toLowerCase().includes(q)}).slice(0,8).map(t=>({type:'chapter',key:t.id,name:t.title,detail:repoName(engine)+' / '+t.group}));
 const files=Object.values(sourceIndex.files).filter(f=>f.repo===engine||f.repo==='config');
 const sources=files.filter(f=>f.path.toLowerCase().includes(q)).slice(0,12).map(f=>({type:'source',key:f.id,name:f.path.split('/').at(-1)!,detail:`${repoName(f.repo)} / ${f.path}`}));
 const symbols=files.flatMap(f=>f.symbols.filter(s=>s.name.toLowerCase().includes(q)).slice(0,6).map(s=>({type:'symbol',key:f.id+'#'+s.name,name:s.name,detail:`${repoName(f.repo)} / ${f.path}:${s.line}`}))).slice(0,35);
 return [...articles,...sources,...symbols];},[query,engine]);
 return <dialog ref={dialog} className="search-dialog" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===dialog.current)close()}}><div className="search-box"><Search size={21}/><input ref={input} aria-label="全站搜索" placeholder="搜索当前框架的概念、模型、函数…" value={query} onChange={e=>setQuery(e.target.value)}/><button className="icon-button" aria-label="关闭搜索" onClick={close}><X size={20}/></button></div><div className="search-results">{!query?<><p className="muted">从一个问题开始</p><div className="search-suggestions">{['KDA','调度','DeepseekV4Attention','prefix','slot','MambaSpec'].map(q=><button className="button" key={q} onClick={()=>setQuery(q)}>{q}</button>)}</div></>:results.length?results.map(r=><button key={r.type+r.key} className="search-result" onClick={()=>{close();if(r.type==='chapter')go(r.key);else open(r.key)}}>{r.type==='chapter'?<BookOpen size={18}/>:<FileCode2 size={18}/>}<span><strong>{r.name}</strong><small>{r.detail}</small></span><ArrowUpRight size={15}/></button>):<p className="empty">没有匹配结果。试试英文符号或更短的关键词。</p>}</div><div className="search-bottom">{repoName(engine)} · {topics.length} 个专题 · 源码仅限当前框架与模型配置 <kbd>Esc</kbd></div></dialog>
}
