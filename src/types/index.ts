import type { Timestamp } from "firebase/firestore";
export type UserRole = "player" | "admin";
export type ItemCategory =
  | "weapon"
  | "armor"
  | "accessory"
  | "consumable"
  | "tool"
  | "material"
  | "quest"
  | "miscellaneous";
export type ItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";
export type EquipmentSlot =
  | "head"
  | "chest"
  | "hands"
  | "legs"
  | "feet"
  | "mainHand"
  | "offHand"
  | "accessory1"
  | "accessory2"
  | "accessory3"
  | "extra1"
  | "extra2";
export type EncumbranceStatus = "normal" | "loaded" | "heavy" | "overloaded";
export type ItemRequestStatus = "pending" | "approved" | "rejected";
type DateValue = Timestamp | null;
export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt?: DateValue;
  updatedAt?: DateValue;
}
export interface Character {
  id: string;
  ownerId: string;
  name: string;
  nickname?: string;
  avatarUrl?: string;
  description?: string;
  carryingCapacity: number;
  createdAt?: DateValue;
  updatedAt?: DateValue;
}
export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  weight: number;
  imageUrl?: string;
  rarity: ItemRarity;
  stackable: boolean;
  maxStack: number;
  equippable: boolean;
  allowedEquipmentSlots: EquipmentSlot[];
  tags: string[];
  createdAt?: DateValue;
  updatedAt?: DateValue;
}
export interface InventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  carried?: boolean;
  equipped: boolean;
  equipmentSlot: EquipmentSlot | null;
  acquiredAt?: DateValue;
  customName?: string;
  notes?: string;
  updatedAt?: DateValue;
}
export interface HydratedInventoryItem extends InventoryItem {
  definition: ItemDefinition;
}
export interface ItemRequest {
  id: string;
  requestedBy: string;
  characterId: string;
  status: ItemRequestStatus;
  name: string;
  description: string;
  category: ItemCategory;
  weight: number;
  imageUrl?: string;
  rarity: ItemRarity;
  stackable: boolean;
  maxStack: number;
  equippable: boolean;
  allowedEquipmentSlots: EquipmentSlot[];
  tags: string[];
  quantity: number;
  createdAt?: DateValue;
  updatedAt?: DateValue;
  reviewedAt?: DateValue;
  reviewedBy?: string;
  adminNote?: string;
  approvedItemId?: string;
}

export type ItemRequestDraft = Omit<
  ItemRequest,
  | "id"
  | "requestedBy"
  | "characterId"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "reviewedAt"
  | "reviewedBy"
  | "adminNote"
  | "approvedItemId"
>;
