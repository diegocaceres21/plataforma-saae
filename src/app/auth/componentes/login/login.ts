import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../servicios/auth';
import { OfertaAcademica } from '../../../apoyos-incentivos-becas/servicios/oferta-academica';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  form = {
    username: '',
    password: ''
  };
  isLoading = false;
  error: string | null = null;
  siaanWarning: string | null = null;

  // Update state
  currentVersion: string = '';
  showUpdateModal = false;
  updateInfo: { version?: string; releaseNotes?: string } | null = null;
  isDownloading = false;
  downloadProgress = 0;
  updateReady = false;
  updateError: string | null = null;

  private _onUpdateAvailable = (info: any) => {
    this.updateInfo = info;
    this.showUpdateModal = true;
    this.updateError = null;
  };
  private _onDownloadProgress = (progress: any) => {
    this.downloadProgress = Math.round(progress?.percent ?? 0);
  };
  private _onUpdateDownloaded = (_info: any) => {
    this.isDownloading = false;
    this.updateReady = true;
  };
  private _onUpdateError = (data: any) => {
    this.isDownloading = false;
    this.updateError = data?.message || 'Error al verificar actualizaciones';
  };

  constructor(
    private router: Router,
    private auth: AuthService,
    private ofertaAcademica: OfertaAcademica
  ) {}

  async ngOnInit() {
    const updater = (window as any).updater;
    if (!updater) return;

    try {
      this.currentVersion = await updater.getVersion();
    } catch {
      this.currentVersion = '';
    }

    updater.on('update:available', this._onUpdateAvailable);
    updater.on('update:download-progress', this._onDownloadProgress);
    updater.on('update:downloaded', this._onUpdateDownloaded);
    updater.on('update:error', this._onUpdateError);

    // Trigger check — main process already calls checkForUpdates on startup,
    // but subscribing here after app load may miss the event, so we re-check.
    try { await updater.check(); } catch { /* non-critical */ }
  }

  ngOnDestroy() {
    const updater = (window as any).updater;
    if (!updater) return;
    updater.off('update:available', this._onUpdateAvailable);
    updater.off('update:download-progress', this._onDownloadProgress);
    updater.off('update:downloaded', this._onUpdateDownloaded);
    updater.off('update:error', this._onUpdateError);
  }

  async downloadUpdate() {
    this.isDownloading = true;
    this.downloadProgress = 0;
    this.updateError = null;
    const result = await (window as any).updater?.download();
    if (result?.error) {
      this.isDownloading = false;
      this.updateError = result.error;
    }
  }

  async installUpdate() {
    await (window as any).updater?.install();
  }

  closeUpdateModal() {
    this.showUpdateModal = false;
  }

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
        // Iniciar carga de asignaturas en background (no esperar)
        this.ofertaAcademica.loadAsignaturasData().catch(err => {
          console.warn('Error cargando asignaturas en background:', err);
        });
        
        this.router.navigate(['/menu-principal']);
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
