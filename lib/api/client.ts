export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  const url = `${baseUrl}${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Only run in the browser
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      // Optional: automatically handle 401s by clearing token and redirecting
      // localStorage.removeItem("token");
      // window.location.href = "/login";
    }

    let errorData;
    try {
      errorData = await response.json();
    } catch {
      // If the response is not JSON, use the status text
      throw new Error(response.statusText || "An error occurred");
    }

    // Wrap the backend error response into a standard JavaScript Error
    const errorMessage =
      errorData.message || response.statusText || "An error occurred";
    const error = new Error(errorMessage) as any;
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  try {
    return await response.json();
  } catch {
    return {} as T;
  }
}
