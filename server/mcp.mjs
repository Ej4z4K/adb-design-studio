import readline from 'node:readline';
import {rpc} from './pricing.mjs';
const lines=readline.createInterface({input:process.stdin});
for await(const line of lines){
 try{const response=await rpc(JSON.parse(line));if(response)process.stdout.write(JSON.stringify(response)+'\n');}
 catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n');}
}
