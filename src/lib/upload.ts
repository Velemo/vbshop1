import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type UploadResult = { url: string | null; error: string | null };

/**
 * Uploads a file to a public storage bucket reporting real progress (0-100).
 */
export async function uploadWithProgress(
  bucket: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { url: null, error: "Precisa iniciar sessão para enviar ficheiros." };

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;

  const errorMessage = await new Promise<string | null>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(null);
      } else {
        let msg = `Falha no envio (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.message) msg = body.message;
        } catch {
          /* ignore */
        }
        if (xhr.status === 403) msg = "Sem permissão para enviar ficheiros.";
        if (xhr.status === 413) msg = "Ficheiro demasiado grande.";
        resolve(msg);
      }
    };
    xhr.onerror = () => resolve("Erro de rede ao enviar o ficheiro.");
    xhr.send(file);
  });

  if (errorMessage) return { url: null, error: errorMessage };

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
