export function scheduleDemo({budget=8,chunk=8,decodeFirst=true}={}) {
  const requests=[{id:'A',prompt:0,left:4,computed:0,arrival:0},{id:'B',prompt:24,left:4,computed:0,arrival:0},{id:'C',prompt:8,left:3,computed:0,arrival:2}];
  const rounds=[];
  for(let round=0;round<100 && requests.some(r=>r.left>0);round++){
    let available=budget;
    const active=requests.filter(r=>r.arrival<=round && r.left>0);
    if(decodeFirst) active.sort((a,b)=>Number(a.computed<a.prompt)-Number(b.computed<b.prompt));
    const slots=[];
    for(const req of active){
      if(!available) break;
      const prefill=req.computed<req.prompt;
      const tokens=prefill?Math.min(req.prompt-req.computed,chunk,available):1;
      req.computed+=prefill?tokens:0;
      if(!prefill) req.left--;
      available-=tokens;
      slots.push({id:req.id,phase:prefill?'prefill':'decode',tokens,left:req.left});
    }
    rounds.push({round:round+1,slots,used:budget-available,remaining:requests.map(r=>({id:r.id,promptLeft:Math.max(0,r.prompt-r.computed),outputLeft:r.left}))});
  }
  return rounds;
}
export function cacheDemo(a,b,blockSize){
 const first=a.trim().split(/\s+/).filter(Boolean),second=b.trim().split(/\s+/).filter(Boolean);
 let prefix=0;while(prefix<Math.min(first.length,second.length)&&first[prefix]===second[prefix])prefix++;
 const fullBlocks=Math.floor(prefix/blockSize);
 return {first,second,prefix,fullBlocks,reusableTokens:fullBlocks*blockSize,logicalBlocks:Math.ceil(first.length/blockSize)+Math.ceil(second.length/blockSize),physicalBlocks:Math.ceil(first.length/blockSize)+Math.ceil(second.length/blockSize)-fullBlocks};
}
export function k3Memory({context=32768,requests=1,tp=8,dcp=1,kvBytes=2}={}){
 const recurrent=69*(96/tp)*128*128*4*requests;
 const conv=69*(3*96*128/tp)*3*2*requests;
 const mla=24*(512+64)*kvBytes*context*requests/dcp;
 return {recurrent,conv,mla,total:recurrent+conv+mla};
}
export function sparseDemo({length=8192,ratio=4,topk=512,window=128}={}){
 const completed=ratio?Math.floor(length/ratio):0;
 return {completed,pending:ratio?length%ratio:0,selected:ratio===4?Math.min(topk,completed):completed,window:Math.min(length,window)};
}
export function speculativeEstimate({tokens=4,acceptance=.8,draft=.12,verify=1.4}={}){
 let expected=1;for(let i=1;i<=tokens;i++)expected+=acceptance**i;
 const cost=tokens*draft+verify;
 return {expected,cost,speedup:expected/cost};
}
