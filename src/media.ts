import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
export async function pickVideo(): Promise<{
  uri: string;
  name: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "video/*",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > 100 * 1024 * 1024)
    throw new Error("Choose a video smaller than 100 MB.");
  const source = new File(asset.uri);
  const dest = new File(
    Paths.document,
    `trainwith-${Date.now()}-${asset.name.replace(/[^a-zA-Z0-9.]/g, "_")}`,
  );
  source.copy(dest);
  return { uri: dest.uri, name: asset.name };
}
export async function resolveVideo(uri: string) {
  return uri;
}
