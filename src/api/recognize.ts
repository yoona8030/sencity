// src/api/recognize.ts
export async function recognizeAnimal(
  uri: string,
  name = 'photo.jpg',
  type = 'image/jpeg',
) {
  const form = new FormData();
  form.append('photo', { uri, name, type } as any);
  const res = await fetch('http://127.0.0.1:8000/api/ai/recognize', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { label, animal_id }
}
