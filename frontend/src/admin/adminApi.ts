const API_URL = import.meta.env.VITE_API_URL || "";

export async function adminApi<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
  } catch {
    throw new Error(
      "Cannot reach the API server. From the project root run: npm run dev (backend must be on port 7010)."
    );
  }

  if (res.status === 204 || res.status === 205) return {} as T;

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (res.status === 502 || res.status === 503) {
        throw new Error(
          "Backend is not running. Stop and restart with npm run dev from the project root."
        );
      }
      if (res.status === 413) {
        throw new Error("Image file is too large. Try a smaller photo (under 8 MB).");
      }
      throw new Error(`Request failed (${res.status}). Restart the backend and try again.`);
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Session expired. Log out via the website Admin menu and sign in again.");
    }
    if (res.status === 403) {
      throw new Error("Access denied. Sign in with the website admin account.");
    }
    if (res.status === 400 && Array.isArray(data.issues)) {
      const msg = (data.issues as Array<{ path?: string[]; message?: string }>)
        .map((i) => `${(i.path || []).join(".") || "field"}: ${i.message}`)
        .join("; ");
      throw new Error(msg || String(data.message || "Validation error"));
    }
    if (res.status === 413) {
      throw new Error("Image file is too large. Try a smaller photo (under 8 MB).");
    }
    throw new Error(String(data.message || `Request failed (${res.status})`));
  }

  return data as T;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Resize/compress before upload so base64 JSON stays under server limits. */
export async function prepareTrainerImageFile(file: File, maxEdge = 1600): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88)
  );
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export async function uploadTrainerImage(
  trainerId: string,
  token: string,
  file: File,
  field: "profile" | "gallery"
) {
  const prepared = await prepareTrainerImageFile(file);
  const data = await fileToBase64(prepared);
  return adminApi<{ url: string; trainer: Record<string, unknown> }>(
    `/api/admin/site/trainers/${trainerId}/upload-image`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ data, filename: prepared.name, field })
    }
  );
}

export async function uploadProgramImage(
  token: string,
  file: File,
  programId?: string
) {
  const prepared = await prepareTrainerImageFile(file);
  const data = await fileToBase64(prepared);
  const path = programId
    ? `/api/admin/site/programs/${programId}/upload-image`
    : "/api/admin/site/programs/upload-image";
  return adminApi<{ url: string; program?: Record<string, unknown> }>(path, token, {
    method: "POST",
    body: JSON.stringify({ data, filename: prepared.name })
  });
}

export async function checkAdminApiHealth(): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    if (!res.ok) return { ok: false, message: "API health check failed" };
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Backend offline — run npm run dev from the project root (ports 7010 + 7011)."
    };
  }
}
