import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";
export async function login(email: string, password: string) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch {
    throw new Error("E-mail ou senha inválidos. Verifique suas credenciais.");
  }
}
export const logout = () => firebaseSignOut(auth);
