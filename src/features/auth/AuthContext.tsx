import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getUserProfile } from "../../services/userService";
import type { UserProfile } from "../../types";
interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}
const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  error: null,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });
  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user)
          return setState({
            user: null,
            profile: null,
            loading: false,
            error: null,
          });
        try {
          const profile = await getUserProfile(user.uid);
          setState({
            user,
            profile,
            loading: false,
            error: profile
              ? null
              : "Perfil não encontrado. Contate o administrador.",
          });
        } catch {
          setState({
            user,
            profile: null,
            loading: false,
            error: "Não foi possível carregar seu perfil.",
          });
        }
      }),
    [],
  );
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
