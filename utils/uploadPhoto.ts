export async function uploadPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/photo-upload", { method: "POST", body: formData });
  const { url } = await res.json();
  return url;
}
