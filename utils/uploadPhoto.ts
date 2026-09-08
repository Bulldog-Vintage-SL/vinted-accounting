export async function uploadPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/photo-upload", { method: "POST", body: formData });

  if (!res.ok) {
    let message = `Error al subir la foto (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
    }
    throw new Error(message);
  }

  const data = await res.json();
  if (!data?.url) {
    throw new Error("Respuesta inválida del servidor al subir la foto");
  }

  return data.url;
}