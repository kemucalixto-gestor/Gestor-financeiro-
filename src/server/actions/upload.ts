"use server";

import { put } from "@vercel/blob";
import { requireUser } from "@/lib/session";

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadAttachment(
  formData: FormData,
): Promise<UploadResult> {
  const user = await requireUser();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      error:
        "Armazenamento de anexos não configurado (ative Vercel Blob no projeto).",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo ausente" };
  if (file.size === 0) return { ok: false, error: "Arquivo vazio" };
  if (file.size > 9 * 1024 * 1024) {
    return { ok: false, error: "Arquivo maior que 9MB" };
  }
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return { ok: false, error: "Aceita apenas imagens ou PDF" };
  }

  const ext = file.type === "application/pdf"
    ? "pdf"
    : file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
  const key = `attachments/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  try {
    const blob = await put(key, file, {
      access: "public",
      contentType: file.type,
    });
    return { ok: true, url: blob.url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao enviar anexo",
    };
  }
}
