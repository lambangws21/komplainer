import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mutateReport, validatePhotos, publicReport, REPORTS, BACKUPS } from '../src/lib/server/firestore-domain.mjs';
import { executeFirestore } from '../src/lib/server/firestore-store.mjs';
import { syncBackupJob, cronAuthorized, retryDelay } from '../src/lib/server/firebase-backup.mjs';
import { fakeFirestore } from './helpers/firestore-fixture.mjs';
const user = (id,role='pelapor') => ({ id, role, nama:id, active:true, approval:'approved' });
const reporter=user('reporter'), pic=user('pic','petugas'), admin=user('admin','admin'), stranger=user('other');
const accounts=[reporter,pic,admin,stranger];
const body=()=>({requestId:randomUUID(),tanggal:'2026-10-08',dokter:'Dokter',rumahSakit:'RS',team:'TS',tindakan:'TKR',komplain:'Masalah',statusCase:'Ada Kendala'});
const now='2026-10-08T00:00:00Z';
test('Firestore domain requires hospital and approval; reporter cannot set severity',()=>{
 assert.throws(()=>mutateReport('create',{...body(),rumahSakit:' '},null,reporter,accounts,[],now),/Rumah Sakit/);
 assert.throws(()=>mutateReport('create',body(),null,{...reporter,approval:'pending'},accounts,[],now),e=>e.code===403);
 const created=mutateReport('create',{...body(),status:'C1 - Critical'},null,reporter,accounts,[],now).item;
 assert.equal(created.status,'');
 assert.throws(()=>mutateReport('update',{...created,status:'C1 - Critical'},created,reporter,accounts,[],now),e=>e.code===403);
});
test('permissions, version conflict, delegated reporter PIC and complete/reopen/archive',()=>{
 let item=mutateReport('create',body(),null,reporter,accounts,[],now).item;
 // Reports are readable by every account (team-wide transparency) — a non-owner, non-admin
 // stranger can see this report but still can't edit it, hence 403 rather than 404.
 assert.throws(()=>mutateReport('update',{...item},item,stranger,accounts,[],now),e=>e.code===403);
 assert.throws(()=>mutateReport('assign',{id:item.id,version:1,picId:pic.id},item,reporter,accounts,[],now),e=>e.code===403);
 assert.throws(()=>mutateReport('assign',{version:1,picId:stranger.id},item,admin,accounts,[],now),/Pilih petugas/);
 item=mutateReport('assign',{version:1,picId:reporter.id},item,admin,accounts,[],now).item;
 assert.equal(item.picRole,'pelapor');
 assert.throws(()=>mutateReport('followUp',{status:'C3 - Moderate',version:1,statusPenanganan:'Diproses'},item,reporter,accounts,[],now),e=>e.code===409);
 assert.throws(()=>mutateReport('followUp',{status:'C3 - Moderate',version:2,statusPenanganan:'Selesai',jalanKeluar:''},item,reporter,accounts,[],now),/Solusi/);
 const complete=mutateReport('followUp',{version:2,statusPenanganan:'Selesai',jalanKeluar:'Solusi',status:'C2 - Major'},item,reporter,accounts,[],now);
 item=complete.item; assert.equal(item.selesaiPada,now); assert.ok(JSON.parse(complete.history.detail).before);
 item=mutateReport('reopen',{version:3,catatan:'Masalah kembali'},item,reporter,accounts,[],now).item;
 assert.equal(item.selesaiPada,'');
 item=mutateReport('delete',{version:4},item,admin,accounts,[],now).item; assert.ok(item.deletedAt);
});
test('publicReport strips internal storage fields and exposes only authenticated photo paths',()=>{
 const item=mutateReport('create',body(),null,reporter,accounts,[{path:'komplainer/reports/x/photo'}],now).item;
 const projected=publicReport(item,accounts); assert.equal(projected.photoRefs,undefined); assert.equal(projected.photoCount,undefined); assert.match(projected.fotoUrls[0],/^\/api\/photo\?report=/);
 assert.equal(projected.komplain,item.komplain);
});
test('photo payload validation rejects non-image bytes, excess count and lifetime cap',()=>{
 assert.throws(()=>validatePhotos([{mimeType:'image/jpeg',base64:Buffer.from('not image').toString('base64')}]),/Foto tidak valid/);
 assert.throws(()=>validatePhotos(Array(6).fill({})),/Maksimal/);
 const item=mutateReport('create',body(),null,reporter,accounts,[],now).item; item.photoCount=15;
 assert.throws(()=>mutateReport('update',item,item,admin,accounts,[{}],now),/maksimal 15/);
});
test('report, history and outbox are committed together; create retry does not duplicate',async()=>{
 const db=fakeFirestore(); const input=body(); const context={db,user:reporter,accounts,upload:async()=>[],cleanup:async()=>{}};
 const created=await executeFirestore('create',input,context);
 await executeFirestore('create',input,context);
 assert.equal([...db.data.keys()].filter(k=>k.startsWith(REPORTS+'/')&&!k.includes('/history/')).length,1);
 assert.equal([...db.data.keys()].filter(k=>k.startsWith(BACKUPS+'/')).length,1);
 assert.equal([...db.data.keys()].filter(k=>k.includes('/history/')).length,1);
 await assert.rejects(executeFirestore('update',{...created.data,version:0},context),e=>e.code===409);
 assert.equal((await executeFirestore('detail',{id:created.id},context)).history.length,1);
});
test('backup failure persists retry without rolling back report; retry success removes schedule',async()=>{
 const db=fakeFirestore(); const context={db,user:reporter,accounts,upload:async()=>[],cleanup:async()=>{}};
 const created=await executeFirestore('create',body(),context);
 const id=created.backupJobId;
 assert.equal((await syncBackupJob(id,{db,send:async()=>{throw Error('offline');}})).success,false);
 assert.ok(db.data.get(`${REPORTS}/${created.id}`));
 assert.equal(db.data.get(`${BACKUPS}/${id}`).state,'failed');
 assert.equal((await syncBackupJob(id,{db,force:true,send:async()=>({status:'success'})})).success,true);
 assert.equal(db.data.get(`${BACKUPS}/${id}`).state,'done');
 assert.equal(db.data.get(`${BACKUPS}/${id}`).nextAttemptAt,undefined);
 assert.equal((await syncBackupJob(id,{db,send:async()=>{throw Error();}})).skipped,true);
});
test('cron rejects missing or weak secret and backoff is bounded',()=>{
 const secret='x'.repeat(64); assert.equal(cronAuthorized(`Bearer ${secret}`,secret),true);
 for(const header of [null,'Bearer wrong',`Bearer ${secret}extra`]) assert.equal(cronAuthorized(header,secret),false);
 assert.equal(cronAuthorized('Bearer short','short'),false);
 assert.ok(retryDelay(20)<=86400000);
});
