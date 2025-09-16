import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../servicios/toast';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      @for (toast of toasts; track toast.id) {
        <div 
          class="transform transition-all duration-300 ease-in-out animate-slide-in"
          [class]="getToastClasses(toast.type)">
          
          <!-- Toast Header -->
          <div class="flex items-start">
            <div class="flex-shrink-0 mr-3">
              <svg class="w-5 h-5" [class]="getIconClasses(toast.type)" fill="currentColor" viewBox="0 0 20 20">
                <!-- Success Icon -->
                @if (toast.type === 'success') {
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                }
                <!-- Error Icon -->
                @if (toast.type === 'error') {
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                }
                <!-- Warning Icon -->
                @if (toast.type === 'warning') {
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                }
                <!-- Info Icon -->
                @if (toast.type === 'info') {
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                }
              </svg>
            </div>
            
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold" [class]="getTitleClasses(toast.type)">
                {{ toast.title }}
              </p>
              <p class="text-sm mt-1" [class]="getMessageClasses(toast.type)">
                {{ toast.message }}
              </p>
            </div>
            
            <button 
              (click)="removeToast(toast.id)"
              class="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors duration-200">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
          
          <!-- Progress Bar -->
          @if (toast.showProgress && toast.duration) {
            <div class="mt-2 w-full bg-gray-200 rounded-full h-1">
              <div 
                class="h-1 rounded-full transition-all ease-linear"
                [class]="getProgressClasses(toast.type)"
                [style.animation]="'shrink ' + toast.duration + 'ms linear'">
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes shrink {
      from {
        width: 100%;
      }
      to {
        width: 0%;
      }
    }

    .animate-slide-in {
      animation: slide-in 0.3s ease-out;
    }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subscription?: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.subscription = this.toastService.getToasts().subscribe((toasts: Toast[]) => {
      this.toasts = toasts;
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  removeToast(id: string) {
    this.toastService.remove(id);
  }

  getToastClasses(type: string): string {
    const baseClasses = 'bg-white border-l-4 rounded-lg shadow-lg p-4 max-w-sm';
    const typeClasses = {
      success: 'border-green-500',
      error: 'border-red-500',
      warning: 'border-yellow-500',
      info: 'border-blue-500'
    };
    return `${baseClasses} ${typeClasses[type as keyof typeof typeClasses]}`;
  }

  getIconClasses(type: string): string {
    const typeClasses = {
      success: 'text-green-500',
      error: 'text-red-500',
      warning: 'text-yellow-500',
      info: 'text-blue-500'
    };
    return typeClasses[type as keyof typeof typeClasses];
  }

  getTitleClasses(type: string): string {
    const typeClasses = {
      success: 'text-green-800',
      error: 'text-red-800',
      warning: 'text-yellow-800',
      info: 'text-blue-800'
    };
    return typeClasses[type as keyof typeof typeClasses];
  }

  getMessageClasses(type: string): string {
    const typeClasses = {
      success: 'text-green-700',
      error: 'text-red-700',
      warning: 'text-yellow-700',
      info: 'text-blue-700'
    };
    return typeClasses[type as keyof typeof typeClasses];
  }

  getProgressClasses(type: string): string {
    const typeClasses = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    };
    return typeClasses[type as keyof typeof typeClasses];
  }
}