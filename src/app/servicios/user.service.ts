import { Injectable } from '@angular/core';

export interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  username: string;
  nombre: string;
  password: string;
  rol: string;
}

export interface UpdateUserData {
  username?: string;
  nombre?: string;
  rol?: string;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  async getAllUsers(): Promise<{ success: boolean; users?: Usuario[]; error?: string }> {
    if (!window.userAPI) {
      return { success: false, error: 'User API no disponible' };
    }

    try {
      const result = await window.userAPI.getAllUsers();
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, users: result.users || [] };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al obtener usuarios' };
    }
  }

  async getUserById(id: number): Promise<{ success: boolean; user?: Usuario; error?: string }> {
    if (!window.userAPI) {
      return { success: false, error: 'User API no disponible' };
    }

    try {
      const result = await window.userAPI.getUserById(id);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al obtener usuario' };
    }
  }

  async createUser(data: CreateUserData): Promise<{ success: boolean; user?: Usuario; error?: string }> {
    if (!window.userAPI) {
      return { success: false, error: 'User API no disponible' };
    }

    try {
      const result = await window.userAPI.createUser(data);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al crear usuario' };
    }
  }

  async updateUser(id: number, data: UpdateUserData): Promise<{ success: boolean; user?: Usuario; error?: string }> {
    if (!window.userAPI) {
      return { success: false, error: 'User API no disponible' };
    }

    try {
      const result = await window.userAPI.updateUser(id, data);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al actualizar usuario' };
    }
  }

  async changePassword(id: number, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!window.userAPI) {
      return { success: false, error: 'User API no disponible' };
    }

    try {
      const result = await window.userAPI.changePassword(id, newPassword);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al cambiar contraseña' };
    }
  }

  async deleteUser(id: number): Promise<{ success: boolean; error?: string }> {
    if (!window.userAPI) {
      return { success: false, error: 'User API no disponible' };
    }

    try {
      const result = await window.userAPI.deleteUser(id);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al eliminar usuario' };
    }
  }
}