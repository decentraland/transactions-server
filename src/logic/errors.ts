export function isErrorWithMessage(error: unknown): error is Error {
  return (
    error !== undefined &&
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  )
}
