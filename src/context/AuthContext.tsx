"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type UserRole = "customer" | "staff";

export type AppUser = {
  userId: string;
  role: UserRole;
  customerId?: number | null;
  name?: string;
  email?: string;
  username?: string; 
} | null;

type AuthContextType = {
  user: AppUser;
  setUser: (u: AppUser) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  refreshUser: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser>(null);

  /* ========== Load from localStorage on start ========== */
  useEffect(() => {
    const saved = localStorage.getItem("appUser");
    if (saved) {
      setUserState(JSON.parse(saved));
    }
  }, []);

  /* ========== Wrapped setUser to sync with localStorage ========== */
  const setUser = (u: AppUser) => {
    setUserState(u);
    if (u) {
      localStorage.setItem("appUser", JSON.stringify(u));
    } else {
      localStorage.removeItem("appUser");
    }
  };

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch (e) {
      setUser(null);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("appUser");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);