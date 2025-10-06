import { Injectable } from '@angular/core';

interface StoredAuth {
  token: string;
  user: { id: number; username: string; nombre: string; rol: string };
  uniqueCode?: string; // for SIAAN
  exp: number; // epoch seconds
  siaanToken?: string | null;
  siaanTokenExpiry?: string | null; // raw header value
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storageKey = 'auth_jwt';


  generarCadenaAleatoria() {
    const e = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let t = "";
    for (let o = 0; o < 15; o++)
      t += e.charAt(Math.floor(Math.random() * e.length));
    return t
  }

  async login(username: string, password: string): Promise<{ success: boolean; error?: string; siaanError?: string }> {
    if (!window.authAPI) return { success: false, error: 'Auth API no disponible' };
    const res = await window.authAPI.login(username, password);
    if (res.error || !res.token || !res.user) {
      return { success: false, error: res.error || 'Error desconocido' };
    }
    // Decodificar payload exp roughly (simple parse of JWT second segment)
    try {
      const payloadStr = atob(res.token.split('.')[1]);
      const payload = JSON.parse(payloadStr);
      const auth: StoredAuth = { token: res.token, user: res.user, exp: payload.exp };

      // Intentar login externo SIAAN (silencioso; no bloquea login interno si falla)
      let siaanError: string | undefined;
      if (window.academicoAPI?.logInSiaan) {
        try {
          const uniqueCode = this.generarCadenaAleatoria();
          const siaanResp = await window.academicoAPI.logInSiaan({ Email: username, UniqueCode: uniqueCode, ServiceCode:"1" });
          console.log('SIAAN login response:', siaanResp);
          if (!siaanResp.error) {
            auth.uniqueCode = uniqueCode;
            auth.siaanToken = siaanResp.token || null;
            auth.siaanTokenExpiry = siaanResp.tokenExpiry || null;
            // Notificar al proceso principal para que use estos tokens dinámicos
            if (window.academicoAPI?.setExternalTokens) {
              window.academicoAPI.setExternalTokens({
                token: auth.siaanToken || undefined,
                uniqueCode: auth.uniqueCode,
                tokenExpiry: auth.siaanTokenExpiry || undefined,
              });
            }
          } else {
            siaanError = siaanResp.error;
          }
        } catch (err: any) {
          siaanError = err?.message || 'Error login SIAAN';
        }
      }

      sessionStorage.setItem(this.storageKey, JSON.stringify(auth));
      return { success: true, siaanError };
    } catch (e) {
      return { success: false, error: 'Token inválido' };
    }
  }

  logout(): void {
    sessionStorage.removeItem(this.storageKey);
  }
  
  getAuth(): StoredAuth | null {
    const raw = sessionStorage.getItem(this.storageKey);
    if (!raw) return null;
    try { return JSON.parse(raw) as StoredAuth; } catch { return null; }
  }

  isAuthenticated(): boolean {
    const auth = this.getAuth();
    if (!auth) return false;
    const now = Math.floor(Date.now() / 1000);
    if (auth.exp <= now) {
      this.logout();
      return false;
    }
    return true;
  }

  async verifyServer(): Promise<boolean> {
    const auth = this.getAuth();
    if (!auth || !window.authAPI) return false;
    const res = await window.authAPI.verify(auth.token);
    if (!res.valid) {
      this.logout();
      return false;
    }
    return true;
  }
}
