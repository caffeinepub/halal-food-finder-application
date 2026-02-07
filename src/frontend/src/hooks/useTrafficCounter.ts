import { useEffect, useState } from 'react';
import { useActor } from './useActor';

const SESSION_KEY = 'traffic_counter_incremented';
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

export function useTrafficCounter() {
  const { actor, isFetching } = useActor();
  const [totalVisits, setTotalVisits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!actor || isFetching) {
      return;
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const incrementWithRetry = async (retryCount = 0): Promise<bigint | null> => {
      try {
        const newCount = await actor.incrementPageViews();
        return newCount;
      } catch (error) {
        console.error(`Failed to increment page views (attempt ${retryCount + 1}):`, error);
        if (retryCount < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          return incrementWithRetry(retryCount + 1);
        }
        return null;
      }
    };

    const getWithRetry = async (retryCount = 0): Promise<bigint | null> => {
      try {
        const currentCount = await actor.getPageViews();
        return currentCount;
      } catch (error) {
        console.error(`Failed to get page views (attempt ${retryCount + 1}):`, error);
        if (retryCount < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          return getWithRetry(retryCount + 1);
        }
        return null;
      }
    };

    const incrementAndFetch = async () => {
      try {
        // Check if we've already incremented in this session
        const hasIncremented = sessionStorage.getItem(SESSION_KEY);

        let count: bigint | null = null;

        if (!hasIncremented) {
          // Increment the counter (first visit in this session)
          count = await incrementWithRetry();
          if (count !== null) {
            sessionStorage.setItem(SESSION_KEY, 'true');
          }
        } else {
          // Just fetch the current count (already incremented this session)
          count = await getWithRetry();
        }

        if (count !== null) {
          setTotalVisits(Number(count));
          setHasError(false);
        } else {
          // All retries failed
          setHasError(true);
          setTotalVisits(null);
        }
      } catch (error) {
        console.error('Unexpected error in traffic counter:', error);
        setHasError(true);
        setTotalVisits(null);
      } finally {
        setIsLoading(false);
      }
    };

    incrementAndFetch();
  }, [actor, isFetching]);

  return {
    totalVisits,
    isLoading,
    hasError,
  };
}
