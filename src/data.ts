import raw from './source-index.json';
export type SymbolInfo={name:string;line:number;end:number;kind:string};
export type SourceFile={id:string;repo:string;path:string;localPath:string;lineCount:number;symbols:SymbolInfo[];remote:string;sha256:string;url:string};
export const sourceIndex=raw as {checkedAt:string;repos:Record<string,{sha:string;origin:string;date:string}>;files:Record<string,SourceFile>};
export function resolveRef(ref:string){
 const [id,anchor]=ref.split('#');const file=sourceIndex.files[id];
 if(!file)throw new Error(`未知源码引用 ${ref}`);
 const symbol=anchor?file.symbols.find(s=>s.name===anchor):undefined;
 if(anchor&&!symbol&&!/^L\d+$/.test(anchor))throw new Error(`无法定位符号 ${ref}`);
 const line=symbol?.line??(anchor?Number(anchor.slice(1)):1);
 return {file,line,end:symbol?.end??line,symbol};
}
export const repoName=(repo:string)=>repo==='sglang'?'SGLang':repo==='vllm'?'vLLM':'官方配置';
export type Engine='both'|'sglang'|'vllm';
export type OpenCode=(ref:string)=>void;
