export type SyncMapping=Record<string,{id:number;variants:Record<string,number>}>;
export function migrateSyncState(state:Record<string,unknown>, mapping:SyncMapping):Record<string,unknown>{
 const allVariants=new Map(Object.values(mapping).flatMap(m=>Object.entries(m.variants)));
 function walk(value:unknown,key=''):unknown {
  if(Array.isArray(value))return value.map(v=>walk(v,key));
  if(!value||typeof value!=='object')return value;
  const row=value as Record<string,unknown>;
  const next:Record<string,unknown>={};
  for(const [k,v] of Object.entries(row)){
   if(k==='taskKey'||k==='taskStartedAt')continue;
   if(k==='syncId'&&v!=null){if(!mapping[String(v)])throw Error(`Missing sync product ${v}`);next[k]=mapping[String(v)].id;}
   else if(k==='id'&&key==='sync_product'){if(!mapping[String(v)])throw Error(`Missing sync product ${v}`);next[k]=mapping[String(v)].id;}
   else if(k==='id'&&key==='sync_variants'){const n=allVariants.get(String(v));if(!n)throw Error(`Missing sync variant ${v}`);next[k]=n;}
   else next[k]=walk(v,k);
  }
  return next;
 }
 return walk(state) as Record<string,unknown>;
}
