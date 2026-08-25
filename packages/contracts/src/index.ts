export type ApiResponse<T> = {
  data: T;
  meta: {
    requestId: string;
  };
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    requestId: string;
  };
};

