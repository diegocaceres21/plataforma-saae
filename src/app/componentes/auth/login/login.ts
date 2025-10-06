import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../servicios/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  form = {
    username: '',
    password: ''
  };
  isLoading = false;
  error: string | null = null;
  siaanWarning: string | null = null;

  constructor(private router: Router, private auth: AuthService) {}

  async onSubmit() {
    if (this.isLoading) return;
    this.error = null;
    this.isLoading = true;
    try {
      const res = await this.auth.login(this.form.username.trim(), this.form.password);
      if (res.success) {
        if (res.siaanError) {
          this.siaanWarning = 'Login SIAAN parcial: ' + res.siaanError;
        }
        this.router.navigate(['/menu']);
      } else {
        this.error = res.error || 'Credenciales inválidas';
      }
    } catch (e: any) {
      this.error = e?.message || 'Error en el proceso de autenticación';
    } finally {
      this.isLoading = false;
    }
  }
}
