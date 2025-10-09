import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, Usuario, CreateUserData, UpdateUserData } from '../../../auth/servicios/user.service';
import { AuthService } from '../../../auth/servicios/auth';
import { LoadingService } from '../../servicios/loading';
import { ToastService } from '../../servicios/toast';
// Loading component is used globally in app root; not needed here

@Component({
  selector: 'app-administracion',
  imports: [CommonModule, FormsModule],
  templateUrl: './administracion.html',
  styleUrl: './administracion.scss'
})
export class AdministracionComponent implements OnInit, AfterViewInit {
  userService = inject(UserService);
  authService = inject(AuthService);
  router = inject(Router);
  loadingService = inject(LoadingService);
  toastService = inject(ToastService);

  usuarios: Usuario[] = [];

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

  ngOnInit() {}

  ngAfterViewInit() {
    // Defer to next macrotask to ensure the global loader is mounted and subscribed
    setTimeout(() => this.loadUsers());
  }

  async loadUsers() {
    this.loadingService.show();
    try {
      const result = await this.userService.getAllUsers();

      if (result.success) {
        this.usuarios = result.users || [];
      } else {
        this.toastService.error('Error', result.error || 'Error al cargar usuarios');
      }
    } catch (err: any) {
      this.toastService.error('Error', err?.message || 'Error al cargar usuarios');
    } finally {
      this.loadingService.hide();
    }
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

  async saveUser() {
    // Validaciones
    if (!this.userForm.username.trim() || !this.userForm.nombre.trim()) {
      this.toastService.warning('Validación', 'Usuario y nombre son requeridos');
      return;
    }

    if (!this.isEditing) {
      if (!this.userForm.password) {
        this.toastService.warning('Validación', 'La contraseña es requerida para nuevos usuarios');
        return;
      }
      if (this.userForm.password !== this.userForm.confirmPassword) {
        this.toastService.warning('Validación', 'Las contraseñas no coinciden');
        return;
      }
      if (this.userForm.password.length < 6) {
        this.toastService.warning('Validación', 'La contraseña debe tener al menos 6 caracteres');
        return;
      }
    }

    this.loadingService.show();
    try {
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

      if (result.success) {
        this.toastService.success(
          'Éxito', 
          this.isEditing ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente',
          3000
        );
        this.closeModal();
        await this.loadUsers();
      } else {
        this.toastService.error('Error', result.error || 'Error al guardar usuario');
      }
    } catch (err: any) {
      this.toastService.error('Error', err?.message || 'Error al guardar usuario');
    } finally {
      this.loadingService.hide();
    }
  }

  async changePassword() {
    if (!this.passwordForm.newPassword) {
      this.toastService.warning('Validación', 'La nueva contraseña es requerida');
      return;
    }
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.toastService.warning('Validación', 'Las contraseñas no coinciden');
      return;
    }
    if (this.passwordForm.newPassword.length < 6) {
      this.toastService.warning('Validación', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!this.currentUserId) return;

    this.loadingService.show();
    try {
      const result = await this.userService.changePassword(this.currentUserId, this.passwordForm.newPassword);
      if (result.success) {
        this.toastService.success('Éxito', 'Contraseña cambiada exitosamente', 3000);
        this.closeModal();
      } else {
        this.toastService.error('Error', result.error || 'Error al cambiar contraseña');
      }
    } catch (err: any) {
      this.toastService.error('Error', err?.message || 'Error al cambiar contraseña');
    } finally {
      this.loadingService.hide();
    }
  }

  async toggleUserStatus(usuario: Usuario) {
    this.loadingService.show();
    try {
      const newStatus = !usuario.activo;
      const result = await this.userService.updateUser(usuario.id, { activo: newStatus });
      if (result.success) {
        this.toastService.success('Éxito', `Usuario ${newStatus ? 'activado' : 'desactivado'} exitosamente`, 3000);
        await this.loadUsers();
      } else {
        this.toastService.error('Error', result.error || 'Error al cambiar estado del usuario');
      }
    } catch (err: any) {
      this.toastService.error('Error', err?.message || 'Error al cambiar estado del usuario');
    } finally {
      this.loadingService.hide();
    }
  }

  async deleteUser(usuario: Usuario) {
    const currentUser = this.authService.getUser();
    if (currentUser && currentUser.id === usuario.id) {
      this.toastService.warning('Advertencia', 'No puedes eliminar tu propio usuario');
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${usuario.username}"?`)) {
      return;
    }

    this.loadingService.show();
    try {
      const result = await this.userService.deleteUser(usuario.id);
      if (result.success) {
        this.toastService.success('Éxito', 'Usuario eliminado exitosamente', 3000);
        await this.loadUsers();
      } else {
        this.toastService.error('Error', result.error || 'Error al eliminar usuario');
      }
    } catch (err: any) {
      this.toastService.error('Error', err?.message || 'Error al eliminar usuario');
    } finally {
      this.loadingService.hide();
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
