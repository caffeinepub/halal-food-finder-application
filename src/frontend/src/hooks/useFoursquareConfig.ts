import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { toast } from 'sonner';

/**
 * Hook for managing Foursquare API configuration.
 * Provides status checking and key management for admin users.
 */
export function useFoursquareConfig() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();

  // Check if Foursquare is configured (returns boolean status only)
  const statusQuery = useQuery<boolean>({
    queryKey: ['foursquareConfigured'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      try {
        const key = await actor.getFoursquareApiKey();
        return key !== null && key.trim().length > 0;
      } catch (error) {
        // If unauthorized (not admin), assume not configured
        console.warn('Unable to check Foursquare status:', error);
        return false;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: false,
    staleTime: 60000, // Cache for 1 minute
  });

  // Save Foursquare API key
  const saveMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setFoursquareApiKey(apiKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foursquareConfigured'] });
      toast.success('Foursquare API key saved successfully');
    },
    onError: (error: Error) => {
      const message = error.message.includes('Unauthorized')
        ? 'Only administrators can configure Foursquare'
        : 'Failed to save Foursquare API key';
      toast.error(message);
    },
  });

  // Clear Foursquare API key
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.clearFoursquareApiKey();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foursquareConfigured'] });
      toast.success('Foursquare API key cleared successfully');
    },
    onError: (error: Error) => {
      const message = error.message.includes('Unauthorized')
        ? 'Only administrators can clear Foursquare configuration'
        : 'Failed to clear Foursquare API key';
      toast.error(message);
    },
  });

  return {
    isFoursquareConfigured: statusQuery.data ?? false,
    isLoading: actorFetching || statusQuery.isLoading,
    isChecking: statusQuery.isFetching,
    saveApiKey: saveMutation.mutate,
    clearApiKey: clearMutation.mutate,
    isSaving: saveMutation.isPending,
    isClearing: clearMutation.isPending,
  };
}
