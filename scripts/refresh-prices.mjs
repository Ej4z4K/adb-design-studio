import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {writeFile,mkdir} from 'node:fs/promises';
// Use the MCP wire protocol rather than importing the pricing implementation.
const child=spawn(process.execPath,['server/mcp.mjs'],{stdio:['pipe','pipe','inherit']});
const pending=new Map();let sequence=0;
readline.createInterface({input:child.stdout}).on('line',line=>{const r=JSON.parse(line);const cb=pending.get(r.id);if(cb){pending.delete(r.id);r.error?cb.reject(Error(r.error.message)):cb.resolve(r.result);}});
const call=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
const timer=setTimeout(()=>{child.kill();console.error('MCP catalogue request timed out');process.exitCode=1;},60000);
try{
 await call('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'github-pages-publisher',version:'1.0.0'}});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const listed=await call('tools/list',{});if(!listed.tools.some(t=>t.name==='get_oci_price_catalogue'))throw Error('Pricing tool missing');
 const result=await call('tools/call',{name:'get_oci_price_catalogue',arguments:{}});
 if(result.isError)throw Error(result.content[0].text);
 await mkdir('web/data',{recursive:true});await writeFile('web/data/prices.json',JSON.stringify(result.structuredContent));
 console.log(`Published ${result.structuredContent.products.length} Oracle SKUs through MCP at ${result.structuredContent.retrievedAt}`);
}finally{clearTimeout(timer);child.stdin.end();}
