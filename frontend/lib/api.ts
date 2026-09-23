function apiBase() {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:4000/api`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
}

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("sv_token") || "";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  } catch {
    throw new Error("Backend nahi mil raha. Confirm karo: API http://localhost:4000 chal rahi ho.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { message?: string | string[] }).message;
    throw new Error(Array.isArray(message) ? message.join(", ") : message || "Request failed");
  }
  return data as T;
}
