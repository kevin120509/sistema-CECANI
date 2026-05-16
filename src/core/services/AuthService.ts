import { IAuthService } from '@/core/domain/services/IAuthService';

export class AuthService {
  constructor(private authAdapter: IAuthService) {}

  async loginDirectora(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    try {
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      if (!email || !password) {
        return { error: 'Correo y contraseña son obligatorios.' };
      }

      await this.authAdapter.loginDirectora(email, password);
      return { success: true };
    } catch (error: any) {
      console.error('Login Error:', error);
      return { error: error.message || 'Error inesperado al iniciar sesión.' };
    }
  }

  async registrarDirectora(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    try {
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      const nombre = formData.get('nombre') as string;

      if (!email || !password || !nombre) {
        return { error: 'Todos los campos son obligatorios.' };
      }

      await this.authAdapter.registrarDirectora(email, password, nombre);
      return { success: true };
    } catch (error: any) {
      return { error: error.message || 'Error inesperado al registrar.' };
    }
  }
}
