export type PrefixScenario='branch'|'suffix'|'salt'|'identical'|'unaligned';
const a=[11,12,13,14,15,16];
// Collision-free symbolic identities for teaching, not a runtime hash algorithm.
export function prefixScenario(kind:PrefixScenario,size=2,hole=false){
 const b=kind==='suffix'?[31,32,13,14,15,16]:kind==='branch'?[11,12,13,14,21,22]:kind==='unaligned'?[11,12,13,24,25,26]:a.slice();
 const names=new Map<string,string>();
 function chain(tokens:number[],salt:string){
  let signature='NONE_HASH',parent='seed';
  const units:{tokens:number[];hash:string;parent:string}[]=[];
  for(let i=0;i+size<=tokens.length;i+=size){
   const part=tokens.slice(i,i+size);signature=JSON.stringify([signature,part,i===0?salt:null]);
   if(!names.has(signature))names.set(signature,`H${names.size+1}`);
   const hash=names.get(signature)!;units.push({tokens:part,hash,parent});parent=hash;
  }
  return units;
 }
 const first=chain(a,'tenant-A'),second=chain(b,kind==='salt'?'tenant-B':'tenant-A');
 let common=0;while(common<a.length&&a[common]===b[common])common++;
 const resident=new Set(first.filter((_,i)=>!(hole&&i===1)).map(x=>x.hash));
 const max=Math.floor((b.length-1)/size),hits:string[]=[];
 for(const unit of second.slice(0,max)){if(!resident.has(unit.hash))break;hits.push(unit.hash)}
 const radix=kind==='salt'?0:Math.floor(common/size)*size;
 return {a,b,first,second,common,radix,hits,hitTokens:hits.length*size,resident};
}
export function radixStage(step:number){
 const active=step===2||step===3;
 const prefixSlots=[40,41,70,71],aSlots=[90,91],bSlots=[100,101];
 const node=(id:string,key:number[],value:number[],parent:string|null,children:string[],lock:number)=>({id,key,value,parent,children,lock});
 const nodes=step===0?[node('root',[],[],null,['A'],1),node('A',[11,12,13,14,15,16],[...prefixSlots,...aSlots],'root',[],0)]:[
  node('root',[],[],null,['P'],1),node('P',[11,12,13,14],prefixSlots,'root',[...(step<5?['A']:[]),...(step>=3?['B']:[])],active?1:0),
  ...(step<5?[node('A',[15,16],aSlots,'P',[],0)]:[]),
  ...(step>=3?[node('B',[21,22],bSlots,'P',[],step===3?1:0)]:[])
 ];
 const protectedTokens=nodes.filter(n=>n.id!=='root'&&n.lock>0).reduce((sum,n)=>sum+n.key.length,0);
 const evictableTokens=nodes.filter(n=>n.id!=='root'&&n.lock===0).reduce((sum,n)=>sum+n.key.length,0);
 return {nodes,protectedTokens,evictableTokens,requestSlots:active?[...prefixSlots,...bSlots]:[],lastNode:step===2?'P':step===3?'B':null};
}
export function vllmStage(step:number){
 const queue=step<2?[12,9,2,7]:step<4?[9]:step===4?[9,12,2,7]:[12,2,7];
 const blocks=[7,2,9,12].map(id=>({id,ref:step>=2&&step<=3&&[7,2,12].includes(id)||step===5&&id===9?1:0,hash:id===7?'H1':id===2?'H2':id===9?(step===5?null:'HA3'):step>=3?'HB3':null}));
 return {queue,blocks,request:step>=2&&step<=3?[7,2,12]:step===5?[9]:[],requestName:step===5?'C':'B'};
}
