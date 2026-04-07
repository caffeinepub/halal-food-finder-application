import { useState } from 'react';
import { Key, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFoursquareConfig } from '@/hooks/useFoursquareConfig';

export function FoursquareSettingsPanel() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const {
    isFoursquareConfigured,
    isLoading,
    isChecking,
    saveApiKey,
    clearApiKey,
    isSaving,
    isClearing,
  } = useFoursquareConfig();

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      saveApiKey(apiKeyInput.trim());
      setApiKeyInput('');
    }
  };

  const handleClear = () => {
    clearApiKey();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Foursquare Configuration
          </CardTitle>
          <CardDescription>Loading configuration status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Foursquare Configuration
        </CardTitle>
        <CardDescription>
          Configure Foursquare API integration to enhance search results with additional place data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Alert */}
        {isChecking ? (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Checking Status</AlertTitle>
            <AlertDescription>Verifying Foursquare configuration...</AlertDescription>
          </Alert>
        ) : isFoursquareConfigured ? (
          <Alert className="border-halal/50 bg-halal/5">
            <CheckCircle className="h-4 w-4 text-halal" />
            <AlertTitle>Configured</AlertTitle>
            <AlertDescription>
              Foursquare API is configured and active. Search results will include data from Foursquare.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-amber-500/50 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle>Not Configured</AlertTitle>
            <AlertDescription>
              Foursquare API is not configured. Search results will use OpenStreetMap data only.
            </AlertDescription>
          </Alert>
        )}

        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="foursquare-key">Foursquare API Key</Label>
          <div className="flex gap-2">
            <Input
              id="foursquare-key"
              type="password"
              placeholder="Enter your Foursquare API key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              disabled={isSaving || isClearing}
            />
            <Button
              onClick={handleSave}
              disabled={!apiKeyInput.trim() || isSaving || isClearing}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{' '}
            <a
              href="https://foursquare.com/developers/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-halal hover:underline"
            >
              Foursquare Developers
            </a>
          </p>
        </div>

        {/* Clear Button */}
        {isFoursquareConfigured && (
          <div className="pt-2">
            <Button
              onClick={handleClear}
              variant="outline"
              disabled={isClearing || isSaving}
              className="w-full"
            >
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Clear Configuration
                </>
              )}
            </Button>
          </div>
        )}

        {/* Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Administrator Access Required</AlertTitle>
          <AlertDescription className="text-xs">
            Only administrators can configure Foursquare API settings. The API key is stored securely
            in the backend and never exposed to the browser.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
