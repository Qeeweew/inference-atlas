import {useEffect,useMemo,useRef,useState} from 'react';
import {Search,X,FileCode2,BookOpen,ArrowUpRight} from 'lucide-react';
import {chapters,familyForChapter} from './content';
import {sourceIndex,repoName,type OpenCode} from './data';
export function SearchDialog({initial,close,go,open}:{initial:string;close:()=>void;go:(id:string)=>void;open:OpenCode}){
 const [query,setQuery]=useState(initial);const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{dialog.current?.showModal();input.current?.focus();return()=>dialog.current?.close()},[]);
 const results=useMemo(()=>{const q=query.toLowerCase().trim();if(!q)return [];
 const articles=chapters.filter(c=>(c.title+' '+c.subtitle+' '+c.tags.join(' ')+' '+c.sections.map(s=>s.body.join(' ')).join(' ')).toLowerCase().includes(q)).slice(0,8).map(c=>({type:'chapter',key:c.id,name:c.title,detail:[familyForChapter(c.id)?.title,c.subtitle].filter(Boolean).join(' / ')}));
 const sources=Object.values(sourceIndex.files).filter(f=>f.path.toLowerCase().includes(q)).slice(0,12).map(f=>({type:'source',key:f.id,name:f.path.split('/').at(-1)!,detail:`${repoName(f.repo)} / ${f.path}`}));
 const symbols=Object.values(sourceIndex.files).flatMap(f=>f.symbols.filter(s=>s.name.toLowerCase().includes(q)).slice(0,6).map(s=>({type:'symbol',key:f.id+'#'+s.name,name:s.name,detail:`${repoName(f.repo)} / ${f.path}:${s.line}`}))).slice(0,35);
 return [...articles,...sources,...symbols];},[query]);
 return <dialog ref={dialog} className="search-dialog" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===dialog.current)close()}}><div className="search-box"><Search size={21}/><input ref={input} aria-label="全站搜索" placeholder="搜索概念、模型、文件、函数…" value={query} onChange={e=>setQuery(e.target.value)}/><button className="icon-button" aria-label="关闭搜索" onClick={close}><X size={20}/></button></div><div className="search-results">{!query?<><p className="muted">从一个问题开始</p><div className="search-suggestions">{['KDA','调度','DeepseekV4Attention','prefix','slot','MambaSpec'].map(q=><button className="button" key={q} onClick={()=>setQuery(q)}>{q}</button>)}</div></>:results.length?results.map(r=><button key={r.type+r.key} className="search-result" onClick={()=>{close();if(r.type==='chapter')go(r.key);else open(r.key)}}>{r.type==='chapter'?<BookOpen size={18}/>:<FileCode2 size={18}/>}<span><strong>{r.name}</strong><small>{r.detail}</small></span><ArrowUpRight size={15}/></button>):<p className="empty">没有匹配结果。试试英文符号或更短的关键词。</p>}</div><div className="search-bottom">搜索覆盖 {chapters.length} 个专题和 {Object.values(sourceIndex.files).reduce((n,f)=>n+f.symbols.length,0).toLocaleString()} 个源码符号 <kbd>Esc</kbd></div></dialog>
}
