export type Framework='sglang'|'vllm';
export type Mechanism={title:string;ref:string;detail:string;input:string;output:string};
export type Decision={title:string;reason:string;cost:string};
export type Guide={question:string;answer:string;nodes:Mechanism[];decisions:Decision[];kind:'flow'|'components'};
export const n=(title:string,ref:string,detail:string,input:string,output:string):Mechanism=>({title,ref,detail,input,output});
export const d=(title:string,reason:string,cost:string):Decision=>({title,reason,cost});
export const p=(question:string,answer:string,nodes:Mechanism[],decisions:Decision[],kind:Guide['kind']='flow'):Guide=>({question,answer,nodes,decisions,kind});
