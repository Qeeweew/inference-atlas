import {Code2,ArrowUpRight} from 'lucide-react';
import {resolveRef,repoName,type Engine,type OpenCode} from './data';
export function References({refs,open,engine='both'}:{refs:string[];open:OpenCode;engine?:Engine}){
 const visible=refs.filter(ref=>engine==='both'||resolveRef(ref).file.repo===engine||resolveRef(ref).file.repo==='config');
 return <div className="references">{visible.length===0?<span className="muted small">此处证据来自另一框架，可切换「双框架」查看。</span>:visible.map(ref=>{const {file,line,symbol}=resolveRef(ref);return <button className={`source-link ${file.repo}`} onClick={()=>open(ref)} key={ref}><Code2 size={14}/><span className="source-repo">{repoName(file.repo)}</span><span className="source-name">{symbol?.name??file.path.split('/').at(-1)}</span><span className="source-line">:{line}</span><ArrowUpRight size={12}/></button>;})}</div>
}
