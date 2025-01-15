import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface Picture {
  id: string,
  timestamp: string,
  image_path: string,
  day: number
}
const TimelapseTab = ({ 
  auth,
  API_BASE,
  API_KEY
}:{auth:{
  isAuthenticated: boolean,
  username: string,
  password: string
}, API_BASE:string, API_KEY:string}) => {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const selectedHour = 12;
  const [germDate, setGermDate] = useState<Date>(new Date);

  useEffect(() => {
    // Fetch germination date on component mount
    const fetchGermDate = async () => {
      try {
        const url = new URL(`${API_BASE}/user/preferences`);
        url.searchParams.append('key', API_KEY);
        url.searchParams.append('username', auth.username);
        
        const response = await fetch(url.toString());
        const data = await response.json();
        
        if (data.germination_date) {
          setGermDate(new Date(data.germination_date));
        }
      } catch (error) {
        console.error('Error fetching germination date:', error);
      }
    };

    fetchGermDate();
  }, [API_BASE, API_KEY, auth.username]);

  useEffect(() => {
    // Fetch timelapse pictures when germination date changes
    const fetchPictures = async () => {
      if (!germDate) return;

      try {
        const url = new URL(`${API_BASE}/timelapse`);
        url.searchParams.append('key', API_KEY);
        
        url.searchParams.append('start_date', germDate.toISOString());
        url.searchParams.append('hour', selectedHour.toString());
        
        const response = await fetch(url.toString());
        const data = await response.json();
        setPictures(data.pictures);
        setCurrentIndex(0);
      } catch (error) {
        console.error('Error fetching pictures:', error);
      }
    };

    fetchPictures();
  }, [germDate, selectedHour, API_BASE, API_KEY]);

  useEffect(() => {
    let interval: string | number | NodeJS.Timeout | undefined;
    if (isPlaying && pictures.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex(current => {
          if (current >= pictures.length - 1) {
            setIsPlaying(false);
            return current;
          }
          return current + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, pictures.length, playbackSpeed]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        {pictures.length > 0 && pictures[currentIndex] && (
          <div className="space-y-4">
            <div className="aspect-video bg-gray-100 relative">
              <img
                src={`${API_BASE}/${pictures[currentIndex].image_path}`}
                alt={`Day ${pictures[currentIndex].day}`}
                className="w-full h-full object-cover"
                style={{ transform: 'rotate(180deg)' }}
              />
              <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full">
                Day {pictures[currentIndex].day}
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Speed: {playbackSpeed}x</span>
              </div>
              <Slider
                value={[playbackSpeed]}
                onValueChange={(value) => setPlaybackSpeed(value[0])}
                min={0.5}
                max={5}
                step={0.5}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Progress</span>
              </div>
              <Slider
                value={[currentIndex]}
                onValueChange={(value) => {
                  setCurrentIndex(value[0]);
                  setIsPlaying(false);
                }}
                max={pictures.length - 1}
                step={1}
              />
            </div>
          </div>
        )}
        
        {pictures.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No timelapse pictures available. Please set a germination date in settings.
          </div>
        )}
      </Card>
    </div>
  );
};

export default TimelapseTab;