import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture } from './helpers/apps-script-fixture.mjs';
const eventId=(n)=>String(n).padStart(64,'0');
test('backup keeps versions, deduplicates delivery and never overwrites newer mirror',()=>{
 const f=createFixture(); const item=f.createReport(f.adminSession).data;
 const history={id:'history-1',reportId:item.id,tanggal:item.createdAt,nama:'Admin',aksi:'Laporan dibuat',detail:'{}'};
 const send=(version,n)=>f.request({action:'backupSync',eventId:eventId(n),report:{...item,version},history:{...history,id:`history-${n}`},photos:[]});
 assert.equal(send(3,3).status,'success'); assert.equal(send(1,1).status,'success'); assert.equal(send(3,3).duplicate,true);
 const mirror=f.ss.getSheetByName('Firebase Backup'); assert.equal(mirror.data[1][18],3);
 assert.equal(f.ss.getSheetByName('Firebase Snapshots').data.length,3);
 assert.equal(f.ss.getSheetByName('Firebase Riwayat').data.length,3);
 assert.equal(f.data.data[1][18],1);
});
test('export includes archived records and raw history, never account passwords',()=>{
 const f=createFixture(); const item=f.createReport(f.adminSession).data;
 f.request({action:'delete',...f.adminSession,id:item.id,version:1});
 const result=f.request({action:'backupExport',offset:0}); assert.equal(result.status,'success'); assert.ok(result.data[0].report.deletedAt); assert.equal(result.data[0].history.length,2); assert.equal(result.data[0].report.row,undefined); assert.ok(!JSON.stringify(result).includes('passwordHash'));
 assert.equal(f.request({action:'backupExport',apiKey:'wrong'}).code,403);
});
test('backup photos deduplicate by Storage path and remain private; missing earlier photo retries',()=>{
 const f=createFixture(); const item=f.createReport(f.adminSession).data;
 const path=`komplainer/reports/${item.id}/p.jpg`;
 const report={...item,photoRefs:[{path}]};
 assert.equal(f.request({action:'backupSync',eventId:eventId(1),report,photos:[]}).code,409);
 const input={action:'backupSync',eventId:eventId(1),report,photos:[{path,mimeType:'image/jpeg',filename:'p.jpg',base64:Buffer.from('fixture').toString('base64')}]};
 assert.equal(f.request(input).status,'success'); assert.equal(f.request(input).duplicate,true); assert.equal(f.driveFiles.length,1); assert.equal(f.driveFiles[0].sharing,null);
});
test('migration lock blocks source writes while export and backup remain available',()=>{
 const f=createFixture(); const item=f.createReport(f.adminSession).data;
 assert.equal(f.request({action:'backupMaintenance',enabled:true}).writeLocked,true);
 assert.equal(f.createReport(f.adminSession).code,503);
 assert.equal(f.request({action:'list',...f.adminSession}).data.length,1);
 assert.equal(f.request({action:'backupExport'}).data.length,1);
 assert.equal(f.request({action:'backupSync',eventId:eventId(1),report:item,photos:[]}).status,'success');
 assert.equal(f.request({action:'backupMaintenance',enabled:false}).writeLocked,false);
 assert.equal(f.createReport(f.adminSession).status,'success');
});
test('migration dry-run uses paginated export and does not require Firebase credentials',async()=>{
 const { createServer }=await import('node:http');
 const { spawn }=await import('node:child_process');
 let writes=0;
 const server=createServer(async(request,response)=>{
  let text='';for await(const part of request)text+=part;
  const body=JSON.parse(text);
  if(!['backupHealth','backupExport'].includes(body.action))writes++;
  const result=body.action==='backupHealth'?{status:'success',protocol:'komplainer-backup-v1'}:{status:'success',data:body.offset===0?[{report:{id:'OLD-1',version:1,fotoIds:[],deletedAt:''},history:[]}]:[],nextOffset:body.offset===0?25:null};
  response.setHeader('Content-Type','application/json');response.end(JSON.stringify(result));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const env={...process.env,GOOGLE_SCRIPT_URL:`http://127.0.0.1:${server.address().port}`,GOOGLE_SCRIPT_API_KEY:'test-only-key'.repeat(3)};
  delete env.FIREBASE_SERVICE_ACCOUNT_JSON;delete env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const child=spawn(process.execPath,['scripts/migrate-firestore.mjs'],{env});let output='';let errors='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);
  const code=await new Promise((resolve,reject)=>{child.on('close',resolve);child.on('error',reject);});
  assert.equal(code,0,errors);assert.match(output,/"reports":1/);assert.equal(writes,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('backup adds an initial-solution column without losing PIC resolution', () => {
 const f=createFixture(); const item={...f.createReport(f.adminSession).data,solusiAwal:'Awal pelapor',jalanKeluar:'Hasil PIC',statusPenanganan:'Selesai'};
 assert.equal(f.request({action:'backupSync',eventId:eventId(1),report:item,photos:[]}).status,'success');
 const sheet=f.ss.getSheetByName('Firebase Backup');
 assert.equal(sheet.data[0][23],'Solusi Awal');
 assert.equal(sheet.data[1][23],'Awal pelapor');
 assert.equal(sheet.data[1][6],'Hasil PIC');
});
