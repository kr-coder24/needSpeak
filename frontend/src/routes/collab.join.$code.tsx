import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useCollabStore } from "@/store/useCollabStore";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/collab/join/$code")({
  component: JoinCollabPage,
});

function JoinCollabPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = useCollabStore.getState().resolveCode(code);
    if (sessionId) {
      navigate({ to: `/collab/${sessionId}`, replace: true });
    } else {
      setError("This cart isn't on this device. Group carts are shared within the same browser for the demo.");
    }
  }, [code, navigate]);

  return (
    <AppShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        {error ? (
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Oops!</h1>
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
            >
              Go Home
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
            <p className="mt-4 text-sm text-muted-foreground">Joining cart...</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
