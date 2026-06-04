export interface ApiRequest {
  method?: string;
  body?: any;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  headersSent?: boolean;
  setHeader(name: string, value: string | string[]): void;
  status(code: number): ApiResponse;
  json(body: any): void;
}
