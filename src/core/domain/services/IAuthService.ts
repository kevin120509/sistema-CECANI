export interface IAuthService {
  loginDirectora(email: string, password: string): Promise<void>;
  registrarDirectora(email: string, password: string, nombre: string): Promise<void>;
}
