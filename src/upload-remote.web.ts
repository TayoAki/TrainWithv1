import * as DocumentPicker from "expo-document-picker";
import { createUpload } from "@mux/upchunk";
import { api } from "./backend";
export async function selectUpload(): Promise<{
  name: string;
  file: File;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "video/*",
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = asset.file;
  if (!file || !file.type.startsWith("video/"))
    throw new Error("Choose a video file.");
  if (file.size > 5 * 1024 ** 3)
    throw new Error("Choose a video smaller than 5 GB.");
  return { name: asset.name, file };
}
export async function sendUpload(
  workoutId: string,
  file: File,
  onProgress: (value: number) => void,
) {
  const { url } = await api<{ url: string }>("/v1/videos/upload", {
    workoutId,
  });
  await new Promise<void>((resolve, reject) => {
    const upload = createUpload({
      endpoint: url,
      file,
      chunkSize: 5120,
      attempts: 5,
    });
    upload.on("progress", (event) => onProgress(event.detail));
    upload.on("success", () => resolve());
    upload.on("error", () =>
      reject(
        new Error("Upload failed after retries. Keep the draft and try again."),
      ),
    );
  });
}
