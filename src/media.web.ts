import * as DocumentPicker from "expo-document-picker";
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("trainwith-media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("videos");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function pickVideo(): Promise<{
  uri: string;
  name: string;
} | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: "video/*",
    multiple: false,
  });
  if (r.canceled) return null;
  const a = r.assets[0];
  if ((a.size || 0) > 100 * 1024 * 1024)
    throw new Error("Choose a video smaller than 100 MB.");
  const blob = a.file || (await (await fetch(a.uri)).blob());
  const d = await db();
  const key = `media:${Date.now()}`;
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("videos", "readwrite");
    tx.objectStore("videos").put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  d.close();
  return { uri: key, name: a.name };
}
export async function resolveVideo(uri: string) {
  if (!uri.startsWith("media:")) return uri;
  const d = await db();
  const blob = await new Promise<Blob>((resolve, reject) => {
    const r = d.transaction("videos").objectStore("videos").get(uri);
    r.onsuccess = () =>
      r.result
        ? resolve(r.result)
        : reject(
            new Error(
              "Local video not found. Select the file again in your studio.",
            ),
          );
    r.onerror = () => reject(r.error);
  });
  d.close();
  return URL.createObjectURL(blob);
}
