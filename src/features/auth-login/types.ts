export interface LoginFormProps {
  redirectTarget: string;
}

export interface LoginResponse {
  errors?: Array<{ message?: string }>;
  message?: string;
}
