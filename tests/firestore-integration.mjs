// Explicit live smoke test: disposable namespaced Firestore collections, no Firebase Auth writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { executeFirestore, firestoreDb, photoBucket, allowedPhoto } from '../src/lib/server/firestore-store.mjs';
import { REPORTS } from '../src/lib/server/firestore-domain.mjs';
const native=firestoreDb(); const run=`audit_${randomUUID().replaceAll('-','')}`;
const used=new Set();
const db={collection:(name)=>{used.add(`${run}_${name}`);return native.collection(`${run}_${name}`);},runTransaction:(work)=>native.runTransaction(work)};
const reporter={id:`reporter-${run}`,nama:'Audit lokal',role:'pelapor',active:true,approval:'approved'};
const admin={id:`admin-${run}`,nama:'Audit admin',role:'admin',active:true,approval:'approved'};
const outsider={id:`other-${run}`,nama:'Audit lain',role:'pelapor',active:true,approval:'approved'};
const context={user:reporter,accounts:[reporter,admin,outsider],db};
let photoPaths=[];
try {
 const png=await readFile(new URL('../public/icons/komplain-192.png',import.meta.url));
 const payload={requestId:randomUUID(),tanggal:'2026-10-08',dokter:'Dokter fixture',rumahSakit:'RS fixture',team:'Audit',tindakan:'Uji',komplain:'Data disposable untuk smoke test.',statusCase:'Ada Kendala',photos:[{base64:png.toString('base64'),mimeType:'image/png',filename:'fixture.png'}]};
 console.log('Starting disposable report transaction.');
 const created=await executeFirestore('create',payload,context);
 console.log('Report and photo written; checking conflict handling.');
 const stored=(await db.collection(REPORTS).doc(created.id).get()).data();
 photoPaths=stored.photoRefs.map(p=>p.path);
 assert.equal(stored.photoCount,1);
 assert.equal((await executeFirestore('create',payload,context)).id,created.id);
 const photo=await allowedPhoto(created.id,reporter,photoPaths[0],null,db);
 const [bytes]=await photoBucket().file(photo.path).download(); assert.deepEqual(bytes,png);
 await assert.rejects(allowedPhoto(created.id,outsider,photo.path,null,db),e=>e.code===404);
 const changes=await Promise.allSettled([executeFirestore('update',{...created.data,dokter:'Dokter update A'},context),executeFirestore('update',{...created.data,dokter:'Dokter update B'},context)]);
 assert.equal(changes.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(changes.find(r=>r.status==='rejected').reason.code,409);
 const details=await executeFirestore('detail',{id:created.id},context); assert.equal(details.history.length,2);
 const delegated=await executeFirestore('assign',{id:created.id,version:2,picId:reporter.id},{...context,user:admin});
 const done=await executeFirestore('followUp',{status:'C3 - Moderate',id:created.id,version:delegated.data.version,statusPenanganan:'Selesai',jalanKeluar:'Uji selesai'},context);
 assert.ok(done.data.selesaiPada);
 const archived=await executeFirestore('delete',{id:created.id,version:done.data.version},{...context,user:admin}); assert.ok(archived.data.deletedAt);
 assert.equal((await executeFirestore('list',{},context)).data.length,0);
 console.log('PASS: live Firestore + private Storage, transaction conflicts, create retry, per-report photo access, delegated PIC, completion, archive.');
} finally {
 for (const collection of used) await native.recursiveDelete(native.collection(collection));
 await Promise.all(photoPaths.map(path=>photoBucket().file(path).delete({ignoreNotFound:true})));
 console.log('Disposable Firestore collections and Storage photos cleaned. No production reports/accounts changed.');
}
