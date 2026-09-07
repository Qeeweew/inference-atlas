export type Section = {title:string; body:string[]; principle:string; tradeoff:string; refs:string[]};
export type Chapter = {id:string; group:string; title:string; subtitle:string; intro:string; tags:string[]; sections:Section[]; compare?:[string,string,string][]; lab?:string; related:string[]};
