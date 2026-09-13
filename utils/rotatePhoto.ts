export async function rotatePhoto(url: string, degrees: 90 | -90 | 180 = 90): Promise<string> {
  const res = await fetch("/api/photos/rotate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, degrees }),
  });

  if (!res.ok) {
    let message = `Error al rotar la foto (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // keep default
    }
    throw new Error(message);
  }

  const data = await res.json();
  if (!data?.url) {
    throw new Error("Respuesta inválida del servidor al rotar la foto");
  }

  return data.url as string;
}

export function replacePhotoUrl(urls: string[], oldUrl: string, newUrl: string): string[] {
  return urls.map((url) => (url === oldUrl ? newUrl : url));
}
