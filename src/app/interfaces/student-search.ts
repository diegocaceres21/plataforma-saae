export interface StudentSearchResult {
  id: string;
  carnet: string;
  nombre: string;
  carrera?: string;
  creditos?: number;
}

export interface StudentAutocompleteState {
  query: string;
  results: StudentSearchResult[];
  isLoading: boolean;
  isOpen: boolean;
  selectedIndex: number;
}