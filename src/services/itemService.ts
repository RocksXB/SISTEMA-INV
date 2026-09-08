import { addDoc,collection,deleteDoc,doc,getDocs,onSnapshot,serverTimestamp,updateDoc,type Unsubscribe } from 'firebase/firestore'; import { db } from '../lib/firebase'; import type { ItemDefinition } from '../types';
const ref=collection(db,'items');
export const subscribeItems=(cb:(v:ItemDefinition[])=>void,error:(e:Error)=>void):Unsubscribe=>onSnapshot(ref,s=>cb(s.docs.map(d=>({id:d.id,...d.data()}) as ItemDefinition)),error);
export async function getItems(){const s=await getDocs(ref);return s.docs.map(d=>({id:d.id,...d.data()}) as ItemDefinition)}
export async function saveItem(item:Omit<ItemDefinition,'id'>|ItemDefinition,id?:string){const {id:_ignored,...value}=item as ItemDefinition;void _ignored;const data={...value,updatedAt:serverTimestamp()};if(id){await updateDoc(doc(db,'items',id),data);return id}return (await addDoc(ref,{...data,createdAt:serverTimestamp()})).id}
export const deleteItem=(id:string)=>deleteDoc(doc(db,'items',id));
