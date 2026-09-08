import { LogOut, Shield, UserRound } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { logout } from "../services/authService";
export function Layout() {
  const { profile } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/characters" className="brand">
          <span className="brand-mark">S</span>
          <div>
            <b>SISTEMA</b>
            <small>INVENTORY NETWORK</small>
          </div>
        </Link>
        <nav>
          {profile?.role === "admin" && (
            <Link to="/admin">
              <Shield /> Controle
            </Link>
          )}
          <span>
            <UserRound /> {profile?.displayName || profile?.email}
          </span>
          <button onClick={() => void logout()}>
            <LogOut /> Sair
          </button>
        </nav>
      </header>
      <Outlet />
      <footer className="mobile-nav">
        <Link to="/characters">Personagens</Link>
        {profile?.role === "admin" && <Link to="/admin">Controle</Link>}
        <button onClick={() => void logout()}>Sair</button>
      </footer>
    </>
  );
}
