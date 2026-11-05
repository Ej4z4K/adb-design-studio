export const SOURCE='https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/';
export function normalize(raw) {
 if(!Array.isArray(raw.items)||raw.items.length<1) throw Error('Oracle returned an invalid catalogue');
 return {source:SOURCE,retrievedAt:new Date().toISOString(),catalogueUpdatedAt:raw.lastUpdated,method:'Oracle public catalogue via read-only MCP',products:raw.items.map(p=>({sku:p.partNumber,name:p.displayName,unit:p.metricName,category:p.serviceCategory,rates:Object.fromEntries((p.currencyCodeLocalizations||[]).map(c=>[c.currencyCode,c.prices.find(x=>x.model==='PAY_AS_YOU_GO')?.value]).filter(([,v])=>Number.isFinite(v)))}))};
}
let cache;
export async function catalogue(){
 if(cache&&Date.now()-Date.parse(cache.retrievedAt)<3600000)return cache;
 const response=await fetch(SOURCE,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`Oracle catalogue HTTP ${response.status}`);
 cache=normalize(await response.json()); return cache;
}
export const tool={name:'get_oci_price_catalogue',description:'Read Oracle public PAY_AS_YOU_GO prices, SKUs, metric units, currencies and provenance. Not a commercial quote or the interactive Cost Estimator session.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}};
export async function rpc(req){
 const {id,method,params}=req;
 if(req.jsonrpc!=='2.0')return {jsonrpc:'2.0',id:id??null,error:{code:-32600,message:'Invalid JSON-RPC request'}};
 if(id===undefined)return null;
 let result;
 try{
 switch(method){
 case 'initialize': result={protocolVersion:['2025-11-25','2025-06-18','2025-03-26','2024-11-05'].includes(params?.protocolVersion)?params.protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'adb-oci-pricing',version:'1.0.0'}};break;
 case 'ping':result={};break;
 case 'tools/list':result={tools:[tool]};break;
 case 'tools/call':
 if(params?.name!==tool.name)throw Error('Unknown tool');
 if(Object.keys(params.arguments||{}).length)throw Error('This tool accepts no arguments');
 try {const data=await catalogue();result={content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};}
 catch(e){result={isError:true,content:[{type:'text',text:e.message}]};}break;
 default:return {jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}};
 }
 return {jsonrpc:'2.0',id,result};
 }catch(e){return {jsonrpc:'2.0',id,error:{code:-32602,message:e.message}};}
}
