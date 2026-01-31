import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Volume2 } from 'lucide-react';

interface NotificationPrefs {
  soundEnabled: boolean;
  soundVolume: number;
  flashEnabled: boolean;
}

interface KDSNotificationSettingsProps {
  prefs: NotificationPrefs;
  setPrefs: (update: Partial<NotificationPrefs>) => void;
  testSound: (type: 'new' | 'review') => void;
}

export function KDSNotificationSettings({
  prefs,
  setPrefs,
  testSound,
}: KDSNotificationSettingsProps) {
  const isMuted = !prefs.soundEnabled && !prefs.flashEnabled;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" title="Configurações de notificação">
          {isMuted ? (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <h4 className="font-medium">Alertas de Pedidos</h4>

          {/* Sound toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="sound-toggle" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Som
            </Label>
            <Switch
              id="sound-toggle"
              checked={prefs.soundEnabled}
              onCheckedChange={(checked) => setPrefs({ soundEnabled: checked })}
            />
          </div>

          {/* Volume slider */}
          {prefs.soundEnabled && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Volume: {Math.round(prefs.soundVolume * 100)}%
              </Label>
              <Slider
                value={[prefs.soundVolume]}
                min={0.1}
                max={1}
                step={0.1}
                onValueChange={([v]) => setPrefs({ soundVolume: v })}
              />
            </div>
          )}

          {/* Flash toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="flash-toggle">Flash visual</Label>
            <Switch
              id="flash-toggle"
              checked={prefs.flashEnabled}
              onCheckedChange={(checked) => setPrefs({ flashEnabled: checked })}
            />
          </div>

          {/* Test buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => testSound('new')}
              disabled={!prefs.soundEnabled}
            >
              Testar novo
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => testSound('review')}
              disabled={!prefs.soundEnabled}
            >
              Testar revisão
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
