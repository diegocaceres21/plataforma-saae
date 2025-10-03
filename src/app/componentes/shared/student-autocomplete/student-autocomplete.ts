import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { StudentSearchResult, StudentAutocompleteState } from '../../../interfaces/student-search';
import '../../../interfaces/electron-api';

@Component({
  selector: 'app-student-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-autocomplete.html',
  styleUrl: './student-autocomplete.scss'
})
export class StudentAutocompleteComponent implements OnInit, OnDestroy {
  @Input() placeholder: string = 'Buscar estudiante por carnet o nombre';
  @Input() excludedCIs: string[] = []; // CIs to exclude from results
  @Input() disabled: boolean = false;
  @Output() studentSelected = new EventEmitter<StudentSearchResult>();
  
  autocompleteState: StudentAutocompleteState = {
    query: '',
    results: [],
    isLoading: false,
    isOpen: false,
    selectedIndex: -1
  };
  
  private searchSubject = new Subject<string>();
  
  ngOnInit() {
    this.initializeSearchSubject();
  }
  
  ngOnDestroy() {
    this.searchSubject.complete();
  }
  
  private initializeSearchSubject() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(async (query) => {
        // Always execute search if query is not empty
        if (query && query.trim().length > 0) {
          try {
            await this.searchStudents(query.trim());
          } catch (error) {
            console.error('Search error:', error);
            this.autocompleteState.isLoading = false;
            this.autocompleteState.results = [];
          }
        } else {
          // Empty query - clear results
          this.autocompleteState.isLoading = false;
          this.autocompleteState.results = [];
          this.autocompleteState.isOpen = false;
        }
        return query;
      }),
      catchError(error => {
        console.error('Search pipeline error:', error);
        this.autocompleteState.isLoading = false;
        this.autocompleteState.results = [];
        return of('');
      })
    ).subscribe();
  }
  
  onInputChange(query: string) {
    this.autocompleteState.query = query;
    
    if (query.trim().length > 0) {
      // Set loading state and open dropdown
      this.autocompleteState.isLoading = true;
      this.autocompleteState.isOpen = true;
      // Trigger search with debounce
      this.searchSubject.next(query);
    } else {
      // Empty input - clear everything
      this.autocompleteState.isOpen = false;
      this.autocompleteState.results = [];
      this.autocompleteState.isLoading = false;
      this.searchSubject.next(''); // Clear the subject
    }
  }
  
  private async searchStudents(query: string): Promise<void> {
    try {
      if (!window.academicoAPI?.obtenerPersonasPorCarnet) {
        throw new Error('academicoAPI not available');
      }
      
      const searchResults: StudentSearchResult[] = [];
      
      try {
        const personas = await window.academicoAPI.obtenerPersonasPorCarnet(query);
        
        for (const persona of personas) {
          const carnet = persona.documentoIdentidad || persona.carnet || query;
          
          // Exclude students that are in the excluded list
          if (!this.excludedCIs.includes(carnet)) {
            searchResults.push({
              id: persona.id,
              carnet: carnet,
              nombre: persona.nombreCompleto || persona.nombre || 'Nombre no disponible',
              carrera: 'Información se cargará al procesar',
              creditos: 0
            });
          }
        }
      } catch (error) {
        console.error('Error fetching personas:', error);
      }
      
      this.autocompleteState.results = searchResults;
      this.autocompleteState.isLoading = false;
      
    } catch (error) {
      console.error('Error searching students:', error);
      this.autocompleteState.results = [];
      this.autocompleteState.isLoading = false;
    }
  }
  
  selectStudent(student: StudentSearchResult) {
    this.studentSelected.emit(student);
    this.clearInput();
  }
  
  clearInput() {
    this.autocompleteState.query = '';
    this.autocompleteState.isOpen = false;
    this.autocompleteState.selectedIndex = -1;
    this.autocompleteState.results = [];
  }
  
  closeAutocomplete() {
    // Delay to allow click events to fire
    setTimeout(() => {
      this.autocompleteState.isOpen = false;
    }, 200);
  }
  
  onInputKeyDown(event: KeyboardEvent) {
    if (!this.autocompleteState.isOpen || this.autocompleteState.results.length === 0) {
      return;
    }
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.autocompleteState.selectedIndex = 
          Math.min(this.autocompleteState.selectedIndex + 1, this.autocompleteState.results.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.autocompleteState.selectedIndex = Math.max(this.autocompleteState.selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.autocompleteState.selectedIndex >= 0) {
          this.selectStudent(this.autocompleteState.results[this.autocompleteState.selectedIndex]);
        }
        break;
      case 'Escape':
        this.autocompleteState.isOpen = false;
        break;
    }
  }
}
