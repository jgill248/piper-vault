export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'user' | 'admin';
  createdAt: Date;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  email?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
