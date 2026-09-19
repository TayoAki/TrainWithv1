export async function selectUpload(): Promise<{
  name: string;
  file: File;
} | null> {
  throw new Error("Upload videos from the TrainWith web studio.");
}
export async function sendUpload(
  _workoutId: string,
  _file: File,
  _onProgress: (value: number) => void,
): Promise<void> {
  throw new Error("Upload videos from the TrainWith web studio.");
}
