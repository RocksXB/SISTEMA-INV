import { addDoc,collection,deleteDoc,doc,getDoc,getDocs,onSnapshot,query,serverTimestamp,updateDoc,where,type Unsubscribe } from 'firebase/firestore'; import { db } from '../lib/firebase'; import type { Character } from '../types';
const chars=collection(db,'characters');
export async function getCharacters(uid:string,isAdmin:boolean){const q=isAdmin?chars:query(chars,where('ownerId','==',uid));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()}) as Character)}
export async function getCharacter(id:string){const s=await getDoc(doc(db,'characters',id));return s.exists()?{id:s.id,...s.data()} as Character:null}
export const subscribeCharacter=(id:string,cb:(v:Character|null)=>void,error:(e:Error)=>void):Unsubscribe=>onSnapshot(doc(db,'characters',id),s=>cb(s.exists()?{id:s.id,...s.data()} as Character:null),error);
export async function saveCharacter(value:Omit<Character,'id'>|Character,id?:string){const {id:_ignored,...fields}=value as Character;void _ignored;const data={...fields,updatedAt:serverTimestamp()};if(id){await updateDoc(doc(db,'characters',id),data);return id}return (await addDoc(chars,{...data,createdAt:serverTimestamp()})).id}
export const deleteCharacter=(id:string)=>deleteDoc(doc(db,'characters',id));
