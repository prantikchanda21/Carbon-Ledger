import type { Experiment } from './types.ts';
import { validateInput } from './engine.ts';
const DB='carbon-treasury-experiments-v5';
async function open():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore('experiments',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Browser storage unavailable; use JSON export instead'));});
}
export async function saveExperiment(value:Experiment):Promise<void> {
  validateInput(value.input);const db=await open();
  try {await new Promise<void>((resolve,reject)=>{const tx=db.transaction('experiments','readwrite');tx.objectStore('experiments').put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('Could not save: storage may be full'));tx.onabort=()=>reject(new Error('Save aborted'));});}finally{db.close();}
}
export async function listExperiments():Promise<Experiment[]> {
  const db=await open();try{return await new Promise<Experiment[]>((resolve,reject)=>{const r=db.transaction('experiments').objectStore('experiments').getAll();r.onsuccess=()=>resolve((r.result as Experiment[]).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));r.onerror=()=>reject(new Error('Could not read experiments'));});}finally{db.close();}
}
export async function deleteExperiment(id:string):Promise<void> {
  const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('experiments','readwrite');tx.objectStore('experiments').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('Delete failed'));});}finally{db.close();}
}
export function download(name:string,content:string|Uint8Array,type='application/json') {
  const data=typeof content==='string'?content:new Uint8Array(content).buffer;
  const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
