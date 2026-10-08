import {execFileSync} from 'node:child_process';
async function main(){
 for(let i=0;i<48;i++){
  const result=JSON.parse(execFileSync(process.execPath,['--import','tsx','--env-file=.env.local','scripts/measure-lineup.ts'],{encoding:'utf8'}));
  const ready=result.jobs.filter((j:{published:number,status:string})=>j.published>0||j.status==='completed').length;
  const complete=result.jobs.filter((j:{status:string})=>j.status==='completed').length;
  const held=result.jobs.filter((j:{status:string})=>j.status==='failed').length;
  const stock=result.jobs.filter((j:{error:string})=>j.error==='No available variants for this product').length;
  console.log(JSON.stringify({seconds:result.elapsedSeconds,ready,complete,held,stock}));
  if(result.jobs.length&&complete+held+stock===result.jobs.length)return;
  await new Promise(r=>setTimeout(r,15000));
 }
 throw Error('Measurement time limit reached');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
