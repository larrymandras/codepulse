import { useCallback, useEffect, useRef, useState } from "react";
import { listCommentsForDoc, type DocComment } from "../lib/docCommentsApi";

export function useDocComments(
  profileId: string,
  repo: string,
  path: string,
  intervalMs = 5000,
) {
  const [comments, setComments] = useState<DocComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!repo || !path) {
      setComments([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listCommentsForDoc(profileId, repo, path);
      setComments(res.comments);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [profileId, repo, path]);

  const fetchOnceRef = useRef(fetchOnce);
  fetchOnceRef.current = fetchOnce;

  useEffect(() => {
    fetchOnceRef.current();
    if (!repo || !path) return;
    const id = setInterval(() => fetchOnceRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [repo, path, intervalMs]);

  const refetch = useCallback(() => {
    fetchOnceRef.current();
  }, []);

  return { comments, loading, error, refetch };
}
