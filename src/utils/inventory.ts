import { ENCUMBRANCE_CONFIG } from '../config/encumbrance';
import type { EncumbranceStatus, EquipmentSlot, HydratedInventoryItem, InventoryItem, ItemDefinition } from '../types';
export const calculateStackWeight=(weight:number,quantity:number)=>Math.max(0,weight)*Math.max(0,quantity);
export const calculateInventoryWeight=(items:ReadonlyArray<Pick<HydratedInventoryItem,'quantity'|'definition'>>)=>items.reduce((sum,item)=>sum+calculateStackWeight(item.definition.weight,item.quantity),0);
export const calculateEncumbrancePercentage=(weight:number,capacity:number)=>capacity<=0?(weight>0?100:0):Math.max(0,(weight/capacity)*100);
export const getEncumbranceStatus=(percentage:number):EncumbranceStatus=>ENCUMBRANCE_CONFIG.find(x=>percentage>=x.min)?.status??'normal';
export const formatWeight=(weight:number)=>`${Number(Math.max(0,weight).toFixed(3))} kg`;
export function canEquipItem(item:ItemDefinition,slot:EquipmentSlot,inventory:ReadonlyArray<InventoryItem>,inventoryId?:string){
 if(!item.equippable)return {allowed:false,reason:'Este item não pode ser equipado.'};
 const target=inventory.find(x=>x.id===inventoryId);
 if(target&&target.quantity!==1)return {allowed:false,reason:'Somente uma unidade isolada pode ser equipada.'};
 if(!item.allowedEquipmentSlots.includes(slot))return {allowed:false,reason:'Slot incompatível com este item.'};
 const occupied=inventory.some(x=>x.equipped&&x.equipmentSlot===slot&&x.id!==inventoryId);
 if(occupied)return {allowed:false,reason:'O slot selecionado já está ocupado.'};
 return {allowed:true as const};
}
