import { Component, Input, Output, EventEmitter, forwardRef, ElementRef, HostListener, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DropdownManagerService } from '../../servicios/dropdown-manager.service';
import { takeUntil, Subject } from 'rxjs';

export interface MultiSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-multi-select-dropdown',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectDropdownComponent),
      multi: true
    }
  ],
  templateUrl: './multi-select-dropdown.html',
  styleUrl: './multi-select-dropdown.scss'
})
export class MultiSelectDropdownComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() options: MultiSelectOption[] = [];
  @Input() placeholder = 'Seleccionar opciones';
  @Input() selectAllText = 'Seleccionar todas';
  @Input() disabled = false;
  @Input() maxHeight = 'max-h-60';
  @Input() width = 'w-48'; // Default width, can be overridden
  @Input() dropdownId?: string; // Unique identifier for this dropdown

  @Output() selectionChange = new EventEmitter<string[]>();

  selectedValues: string[] = [];
  isOpen = false;

  private onChange = (value: string[]) => {};
  private onTouched = () => {};
  private destroy$ = new Subject<void>();
  private dropdownManager = inject(DropdownManagerService);
  private uniqueId = Math.random().toString(36).substr(2, 9); // Generate unique ID

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    // Subscribe to close other dropdowns events
    this.dropdownManager.closeAllDropdowns
      .pipe(takeUntil(this.destroy$))
      .subscribe((currentDropdownId: string) => {
        // Close this dropdown if it's not the one that triggered the event
        if (this.isOpen && currentDropdownId !== this.getDropdownId()) {
          this.isOpen = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getDropdownId(): string {
    return this.dropdownId || this.uniqueId;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: string[]): void {
    this.selectedValues = value || [];
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Component methods
  toggleDropdown(event: Event): void {
    event.stopPropagation();
    if (!this.disabled) {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        // Notify other dropdowns to close
        this.dropdownManager.closeOtherDropdowns(this.getDropdownId());
        this.onTouched();
      }
    }
  }

  closeDropdown(): void {
    this.isOpen = false;
  }

  toggleOption(value: string): void {
    const index = this.selectedValues.indexOf(value);
    if (index > -1) {
      this.selectedValues.splice(index, 1);
    } else {
      this.selectedValues.push(value);
    }
    this.emitChange();
  }

  selectAll(): void {
    if (this.selectedValues.length === this.options.length) {
      this.selectedValues = [];
    } else {
      this.selectedValues = this.options.map(option => option.value);
    }
    this.emitChange();
  }

  isSelected(value: string): boolean {
    return this.selectedValues.includes(value);
  }

  get isAllSelected(): boolean {
    return this.selectedValues.length === this.options.length && this.options.length > 0;
  }

  get isPartiallySelected(): boolean {
    return this.selectedValues.length > 0 && this.selectedValues.length < this.options.length;
  }

  get displayText(): string {
    if (this.selectedValues.length === 0) return this.placeholder;
    if (this.selectedValues.length === 1) {
      const option = this.options.find(o => o.value === this.selectedValues[0]);
      return option?.label || this.selectedValues[0];
    }
    return `${this.selectedValues.length} opciones seleccionadas`;
  }

  private emitChange(): void {
    this.onChange(this.selectedValues);
    this.selectionChange.emit([...this.selectedValues]);
  }
}
