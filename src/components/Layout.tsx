import { CalendarDays, LogOut, Shield, ShieldHalf, UserRound, UsersRound } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { logout } from "../services/authService";
import { clearPortraitSession } from "../services/aparicoesService";
export function Layout() {
  const { profile } = useAuth();
  const signOut = () => void clearPortraitSession().catch(() => {}).then(logout);
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
          <NavLink to="/aparicoes" className="npc-nav"><UsersRound /> Personagens</NavLink>
          <NavLink to="/esquadroes" className="squad-nav"><ShieldHalf /> Esquadrões</NavLink>
          <NavLink to="/calendario" className="calendar-nav"><CalendarDays /> Calendário</NavLink>
          {profile?.role === "admin" && (
            <Link to="/admin">
              <Shield /> Controle
            </Link>
          )}
          <span>
            <UserRound /> {profile?.displayName || profile?.email}
          </span>
          <button onClick={signOut}>
            <LogOut /> Sair
          </button>
        </nav>
      </header>
      <Outlet />
      <footer className="mobile-nav">
        <Link to="/characters">Inventário</Link>
        <NavLink to="/aparicoes" className="npc-nav">Personagens</NavLink>
        <NavLink to="/esquadroes" className="squad-nav">Esquadrões</NavLink>
        <NavLink to="/calendario" className="calendar-nav">Calendário</NavLink>
        {profile?.role === "admin" && <Link to="/admin">Controle</Link>}
        <button onClick={signOut}>Sair</button>
      </footer>
    </>
  );
}
