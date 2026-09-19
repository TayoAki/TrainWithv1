export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const requireFeature = (value: unknown, name: string) => {
  if (!value)
    throw new ApiError(503, "NOT_CONFIGURED", `${name} is not configured yet.`);
};
