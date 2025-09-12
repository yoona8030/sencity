// src/context/AuthContext.tsx
import React, { createContext, useContext } from 'react';
type AuthContextType = { dummy?: boolean };
const AuthContext = createContext<AuthContextType>({});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ dummy: true }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
