// Just enough of Deno's types for the type check on the PC (npx tsc --noEmit).
// Supabase runs functions on the real Deno, which never loads this file.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  const env: { get(name: string): string | undefined };
}
