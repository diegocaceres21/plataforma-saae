
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class Academico {
  // Call database via IPC
  async getStudent(studentId: string): Promise<any> {
    // @ts-ignore
    return await window.academicoAPI.getStudent(studentId);
  }

  // Call external API via IPC
  async fetchExternal(endpoint: string, params?: any): Promise<any> {
    // @ts-ignore
    return await window.academicoAPI.fetchExternal(endpoint, params);
  }
}
