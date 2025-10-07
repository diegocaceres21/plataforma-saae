import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService, Usuario, CreateUserData, UpdateUserData } from '../../servicios/user.service';
import { AuthService } from '../../servicios/auth';

@Component({
  selector: 'app-administracion',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './administracion.html',
  styleUrl: './administracion.scss'
})
export class AdministracionComponent implements OnInit {
  userService = inject(UserService);
  authService = inject(AuthService);
  router = inject(Router);

  usuarios: Usuario[] = [];
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Para modal de crear/editar usuario
  showModal = false;
  modalTitle = '';
  isEditing = false;
  currentUserId: number | null = null;
  
  // Formulario
  userForm = {
    username: '',
    nombre: '',
    password: '',
    confirmPassword: '',
    rol: 'usuario',
    activo: true
  };

  // Para cambio de contraseña
  showPasswordModal = false;
  passwordForm = {
    newPassword: '',
    confirmPassword: ''
  };

  ngOnInit() {
    this.loadUsers();
  }

  async loadUsers() {
    this.loading = true;
    this.error = null;
    
    const result = await this.userService.getAllUsers();
    
    if (result.success) {
      this.usuarios = result.users || [];
    } else {
      this.error = result.error || 'Error al cargar usuarios';
    }
    
    this.loading = false;
  }

  openCreateModal() {
    this.resetForm();
    this.modalTitle = 'Crear Nuevo Usuario';
    this.isEditing = false;
    this.showModal = true;
  }

  openEditModal(usuario: Usuario) {
    this.userForm = {
      username: usuario.username,
      nombre: usuario.nombre,
      password: '',
      confirmPassword: '',
      rol: usuario.rol,
      activo: usuario.activo
    };
    this.modalTitle = 'Editar Usuario';
    this.isEditing = true;
    this.currentUserId = usuario.id;
    this.showModal = true;
  }

  openPasswordModal(usuario: Usuario) {
    this.currentUserId = usuario.id;
    this.passwordForm = { newPassword: '', confirmPassword: '' };
    this.showPasswordModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.showPasswordModal = false;
    this.resetForm();
    this.clearMessages();
  }

  resetForm() {
    this.userForm = {
      username: '',
      nombre: '',
      password: '',
      confirmPassword: '',
      rol: 'usuario',
      activo: true
    };
    this.currentUserId = null;
  }

  clearMessages() {
    this.error = null;
    this.success = null;
  }

  async saveUser() {
    this.clearMessages();

    // Validaciones
    if (!this.userForm.username.trim() || !this.userForm.nombre.trim()) {
      this.error = 'Usuario y nombre son requeridos';
      return;
    }

    if (!this.isEditing) {
      if (!this.userForm.password) {
        this.error = 'La contraseña es requerida para nuevos usuarios';
        return;
      }
      if (this.userForm.password !== this.userForm.confirmPassword) {
        this.error = 'Las contraseñas no coinciden';
        return;
      }
      if (this.userForm.password.length < 6) {
        this.error = 'La contraseña debe tener al menos 6 caracteres';
        return;
      }
    }

    this.loading = true;

    let result;
    if (this.isEditing && this.currentUserId) {
      const updateData: UpdateUserData = {
        username: this.userForm.username,
        nombre: this.userForm.nombre,
        rol: this.userForm.rol,
        activo: this.userForm.activo
      };
      result = await this.userService.updateUser(this.currentUserId, updateData);
    } else {
      const createData: CreateUserData = {
        username: this.userForm.username,
        nombre: this.userForm.nombre,
        password: this.userForm.password,
        rol: this.userForm.rol
      };
      result = await this.userService.createUser(createData);
    }

    this.loading = false;

    if (result.success) {
      this.success = this.isEditing ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente';
      this.closeModal();
      await this.loadUsers();
    } else {
      this.error = result.error || 'Error al guardar usuario';
    }
  }

  async changePassword() {
    this.clearMessages();

    if (!this.passwordForm.newPassword) {
      this.error = 'La nueva contraseña es requerida';
      return;
    }
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }
    if (this.passwordForm.newPassword.length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    if (!this.currentUserId) return;

    this.loading = true;
    const result = await this.userService.changePassword(this.currentUserId, this.passwordForm.newPassword);
    this.loading = false;

    if (result.success) {
      this.success = 'Contraseña cambiada exitosamente';
      this.closeModal();
    } else {
      this.error = result.error || 'Error al cambiar contraseña';
    }
  }

  async toggleUserStatus(usuario: Usuario) {
    const newStatus = !usuario.activo;
    const result = await this.userService.updateUser(usuario.id, { activo: newStatus });
    
    if (result.success) {
      this.success = `Usuario ${newStatus ? 'activado' : 'desactivado'} exitosamente`;
      await this.loadUsers();
    } else {
      this.error = result.error || 'Error al cambiar estado del usuario';
    }
  }

  async deleteUser(usuario: Usuario) {
    const currentUser = this.authService.getUser();
    if (currentUser && currentUser.id === usuario.id) {
      this.error = 'No puedes eliminar tu propio usuario';
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${usuario.username}"?`)) {
      return;
    }

    this.loading = true;
    const result = await this.userService.deleteUser(usuario.id);
    this.loading = false;

    if (result.success) {
      this.success = 'Usuario eliminado exitosamente';
      await this.loadUsers();
    } else {
      this.error = result.error || 'Error al eliminar usuario';
    }
  }

  getRoleBadgeClass(rol: string): string {
    return rol === 'admin' 
      ? 'bg-red-100 text-red-800' 
      : 'bg-blue-100 text-blue-800';
  }

  getStatusBadgeClass(activo: boolean): string {
    return activo 
      ? 'bg-green-100 text-green-800' 
      : 'bg-gray-100 text-gray-800';
  }
}