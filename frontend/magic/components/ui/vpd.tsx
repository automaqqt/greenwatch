import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const VPDCalculator = ({API_KEY}:{API_KEY: string}) => {
  const [plantTemp, setPlantTemp] = useState('');
  const [sensorData, setSensorData] = useState({
    avgTemp: 0,
    avgHumidity: 0,
    loading: true,
    error: 'nope'
  });
  const [vpd, setVpd] = useState<number | null>(null);
  // Fetch sensor data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`https://farm.vidsoft.net/api/sensor_data?sort=desc&limit=10&key=${API_KEY}`);
        const data = await response.json();
        
        // Calculate averages
        const temps = data.sensor_data.map((d: { temperature: number; }) => d.temperature);
        const humidities = data.sensor_data.map((d: { humidity: number; }) => d.humidity);
        
        const avgTemp = temps.reduce((a: number, b: number) => a + b, 0) / temps.length;
        const avgHumidity = humidities.reduce((a: number, b: number) => a + b, 0) / humidities.length;
        
        setSensorData({
          avgTemp,
          avgHumidity,
          loading: false,
          error: 'nope'
        });
      } catch (error) {
        console.error('Error fetching sensor data:', error);
        setSensorData(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to fetch sensor data'
        }));
      }
    };

    fetchData();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  // Calculate saturated vapor pressure (SVP) in kPa
  const calculateSVP = (tempC: number) => {
    return 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  };

  // Calculate VPD in kPa
  const calculateVPD = () => {
    if (!plantTemp || !sensorData.avgTemp || !sensorData.avgHumidity) return;

    const plantTempFloat = parseFloat(plantTemp);
    const plantSVP = calculateSVP(plantTempFloat);
    const airSVP = calculateSVP(sensorData.avgTemp);
    const actualVP = (airSVP * (sensorData.avgHumidity / 100));
    const vpdValue = plantSVP - actualVP;

    setVpd(vpdValue);
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Vapor Pressure Deficit Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(sensorData.error !== 'nope')  && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{sensorData.error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Average Air Temperature</Label>
            <span className="text-sm">
              {sensorData.loading ? 'Loading...' : 
               sensorData.avgTemp ? `${sensorData.avgTemp.toFixed(1)}°C` : 'N/A'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <Label>Average Relative Humidity</Label>
            <span className="text-sm">
              {sensorData.loading ? 'Loading...' : 
               sensorData.avgHumidity ? `${sensorData.avgHumidity.toFixed(1)}%` : 'N/A'}
            </span>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="plantTemp">Plant Temperature (°C)</Label>
            <Input
              id="plantTemp"
              type="number"
              step="0.1"
              value={plantTemp}
              onChange={(e) => setPlantTemp(e.target.value)}
              placeholder="Enter plant temperature"
            />
          </div>
        </div>

        <Button 
          className="w-full"
          onClick={calculateVPD}
          disabled={!plantTemp || sensorData.loading}
        >
          Calculate VPD
        </Button>

        {vpd !== null && (
          <div className="mt-4 p-4 bg-slate-100 rounded-md">
            <div className="text-center">
              <div className="text-sm text-slate-600">Vapor Pressure Deficit</div>
              <div className="text-2xl font-bold text-slate-900">{vpd.toFixed(2)} kPa</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VPDCalculator;