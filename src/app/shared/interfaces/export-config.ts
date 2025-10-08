export interface ExportColumn {
  key: string;
  label: string;
  enabled: boolean;
  isCalculated?: boolean;
}

export interface ExportConfig {
  columns: ExportColumn[];
  includeCalculatedFields: boolean;
  fileName: string;
}