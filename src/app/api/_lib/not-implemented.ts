export function createNotImplementedResponse(job: string) {
  return Response.json(
    {
      error: 'Not implemented',
      job,
    },
    { status: 501 },
  );
}
