import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {rpc} from './pricing.mjs';
const port=Number(process.env.PORT||8788),host=process.env.HOST||'127.0.0.1';
const origins=(process.env.ALLOWED_ORIGINS||'http://127.0.0.1:8787,http://localhost:8787').split(',');
const token=process.env.MCP_TOKEN;
if(host!=='127.0.0.1'&&!token)throw Error('Set MCP_TOKEN before exposing the service');
http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&!origins.includes(origin)){res.writeHead(403);res.end();return;}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, MCP-Protocol-Version');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.url!=='/mcp'||req.method!=='POST'){res.writeHead(405);res.end();return;}
 const supplied=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,'')),expected=Buffer.from(token||'');
 if(token&&(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))){res.writeHead(401);res.end();return;}
 try{
 let body='';for await(const c of req){body+=c;if(body.length>16384){res.writeHead(413);res.end();return;}}
 const result=await rpc(JSON.parse(body));res.writeHead(result?200:202,{'Content-Type':'application/json'});res.end(result?JSON.stringify(result):'');
 }catch{res.writeHead(400);res.end('Invalid request');}
}).listen(port,host,()=>console.error(`Read-only pricing MCP: http://${host}:${port}/mcp`));
